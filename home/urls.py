from django.urls import path
from home import views

# API endpoints only - React frontend handles all UI
# Note: These are included under 'api/' prefix in main urls.py
urlpatterns = [
    # Health Dashboard
    path('health', views.HealthDashboardAPIView.as_view(), name='api-health-dashboard'),
    # Binance endpoints
    path('binance/positions', views.BinancePositionsAPIView.as_view(), name='api-binance-positions'),
    # Zerodha endpoints
    path('zerodha/positions', views.ZerodhaPositionsAPIView.as_view(), name='api-zerodha-positions'),
    path('zerodha/holdings', views.ZerodhaHoldingsAPIView.as_view(), name='api-zerodha-holdings'),
    path('zerodha/account', views.ZerodhaAccountAPIView.as_view(), name='api-zerodha-account'),
    # Backtesting endpoints
    path('backtest/symbols', views.SymbolsAPIView.as_view(), name='api-backtest-symbols'),
    path('backtest/submit', views.BacktestSubmitAPIView.as_view(), name='api-backtest-submit'),
    path('backtest/<str:job_id>/status', views.BacktestStatusAPIView.as_view(), name='api-backtest-status'),
    path('backtest/<str:job_id>/results', views.BacktestResultsAPIView.as_view(), name='api-backtest-results'),
    path('backtest/history', views.BacktestHistoryAPIView.as_view(), name='api-backtest-history'),
    path('backtest/<str:job_id>/delete', views.BacktestDeleteAPIView.as_view(), name='api-backtest-delete'),
    # Historical data endpoint
    path('historical/data', views.HistoricalDataAPIView.as_view(), name='api-historical-data'),
    # Pivot trendlines endpoint
    path('historical/trendlines', views.PivotTrendlineAPIView.as_view(), name='api-historical-trendlines'),
    # Debug endpoint
    path('debug/ta-engine', views.TAEngineDebugAPIView.as_view(), name='api-debug-ta-engine'),
]
