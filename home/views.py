from django.shortcuts import render , HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from app import binance_api as ba
from app import historic_data_csv as hdc
from app import backtest as bt
from django.conf import settings
import requests as req
from home.serializers import BinanceBalanceSerializer
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