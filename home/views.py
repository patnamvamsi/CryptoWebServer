from django.shortcuts import render , HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from app import binance_api as ba
from app import zerodha_api as za
from app import historic_data_csv as hdc
from app import backtest as bt
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
    SymbolSerializer
)
# Create your views here.

context = {'title': settings.APP_NAME + ' Algo Platform'}

def home(request):
    context = {'title': settings.APP_NAME + ' Algo Platform'}  #config http://the-redpill.blogspot.com/2018/04/the-sanskrit-word-for-algorithm-vrtti.html
    return render(request, 'index.html', context)

def binance(request):
    balances = ba.get_binance_positions()
    context['balances'] = balances
    return render(request, 'binance.html', context )


def historicaldata(request):
    graph = hdc.get_historic_data_plotly("XRPAUD")
    data = hdc.get_historic_data("XRPAUD").to_json(orient = 'records')
    context['graph'] = graph
    return render(request, 'historicaldata.html', context)


def screener(request):
    return HttpResponse("Welcome to screener")


def backtesting(request):
    #result_graph = bt.get_backtest_results()
    result_graph = req.get(settings.TA_ENGINE + '/RSIbacktest')
    context['result_graph'] =  result_graph.json()
    return render(request, 'backtesting.html',  context)


def papertrading(request):
    return HttpResponse("Welcome to paper trading")

def portfolio (request):
    return HttpResponse("Your Portfolio is under optimisation")


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
    Query symbols table from shared TimescaleDB.
    Returns both Binance and Zerodha symbols.
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

        # Query unified symbols table
        cursor.execute("""
            SELECT exchange, symbol, base_asset, quote_asset, active, priority
            FROM symbols
            WHERE active = true
            ORDER BY exchange, priority DESC, symbol
        """)

        rows = cursor.fetchall()
        conn.close()

        symbols = [
            {
                'exchange': row[0],
                'symbol': row[1],
                'base_asset': row[2],
                'quote_asset': row[3],
                'active': row[4],
                'priority': row[5]
            }
            for row in rows
        ]

        return symbols
    except Exception as e:
        # If symbols table doesn't exist, return empty list
        print(f"Error fetching symbols: {e}")
        return []


# Backtesting API Views
class SymbolsAPIView(APIView):
    """
    Get list of available symbols for backtesting.
    Queries TimescaleDB symbols table.
    """
    def get(self, request):
        try:
            symbols = get_symbols_from_timescale()
            serializer = SymbolSerializer(symbols, many=True)
            return Response({
                'success': True,
                'data': serializer.data
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