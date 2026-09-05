from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from app import binance_api as ba
from app import zerodha_api as za
from django.conf import settings
import requests as req
import psycopg2
import json
from datetime import datetime
from home.models import BacktestJob
from home.serializers import (
    BinanceBalanceSerializer,
    ZerodhaPositionSerializer,
    ZerodhaHoldingSerializer,
    ZerodhaAccountSerializer,
    BacktestJobSerializer,
    BacktestSubmitSerializer,
    SymbolSerializer,
    OHLCVSerializer,
    HistoricalDataRequestSerializer
)
import traceback


# API Views for React Frontend
class BinancePositionsAPIView(APIView):
    """
    API endpoint to get Binance account positions
    Returns JSON data for React frontend
    """
    def get(self, request):
        try:
            balances = ba.get_binance_positions()
            serializer = BinanceBalanceSerializer(balances, many=True)
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ZerodhaPositionsAPIView(APIView):
    """
    API endpoint to get Zerodha positions (intraday/F&O)
    Returns JSON data for React frontend
    """
    def get(self, request):
        try:
            positions = za.get_zerodha_positions()
            serializer = ZerodhaPositionSerializer(positions, many=True)
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ZerodhaHoldingsAPIView(APIView):
    """
    API endpoint to get Zerodha holdings (long-term equity)
    Returns JSON data for React frontend
    """
    def get(self, request):
        try:
            holdings = za.get_zerodha_holdings()
            serializer = ZerodhaHoldingSerializer(holdings, many=True)
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ZerodhaAccountAPIView(APIView):
    """
    API endpoint to get Zerodha account information
    Returns JSON data for React frontend
    """
    def get(self, request):
        try:
            account_info = za.get_zerodha_account()
            serializer = ZerodhaAccountSerializer(account_info)
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Backtesting Helper Functions
def get_symbols_from_timescale():
    """
    Query symbols from TimescaleDB.
    - Binance symbols from 'binance_symbols' table
    - Zerodha symbols from 'symbols' table
    Returns combined list of symbols from both exchanges.
    """
    try:
        conn = psycopg2.connect(
            host=settings.TIMESCALE_HOST,
            port=settings.TIMESCALE_PORT,
            database=settings.TIMESCALE_DB,
            user=settings.TIMESCALE_USER,
            password=settings.TIMESCALE_PASSWORD
        )

        cursor = conn.cursor()
        all_symbols = []

        # Query Binance symbols from binance_symbols table
        try:
            cursor.execute("""
                SELECT 'binance' as exchange, symbol, baseasset, quoteasset,
                       status = 'TRADING' as active, priority
                FROM binance_symbols
                WHERE status = 'TRADING' AND active = true
                ORDER BY priority DESC, symbol
            """)
            binance_rows = cursor.fetchall()

            for row in binance_rows:
                all_symbols.append({
                    'exchange': row[0],
                    'symbol': row[1],
                    'base_asset': row[2],
                    'quote_asset': row[3],
                    'active': row[4],
                    'priority': row[5]
                })
        except Exception as e:
            print(f"Error fetching Binance symbols: {e}")

        # Query Zerodha symbols from symbols table
        try:
            cursor.execute("""
                SELECT exchange, symbol, base_asset, quote_asset, active, priority
                FROM symbols
                WHERE active = true AND exchange = 'zerodha'
                ORDER BY priority DESC, symbol
            """)
            zerodha_rows = cursor.fetchall()

            for row in zerodha_rows:
                all_symbols.append({
                    'exchange': row[0],
                    'symbol': row[1],
                    'base_asset': row[2],
                    'quote_asset': row[3],
                    'active': row[4],
                    'priority': row[5]
                })
        except Exception as e:
            print(f"Error fetching Zerodha symbols: {e}")

        conn.close()
        return all_symbols

    except Exception as e:
        print(f"Database connection error: {e}")
        return []


# Backtesting API Views
class SymbolsAPIView(APIView):
    """
    Get list of available symbols for backtesting.
    Queries TimescaleDB symbols table with Redis caching.
    """
    def get(self, request):
        try:
            from home.cache_utils import get_cached_symbols, cache_symbols

            # Try to get from cache first
            symbols = get_cached_symbols()

            if symbols is None:
                # Cache miss - query from database
                symbols = get_symbols_from_timescale()
                # Cache the results
                if symbols:
                    cache_symbols(symbols)

            serializer = SymbolSerializer(symbols, many=True)
            return Response({
                'success': True,
                'data': serializer.data,
                'cached': symbols is not None
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BacktestSubmitAPIView(APIView):
    """
    Submit a backtest job to CryptoTAEngine.
    Stores job reference locally and proxies request to TA Engine.
    """
    def post(self, request):
        try:
            serializer = BacktestSubmitSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'success': False,
                    'error': 'Invalid parameters',
                    'details': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            data = serializer.validated_data

            # Prepare request for CryptoTAEngine
            ta_request = {
                'strategy': data['strategy'],
                'symbol': data['symbol'],
                'exchange': data.get('exchange', 'binance'),
                'start_date': data['start_date'].isoformat(),
                'end_date': data['end_date'].isoformat(),
                'timeframe': data['timeframe'],
                'initial_capital': float(data['initial_capital']),
                'commission': float(data['commission']),
                'parameters': data.get('parameters', {})
            }

            # Submit to CryptoTAEngine
            response = req.post(
                f"{settings.TA_ENGINE}/backtest/run",
                json=ta_request,
                timeout=30
            )

            if response.status_code != 200:
                raise Exception(f"TA Engine error: {response.text}")

            result = response.json()
            job_id = result['job_id']

            # Store job reference locally
            job = BacktestJob.objects.create(
                job_id=job_id,
                user=request.user if request.user.is_authenticated else None,
                strategy=data['strategy'],
                symbol=data['symbol'],
                exchange=data.get('exchange', 'binance'),
                timeframe=data['timeframe'],
                start_date=data['start_date'],
                end_date=data['end_date'],
                initial_capital=data['initial_capital'],
                parameters=json.dumps(data.get('parameters', {})),
                status='submitted',
                name=data.get('name', ''),
                notes=data.get('notes', '')
            )

            return Response({
                'success': True,
                'data': {
                    'job_id': job_id,
                    'status': result['status'],
                    'message': result.get('message', 'Backtest submitted successfully')
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BacktestStatusAPIView(APIView):
    """
    Get status of a backtest job.
    Queries CryptoTAEngine and updates local database.
    """
    def get(self, request, job_id):
        try:
            # Get local job record
            job = BacktestJob.objects.filter(job_id=job_id).first()
            if not job:
                return Response({
                    'success': False,
                    'error': 'Job not found'
                }, status=status.HTTP_404_NOT_FOUND)

            # Query CryptoTAEngine for latest status
            response = req.get(
                f"{settings.TA_ENGINE}/backtest/{job_id}/status",
                timeout=10
            )

            if response.status_code == 200:
                result = response.json()

                # Update local record
                job.status = result['status']
                if result.get('message'):
                    job.error_message = result['message']

                # If completed, extract summary metrics
                if result['status'] == 'completed' and result.get('result'):
                    metrics = result['result'].get('metrics', {})
                    job.total_return = metrics.get('total_return')
                    job.sharpe_ratio = metrics.get('sharpe_ratio')
                    job.max_drawdown = metrics.get('max_drawdown')
                    job.total_trades = metrics.get('total_trades')
                    job.win_rate = metrics.get('win_rate')
                    job.completed_at = datetime.now()

                job.save()

                return Response({
                    'success': True,
                    'data': {
                        'job_id': job_id,
                        'status': job.status,
                        'message': result.get('message'),
                        'progress': result.get('progress'),
                        'summary': {
                            'total_return': float(job.total_return) if job.total_return else None,
                            'sharpe_ratio': float(job.sharpe_ratio) if job.sharpe_ratio else None,
                            'max_drawdown': float(job.max_drawdown) if job.max_drawdown else None,
                            'total_trades': job.total_trades,
                            'win_rate': float(job.win_rate) if job.win_rate else None
                        } if job.status == 'completed' else None
                    }
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'success': False,
                    'error': 'Failed to fetch status from TA Engine'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BacktestResultsAPIView(APIView):
    """
    Get full results of a completed backtest.
    Proxies to CryptoTAEngine.
    """
    def get(self, request, job_id):
        try:
            # Verify job exists locally
            job = BacktestJob.objects.filter(job_id=job_id).first()
            if not job:
                return Response({
                    'success': False,
                    'error': 'Job not found'
                }, status=status.HTTP_404_NOT_FOUND)

            # Fetch full results from CryptoTAEngine
            response = req.get(
                f"{settings.TA_ENGINE}/backtest/{job_id}/results",
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                return Response({
                    'success': True,
                    'data': result
                }, status=status.HTTP_200_OK)
            elif response.status_code == 404:
                return Response({
                    'success': False,
                    'error': 'Results not found in TA Engine'
                }, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({
                    'success': False,
                    'error': f"TA Engine error: {response.text}"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BacktestHistoryAPIView(APIView):
    """
    Get list of all backtest jobs (with optional filtering).
    """
    def get(self, request):
        try:
            jobs = BacktestJob.objects.all()

            # Filter by status if provided
            status_filter = request.query_params.get('status')
            if status_filter:
                jobs = jobs.filter(status=status_filter)

            # Filter by symbol if provided
            symbol_filter = request.query_params.get('symbol')
            if symbol_filter:
                jobs = jobs.filter(symbol__icontains=symbol_filter)

            # Filter by strategy if provided
            strategy_filter = request.query_params.get('strategy')
            if strategy_filter:
                jobs = jobs.filter(strategy=strategy_filter)

            # Limit results
            limit = int(request.query_params.get('limit', 50))
            jobs = jobs[:limit]

            serializer = BacktestJobSerializer(jobs, many=True)

            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BacktestDeleteAPIView(APIView):
    """
    Delete a backtest job record (local only, doesn't affect TA Engine).
    """
    def delete(self, request, job_id):
        try:
            job = BacktestJob.objects.filter(job_id=job_id).first()
            if not job:
                return Response({
                    'success': False,
                    'error': 'Job not found'
                }, status=status.HTTP_404_NOT_FOUND)

            job.delete()

            return Response({
                'success': True,
                'message': 'Job deleted successfully'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Import HistoricalDataAPIView and PivotTrendlineAPIView from separate module
from home.historical_data_view import HistoricalDataAPIView, PivotTrendlineAPIView


class TAEngineDebugAPIView(APIView):
    """
    Debug endpoint to test TA Engine connection
    """
    def get(self, request):
        try:
            # Test connection to TA Engine
            url = f"{settings.TA_ENGINE}/health"
            response = req.get(url, timeout=5)

            return Response({
                'success': True,
                'ta_engine_url': settings.TA_ENGINE,
                'ta_engine_host': settings.TA_ENGINE_HOST,
                'ta_engine_port': settings.TA_ENGINE_PORT,
                'connection_test': {
                    'status_code': response.status_code,
                    'response': response.json()
                }
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc(),
                'ta_engine_url': settings.TA_ENGINE,
                'ta_engine_host': getattr(settings, 'TA_ENGINE_HOST', 'NOT SET'),
                'ta_engine_port': getattr(settings, 'TA_ENGINE_PORT', 'NOT SET'),
            }, status=500)


class HealthDashboardAPIView(APIView):
    """
    Comprehensive health dashboard for all platform components
    Checks status of all microservices and reports errors
    """
    def get(self, request):
        health_status = {
            'timestamp': datetime.now().isoformat(),
            'overall_status': 'healthy',
            'components': {}
        }

        # Check TimescaleDB (Primary Database)
        try:
            conn = psycopg2.connect(
                host=settings.TIMESCALE_HOST,
                port=settings.TIMESCALE_PORT,
                database=settings.TIMESCALE_DB,
                user=settings.TIMESCALE_USER,
                password=settings.TIMESCALE_PASSWORD
            )
            cursor = conn.cursor()
            cursor.execute("SELECT version();")
            db_version = cursor.fetchone()[0]
            cursor.close()
            conn.close()

            health_status['components']['timescaledb'] = {
                'status': 'healthy',
                'message': 'Connected successfully',
                'version': db_version.split()[0] + ' ' + db_version.split()[1],
                'host': settings.TIMESCALE_HOST,
                'database': settings.TIMESCALE_DB
            }
        except Exception as e:
            health_status['overall_status'] = 'degraded'
            health_status['components']['timescaledb'] = {
                'status': 'unhealthy',
                'error': str(e),
                'host': settings.TIMESCALE_HOST,
                'database': settings.TIMESCALE_DB
            }

        # Check Market Data Service
        try:
            market_data_url = getattr(settings, 'MARKET_DATA_URL', 'http://market-data:8002')
            response = req.get(f"{market_data_url}/binance/active-symbols", timeout=5)
            if response.status_code == 200:
                data = response.json()
                health_status['components']['market_data_service'] = {
                    'status': 'healthy',
                    'message': 'Service operational',
                    'url': market_data_url,
                    'active_symbols': data.get('count', 0)
                }
            else:
                health_status['overall_status'] = 'degraded'
                health_status['components']['market_data_service'] = {
                    'status': 'degraded',
                    'message': f'HTTP {response.status_code}',
                    'url': market_data_url
                }
        except Exception as e:
            health_status['overall_status'] = 'degraded'
            health_status['components']['market_data_service'] = {
                'status': 'unhealthy',
                'error': str(e),
                'url': getattr(settings, 'MARKET_DATA_URL', 'http://market-data:8002')
            }

        # Check TA Engine Service
        try:
            ta_engine_url = f"{settings.TA_ENGINE_HOST}:{settings.TA_ENGINE_PORT}"
            response = req.get(f"{ta_engine_url}/health", timeout=5)
            if response.status_code == 200:
                health_status['components']['ta_engine'] = {
                    'status': 'healthy',
                    'message': 'Service operational',
                    'url': ta_engine_url
                }
            else:
                health_status['overall_status'] = 'degraded'
                health_status['components']['ta_engine'] = {
                    'status': 'degraded',
                    'message': f'HTTP {response.status_code}',
                    'url': ta_engine_url
                }
        except Exception as e:
            health_status['overall_status'] = 'degraded'
            health_status['components']['ta_engine'] = {
                'status': 'unhealthy',
                'error': str(e),
                'url': f"{settings.TA_ENGINE_HOST}:{settings.TA_ENGINE_PORT}"
            }

        # Check Redis (if configured)
        redis_status = self._check_redis()
        if redis_status:
            health_status['components']['redis'] = redis_status
            if redis_status['status'] == 'unhealthy':
                health_status['overall_status'] = 'degraded'

        # Check Binance API connectivity
        try:
            binance_broker = ba.BinanceBroker()
            if binance_broker.is_connected():
                health_status['components']['binance_api'] = {
                    'status': 'healthy',
                    'message': 'API connected'
                }
            else:
                health_status['overall_status'] = 'degraded'
                health_status['components']['binance_api'] = {
                    'status': 'disconnected',
                    'message': 'API not connected'
                }
        except Exception as e:
            health_status['overall_status'] = 'degraded'
            health_status['components']['binance_api'] = {
                'status': 'unhealthy',
                'error': str(e)
            }

        # Check Zerodha API connectivity
        try:
            zerodha_broker = za.ZerodhaBroker()
            if zerodha_broker.is_connected():
                health_status['components']['zerodha_api'] = {
                    'status': 'healthy',
                    'message': 'API connected'
                }
            else:
                health_status['overall_status'] = 'degraded'
                health_status['components']['zerodha_api'] = {
                    'status': 'disconnected',
                    'message': 'API not connected (access token may need refresh)'
                }
        except Exception as e:
            health_status['overall_status'] = 'degraded'
            health_status['components']['zerodha_api'] = {
                'status': 'unhealthy',
                'error': str(e)
            }

        # Check Sentiment Analysis Service (if configured)
        try:
            sentiment_url = getattr(settings, 'SENTIMENT_ENGINE_URL', None)
            if sentiment_url:
                response = req.get(f"{sentiment_url}/health", timeout=5)
                if response.status_code == 200:
                    health_status['components']['sentiment_service'] = {
                        'status': 'healthy',
                        'message': 'Service operational',
                        'url': sentiment_url
                    }
                else:
                    health_status['components']['sentiment_service'] = {
                        'status': 'degraded',
                        'message': f'HTTP {response.status_code}',
                        'url': sentiment_url
                    }
        except Exception as e:
            if getattr(settings, 'SENTIMENT_ENGINE_URL', None):
                health_status['components']['sentiment_service'] = {
                    'status': 'unhealthy',
                    'error': str(e),
                    'url': getattr(settings, 'SENTIMENT_ENGINE_URL', None)
                }

        # Determine HTTP status code based on overall health
        http_status = status.HTTP_200_OK if health_status['overall_status'] == 'healthy' else status.HTTP_503_SERVICE_UNAVAILABLE

        return Response(health_status, status=http_status)

    def _check_redis(self):
        """Check Redis connectivity"""
        try:
            import redis
            redis_host = getattr(settings, 'REDIS_HOST', None)
            redis_port = getattr(settings, 'REDIS_PORT', 6379)

            if not redis_host:
                return None

            r = redis.Redis(host=redis_host, port=redis_port, socket_connect_timeout=2)
            r.ping()
            info = r.info()

            return {
                'status': 'healthy',
                'message': 'Connected successfully',
                'host': redis_host,
                'port': redis_port,
                'version': info.get('redis_version', 'unknown'),
                'used_memory_human': info.get('used_memory_human', 'unknown')
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'host': getattr(settings, 'REDIS_HOST', 'not configured'),
                'port': getattr(settings, 'REDIS_PORT', 6379)
            }
