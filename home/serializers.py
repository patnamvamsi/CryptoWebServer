from rest_framework import serializers
from home.models import *


class BinanceBalanceSerializer(serializers.Serializer):
    """Serializer for Binance account balance data"""
    asset = serializers.CharField()
    free = serializers.CharField()
    locked = serializers.CharField()
    total = serializers.FloatField()


class ZerodhaPositionSerializer(serializers.Serializer):
    """Serializer for Zerodha positions (intraday/F&O)"""
    tradingsymbol = serializers.CharField()
    exchange = serializers.CharField()
    quantity = serializers.IntegerField()
    average_price = serializers.FloatField()
    last_price = serializers.FloatField()
    pnl = serializers.FloatField()
    product = serializers.CharField()
    position_type = serializers.CharField()


class ZerodhaHoldingSerializer(serializers.Serializer):
    """Serializer for Zerodha holdings (long-term equity)"""
    tradingsymbol = serializers.CharField()
    exchange = serializers.CharField()
    quantity = serializers.IntegerField()
    average_price = serializers.FloatField()
    last_price = serializers.FloatField()
    pnl = serializers.FloatField()
    pnl_percent = serializers.FloatField()
    invested_value = serializers.FloatField()
    current_value = serializers.FloatField()


class ZerodhaAccountSerializer(serializers.Serializer):
    """Serializer for Zerodha account information"""
    user_id = serializers.CharField(required=False)
    user_name = serializers.CharField(required=False)
    email = serializers.CharField(required=False)
    equity_available = serializers.FloatField(required=False)
    equity_used = serializers.FloatField(required=False)
    commodity_available = serializers.FloatField(required=False)
    error = serializers.CharField(required=False)
