from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import path, include
from home import views

urlpatterns = [
    path ('', views.home, name = 'home'),
    path('binance', views.binance, name='binance'),
    path('historicaldata', views.historicaldata, name='historicaldata'),
    path('screener', views.screener, name='screener'),
    path('backtesting', views.backtesting, name='backtesting'),
    path('papertrading', views.papertrading, name='papertrading'),
    path('portfolio', views.portfolio, name='portfolio'),
    # API endpoints for React - Binance
    path('api/binance/positions', views.BinancePositionsAPIView.as_view(), name='api-binance-positions'),
    # API endpoints for React - Zerodha
    path('api/zerodha/positions', views.ZerodhaPositionsAPIView.as_view(), name='api-zerodha-positions'),
    path('api/zerodha/holdings', views.ZerodhaHoldingsAPIView.as_view(), name='api-zerodha-holdings'),
    path('api/zerodha/account', views.ZerodhaAccountAPIView.as_view(), name='api-zerodha-account'),
]

#urlpatterns += staticfiles_urlpatterns
