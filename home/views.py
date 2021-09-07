from django.shortcuts import render , HttpResponse

# Create your views here.

def home(request):
    #return HttpResponse("Welcome to Home Page")
    context = {'title':'Vritti Algo Platform'}  #config
    return render(request, 'index.html', context)

def binance(request):
    return render(request, 'binance.html')


def historicaldata(request):
    return render(request, 'historicaldata.html')


def screener(request):
    return HttpResponse("Welcome to screener")


def backtesting(request):
    return HttpResponse("Welcome to back testing")


def papertrading(request):
    return HttpResponse("Welcome to paper trading")