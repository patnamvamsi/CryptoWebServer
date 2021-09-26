from django.shortcuts import render , HttpResponse

from app import binance_api as ba
from app import historic_data_csv as hdc
from django.conf import settings
# Create your views here.


def home(request):
    #return HttpResponse("Welcome to Home Page")
    settings.APP_NAME
    context = {'title': settings.APP_NAME + ' Algo Platform'}  #config http://the-redpill.blogspot.com/2018/04/the-sanskrit-word-for-algorithm-vrtti.html
    return render(request, 'index.html', context)

def binance(request):
    balances = ba.get_binance_positions()
    return render(request, 'binance.html',{'balances': balances})


def historicaldata(request):
    graph = hdc.get_historic_data_plotly("XRPAUD")
    data = hdc.get_historic_data("XRPAUD").to_json(orient = 'records')
    #return render(request, 'historicaldata.html', {'data':df.to_json(orient = 'records')})
    return render(request, 'historicaldata.html', {'graph': graph,'data': data})


def screener(request):
    return HttpResponse("Welcome to screener")


def backtesting(request):
    return HttpResponse("Welcome to back testing")


def papertrading(request):
    return HttpResponse("Welcome to paper trading")
