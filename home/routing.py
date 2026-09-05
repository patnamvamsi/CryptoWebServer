"""
WebSocket URL routing for real-time price updates
"""

from django.urls import re_path
from home import consumers

websocket_urlpatterns = [
    re_path(r'ws/prices/binance/$', consumers.BinancePriceConsumer.as_asgi()),
    re_path(r'ws/prices/zerodha/$', consumers.ZerodhaPriceConsumer.as_asgi()),
    re_path(r'ws/prices/all/$', consumers.AllPricesConsumer.as_asgi()),
]
