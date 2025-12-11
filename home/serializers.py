from rest_framework import serializers
from home.models import *


class BinanceBalanceSerializer(serializers.Serializer):
    """Serializer for Binance account balance data"""
    asset = serializers.CharField()
    free = serializers.CharField()
    locked = serializers.CharField()
    total = serializers.FloatField()
