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


class BacktestJobSerializer(serializers.ModelSerializer):
    """Serializer for BacktestJob model"""
    parameters_dict = serializers.SerializerMethodField()

    class Meta:
        model = BacktestJob
        fields = '__all__'

    def get_parameters_dict(self, obj):
        return obj.get_parameters_dict()


class BacktestSubmitSerializer(serializers.Serializer):
    """Serializer for backtest submission request"""
    strategy = serializers.ChoiceField(choices=['rsi', 'grid', 'macd', 'bollinger'])
    symbol = serializers.CharField(max_length=20)
    exchange = serializers.CharField(max_length=20, default='binance')
    start_date = serializers.DateTimeField()
    end_date = serializers.DateTimeField()
    timeframe = serializers.ChoiceField(choices=['1m', '5m', '15m', '30m', '1h', '4h', '1d'])
    initial_capital = serializers.DecimalField(max_digits=15, decimal_places=2, default=10000.0)
    commission = serializers.DecimalField(max_digits=5, decimal_places=4, default=0.001)
    parameters = serializers.JSONField(default=dict)
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class SymbolSerializer(serializers.Serializer):
    """Serializer for symbol data"""
    exchange = serializers.CharField()
    symbol = serializers.CharField()
    base_asset = serializers.CharField()
    quote_asset = serializers.CharField()
    active = serializers.BooleanField()
    priority = serializers.IntegerField()


class OHLCVSerializer(serializers.Serializer):
    """Serializer for OHLCV (candlestick) data"""
    timestamp = serializers.DateTimeField()
    open = serializers.FloatField()
    high = serializers.FloatField()
    low = serializers.FloatField()
    close = serializers.FloatField()
    volume = serializers.FloatField()


class HistoricalDataRequestSerializer(serializers.Serializer):
    """Serializer for historical data request parameters"""
    exchange = serializers.CharField(max_length=20, required=False, default='binance')
    symbol = serializers.CharField(max_length=20)
    timeframe = serializers.ChoiceField(choices=['1m', '5m', '15m', '30m', '1h', '4h', '1d'], default='1h')
    start_date = serializers.DateTimeField(required=False)
    end_date = serializers.DateTimeField(required=False)
    limit = serializers.IntegerField(default=100, max_value=5000, min_value=1)
