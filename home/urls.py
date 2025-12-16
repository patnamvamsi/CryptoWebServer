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
    # API endpoints for React - Backtesting
    path('api/backtest/symbols', views.SymbolsAPIView.as_view(), name='api-backtest-symbols'),
    path('api/backtest/submit', views.BacktestSubmitAPIView.as_view(), name='api-backtest-submit'),
    path('api/backtest/<str:job_id>/status', views.BacktestStatusAPIView.as_view(), name='api-backtest-status'),
    path('api/backtest/<str:job_id>/results', views.BacktestResultsAPIView.as_view(), name='api-backtest-results'),
    path('api/backtest/history', views.BacktestHistoryAPIView.as_view(), name='api-backtest-history'),
    path('api/backtest/<str:job_id>/delete', views.BacktestDeleteAPIView.as_view(), name='api-backtest-delete'),
]

#urlpatterns += staticfiles_urlpatterns
