from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import psycopg2
import numpy as np
from home.serializers import HistoricalDataRequestSerializer


class HistoricalDataAPIView(APIView):
    """
    Get historical OHLCV data from TimescaleDB.
    Data is stored in tables: <exchange>_<symbol>_kline_1m
    Supports filtering by exchange, symbol, timeframe, and date range.
    """

    def get_timeframe_minutes(self, timeframe):
        """Convert timeframe string to minutes"""
        mapping = {
            '1m': 1,
            '5m': 5,
            '15m': 15,
            '30m': 30,
            '1h': 60,
            '4h': 240,
            '1d': 1440
        }
        return mapping.get(timeframe, 60)

    def aggregate_klines(self, klines_1m, target_minutes):
        """
        Aggregate 1-minute klines into larger timeframes.
        Groups by time buckets and calculates OHLCV.
        """
        if target_minutes == 1 or not klines_1m:
            return klines_1m

        aggregated = []
        current_bucket = []
        bucket_start = None

        for kline in klines_1m:
            timestamp = kline['timestamp']

            # Parse timestamp
            from datetime import datetime
            if isinstance(timestamp, str):
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            else:
                dt = timestamp

            # Calculate bucket start time
            minutes_since_epoch = int(dt.timestamp() / 60)
            bucket_minutes = (minutes_since_epoch // target_minutes) * target_minutes
            this_bucket_start = bucket_minutes * 60

            # Start new bucket if needed
            if bucket_start is None:
                bucket_start = this_bucket_start

            if this_bucket_start != bucket_start:
                # Finish current bucket
                if current_bucket:
                    aggregated.append(self._create_aggregated_kline(current_bucket, bucket_start))

                # Start new bucket
                current_bucket = [kline]
                bucket_start = this_bucket_start
            else:
                current_bucket.append(kline)

        # Add final bucket
        if current_bucket:
            aggregated.append(self._create_aggregated_kline(current_bucket, bucket_start))

        return aggregated

    def _create_aggregated_kline(self, klines, bucket_timestamp):
        """Create aggregated OHLCV from multiple 1m klines"""
        from datetime import datetime

        return {
            'timestamp': datetime.fromtimestamp(bucket_timestamp).isoformat(),
            'open': klines[0]['open'],
            'high': max(k['high'] for k in klines),
            'low': min(k['low'] for k in klines),
            'close': klines[-1]['close'],
            'volume': sum(k['volume'] for k in klines)
        }

    def get(self, request):
        try:
            from home.cache_utils import get_cached_historical_data, cache_historical_data

            # Validate query parameters
            serializer = HistoricalDataRequestSerializer(data=request.query_params)
            if not serializer.is_valid():
                return Response({
                    'success': False,
                    'error': 'Invalid parameters',
                    'details': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            data = serializer.validated_data
            exchange = data.get('exchange', 'binance').lower()
            symbol = data['symbol']
            timeframe = data.get('timeframe', '1h')
            limit = data.get('limit', 100)
            start_date = data.get('start_date')
            end_date = data.get('end_date')

            # Try to get from cache first
            cached_result = get_cached_historical_data(
                exchange, symbol, timeframe, limit, start_date, end_date
            )

            if cached_result is not None:
                # Cache hit - return cached data
                return Response({
                    'success': True,
                    'data': cached_result,
                    'cached': True
                }, status=status.HTTP_200_OK)

            # Calculate how many 1m candles we need
            target_minutes = self.get_timeframe_minutes(timeframe)
            raw_limit = limit * target_minutes if target_minutes > 1 else limit

            # Connect to TimescaleDB
            conn = psycopg2.connect(
                host=settings.TIMESCALE_HOST,
                port=settings.TIMESCALE_PORT,
                database=settings.TIMESCALE_DB,
                user=settings.TIMESCALE_USER,
                password=settings.TIMESCALE_PASSWORD
            )

            cursor = conn.cursor()

            # Build table name: <exchange>_<symbol>_kline_1m
            table_name = f"{exchange}_{symbol}_kline_1m"

            # Build query - note: column names may vary, adjust as needed
            query = f"""
                SELECT open_time as timestamp, open, high, low, close, volume
                FROM {table_name}
                WHERE 1=1
            """
            params = []

            if start_date:
                query += " AND open_time >= %s"
                params.append(start_date)

            if end_date:
                query += " AND open_time <= %s"
                params.append(end_date)

            query += " ORDER BY open_time DESC LIMIT %s"
            params.append(raw_limit)

            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()

            # Format data
            ohlcv_data_1m = [
                {
                    'timestamp': row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0]),
                    'open': float(row[1]),
                    'high': float(row[2]),
                    'low': float(row[3]),
                    'close': float(row[4]),
                    'volume': float(row[5])
                }
                for row in rows
            ]

            # Reverse to get chronological order for aggregation
            ohlcv_data_1m.reverse()

            # Aggregate if needed
            if target_minutes > 1:
                ohlcv_data = self.aggregate_klines(ohlcv_data_1m, target_minutes)
                # Limit the aggregated results
                ohlcv_data = ohlcv_data[-limit:] if len(ohlcv_data) > limit else ohlcv_data
            else:
                ohlcv_data = ohlcv_data_1m

            # Calculate statistics
            if ohlcv_data:
                prices = [candle['close'] for candle in ohlcv_data]
                stats = {
                    'count': len(ohlcv_data),
                    'first_timestamp': ohlcv_data[0]['timestamp'],
                    'last_timestamp': ohlcv_data[-1]['timestamp'],
                    'min_price': min(prices),
                    'max_price': max(prices),
                    'price_change': prices[-1] - prices[0],
                    'price_change_percent': ((prices[-1] - prices[0]) / prices[0] * 100) if prices[0] != 0 else 0
                }
            else:
                stats = None

            # Prepare response data
            response_data = {
                'exchange': exchange,
                'symbol': symbol,
                'timeframe': timeframe,
                'ohlcv': ohlcv_data,
                'stats': stats
            }

            # Cache the results
            cache_historical_data(
                exchange, symbol, timeframe, limit,
                response_data, start_date, end_date
            )

            return Response({
                'success': True,
                'data': response_data,
                'cached': False
            }, status=status.HTTP_200_OK)

        except psycopg2.errors.UndefinedTable as e:
            return Response({
                'success': False,
                'error': f'Table not found: {exchange}_{symbol}_kline_1m. This symbol may not have historical data available.'
            }, status=status.HTTP_404_NOT_FOUND)
        except psycopg2.Error as e:
            return Response({
                'success': False,
                'error': f'Database error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PivotTrendlineAPIView(APIView):
    """
    Calculate pivot trendlines from historical OHLCV data.
    Identifies pivot highs/lows and calculates trendlines using linear regression.
    Projects trendlines forward into the future.
    """

    def find_pivot_points(self, ohlcv_data, lookback=5):
        """
        Find pivot highs (swing highs) and pivot lows (swing lows).
        A pivot high is a high that is higher than 'lookback' bars on each side.
        A pivot low is a low that is lower than 'lookback' bars on each side.
        """
        pivot_highs = []
        pivot_lows = []

        highs = [candle['high'] for candle in ohlcv_data]
        lows = [candle['low'] for candle in ohlcv_data]

        for i in range(lookback, len(ohlcv_data) - lookback):
            # Check for pivot high
            is_pivot_high = True
            for j in range(1, lookback + 1):
                if highs[i] <= highs[i - j] or highs[i] <= highs[i + j]:
                    is_pivot_high = False
                    break

            if is_pivot_high:
                pivot_highs.append({
                    'index': i,
                    'timestamp': ohlcv_data[i]['timestamp'],
                    'price': highs[i],
                    'type': 'high'
                })

            # Check for pivot low
            is_pivot_low = True
            for j in range(1, lookback + 1):
                if lows[i] >= lows[i - j] or lows[i] >= lows[i + j]:
                    is_pivot_low = False
                    break

            if is_pivot_low:
                pivot_lows.append({
                    'index': i,
                    'timestamp': ohlcv_data[i]['timestamp'],
                    'price': lows[i],
                    'type': 'low'
                })

        return pivot_highs, pivot_lows

    def calculate_trendline(self, pivots, num_pivots=5, spread_across_range=True):
        """
        Calculate trendline using linear regression on pivot points.
        If spread_across_range is True, selects pivots distributed across the entire data range.
        Returns slope, intercept, and the pivot points used.
        """
        if len(pivots) < 2:
            return None

        if spread_across_range and len(pivots) > num_pivots:
            # Select pivots spread across the entire range
            # This ensures the trendline spans the full data period
            total_pivots = len(pivots)
            step = total_pivots / num_pivots
            selected_indices = [int(i * step) for i in range(num_pivots)]
            # Always include the last pivot
            if selected_indices[-1] != total_pivots - 1:
                selected_indices[-1] = total_pivots - 1
            recent_pivots = [pivots[i] for i in selected_indices]
        else:
            # Fallback to using the last num_pivots points
            recent_pivots = pivots[-num_pivots:] if len(pivots) >= num_pivots else pivots

        # Prepare data for linear regression
        x = np.array([p['index'] for p in recent_pivots])
        y = np.array([p['price'] for p in recent_pivots])

        # Linear regression: y = mx + b
        n = len(x)
        sum_x = np.sum(x)
        sum_y = np.sum(y)
        sum_xy = np.sum(x * y)
        sum_x2 = np.sum(x ** 2)

        # Calculate slope and intercept
        denominator = (n * sum_x2 - sum_x ** 2)
        if denominator == 0:
            return None

        slope = (n * sum_xy - sum_x * sum_y) / denominator
        intercept = (sum_y - slope * sum_x) / n

        # Calculate R-squared for confidence
        y_pred = slope * x + intercept
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

        return {
            'slope': float(slope),
            'intercept': float(intercept),
            'r_squared': float(r_squared),
            'pivots_used': recent_pivots,
            'start_index': int(recent_pivots[0]['index']),
            'end_index': int(recent_pivots[-1]['index'])
        }

    def project_trendline(self, trendline, ohlcv_data, projection_bars=20):
        """
        Project trendline forward and create line coordinates.
        Returns start point, end point, and projected end point.
        """
        if trendline is None:
            return None

        slope = trendline['slope']
        intercept = trendline['intercept']
        start_idx = trendline['start_index']
        end_idx = trendline['end_index']
        last_idx = len(ohlcv_data) - 1

        # Calculate prices at key points
        start_price = slope * start_idx + intercept
        end_price = slope * end_idx + intercept
        current_price = slope * last_idx + intercept
        projected_price = slope * (last_idx + projection_bars) + intercept

        return {
            'start': {
                'index': start_idx,
                'timestamp': ohlcv_data[start_idx]['timestamp'],
                'price': float(start_price)
            },
            'end': {
                'index': end_idx,
                'timestamp': ohlcv_data[end_idx]['timestamp'],
                'price': float(end_price)
            },
            'current': {
                'index': last_idx,
                'timestamp': ohlcv_data[last_idx]['timestamp'],
                'price': float(current_price)
            },
            'projected': {
                'index': last_idx + projection_bars,
                'price': float(projected_price)
            },
            'slope': float(slope),
            'slope_angle': float(np.degrees(np.arctan(slope))),
            'r_squared': trendline['r_squared'],
            'pivots_used': len(trendline['pivots_used'])
        }

    def get(self, request):
        try:
            # Validate query parameters
            serializer = HistoricalDataRequestSerializer(data=request.query_params)
            if not serializer.is_valid():
                return Response({
                    'success': False,
                    'error': 'Invalid parameters',
                    'details': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            data = serializer.validated_data
            exchange = data.get('exchange', 'binance').lower()
            symbol = data['symbol']
            timeframe = data.get('timeframe', '1h')
            limit = data.get('limit', 200)  # Need more data for pivot detection

            # Get pivot detection parameters
            # Auto-scale lookback based on data size if not explicitly provided
            lookback_param = request.query_params.get('lookback', None)
            num_pivots = int(request.query_params.get('num_pivots', 5))
            projection_bars = int(request.query_params.get('projection_bars', 20))
            auto_scale_lookback = request.query_params.get('auto_scale', 'true').lower() == 'true'

            # Fetch historical data using parent class logic
            historical_view = HistoricalDataAPIView()
            target_minutes = historical_view.get_timeframe_minutes(timeframe)
            raw_limit = limit * target_minutes if target_minutes > 1 else limit

            # Connect to TimescaleDB
            conn = psycopg2.connect(
                host=settings.TIMESCALE_HOST,
                port=settings.TIMESCALE_PORT,
                database=settings.TIMESCALE_DB,
                user=settings.TIMESCALE_USER,
                password=settings.TIMESCALE_PASSWORD
            )

            cursor = conn.cursor()

            # Sanitize symbol for table name (same as CryptoMarketData)
            import re
            sanitized_symbol = re.sub(r'[^a-zA-Z0-9]', '_', symbol.lower())
            sanitized_symbol = re.sub(r'_+', '_', sanitized_symbol).strip('_')
            table_name = f"{exchange}_{sanitized_symbol}_kline_1m"

            query = f"""
                SELECT open_time as timestamp, open, high, low, close, volume
                FROM {table_name}
                ORDER BY open_time DESC LIMIT %s
            """

            cursor.execute(query, [raw_limit])
            rows = cursor.fetchall()
            conn.close()

            # Format data
            ohlcv_data_1m = [
                {
                    'timestamp': row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0]),
                    'open': float(row[1]),
                    'high': float(row[2]),
                    'low': float(row[3]),
                    'close': float(row[4]),
                    'volume': float(row[5])
                }
                for row in rows
            ]
            ohlcv_data_1m.reverse()

            # Aggregate if needed
            if target_minutes > 1:
                ohlcv_data = historical_view.aggregate_klines(ohlcv_data_1m, target_minutes)
                ohlcv_data = ohlcv_data[-limit:] if len(ohlcv_data) > limit else ohlcv_data
            else:
                ohlcv_data = ohlcv_data_1m[-limit:]

            # Calculate lookback - auto-scale based on data size for better pivot detection
            if lookback_param is not None:
                lookback = int(lookback_param)
            elif auto_scale_lookback:
                # Scale lookback: ~2-3% of data size, min 3, max 20
                # For 100 candles: lookback=3, for 500 candles: lookback=10, for 1000: lookback=20
                lookback = max(3, min(20, len(ohlcv_data) // 50))
            else:
                lookback = 5

            if len(ohlcv_data) < lookback * 2 + 1:
                return Response({
                    'success': False,
                    'error': f'Not enough data for pivot detection. Need at least {lookback * 2 + 1} candles.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Find pivot points
            pivot_highs, pivot_lows = self.find_pivot_points(ohlcv_data, lookback)

            # Calculate trendlines
            resistance_trendline = None
            support_trendline = None

            if len(pivot_highs) >= 2:
                trendline_data = self.calculate_trendline(pivot_highs, num_pivots)
                if trendline_data:
                    resistance_trendline = self.project_trendline(
                        trendline_data, ohlcv_data, projection_bars
                    )
                    if resistance_trendline:
                        resistance_trendline['type'] = 'resistance'
                        resistance_trendline['pivot_points'] = pivot_highs[-num_pivots:]

            if len(pivot_lows) >= 2:
                trendline_data = self.calculate_trendline(pivot_lows, num_pivots)
                if trendline_data:
                    support_trendline = self.project_trendline(
                        trendline_data, ohlcv_data, projection_bars
                    )
                    if support_trendline:
                        support_trendline['type'] = 'support'
                        support_trendline['pivot_points'] = pivot_lows[-num_pivots:]

            return Response({
                'success': True,
                'data': {
                    'exchange': exchange,
                    'symbol': symbol,
                    'timeframe': timeframe,
                    'candle_count': len(ohlcv_data),
                    'lookback': lookback,
                    'lookback_auto_scaled': auto_scale_lookback and lookback_param is None,
                    'num_pivots_requested': num_pivots,
                    'pivot_highs_found': len(pivot_highs),
                    'pivot_lows_found': len(pivot_lows),
                    'projection_bars': projection_bars,
                    'pivot_highs': pivot_highs,
                    'pivot_lows': pivot_lows,
                    'resistance_trendline': resistance_trendline,
                    'support_trendline': support_trendline,
                    'first_candle': ohlcv_data[0] if ohlcv_data else None,
                    'last_candle': ohlcv_data[-1] if ohlcv_data else None
                }
            }, status=status.HTTP_200_OK)

        except psycopg2.errors.UndefinedTable:
            return Response({
                'success': False,
                'error': f'Table not found for {exchange}_{symbol}. Symbol may not have historical data.'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
