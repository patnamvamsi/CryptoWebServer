from django.shortcuts import render , HttpResponse

from app import binance_api as ba
from app import historic_data_csv as hdc
from app import backtest as bt
from django.conf import settings
import requests as req
# Create your views here.

context = {'title': settings.APP_NAME + ' Algo Platform'}

def home(request):
    context = {'title': settings.APP_NAME + ' Algo Platform'}  #config http://the-redpill.blogspot.com/2018/04/the-sanskrit-word-for-algorithm-vrtti.html
    return render(request, 'index.html', context)

def binance(request):
    balances = ba.get_binance_positions()
    return render(request, 'binance.html',{'balances': balances} | context)


def historicaldata(request):
    graph = hdc.get_historic_data_plotly("XRPAUD")
    data = hdc.get_historic_data("XRPAUD").to_json(orient = 'records')
    return render(request, 'historicaldata.html', {'graph': graph,'data': data} | context)


def screener(request):
    return HttpResponse("Welcome to screener")


def backtesting(request):
    #result_graph = bt.get_backtest_results()
    result_graph = req.get(settings.TA_ENGINE + '/RSIbacktest')
    return render(request, 'backtesting.html', {'result_graph': result_graph.json()} | context)


def papertrading(request):
    return HttpResponse("Welcome to paper trading")

def portfolio (request):
    return HttpResponse("Your Portfolio is under optimisation")