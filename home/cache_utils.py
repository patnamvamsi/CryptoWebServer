"""
Redis caching utilities for market data.
Implements caching layer between API and TimescaleDB.
"""
from django.core.cache import cache
import json
from datetime import timedelta


class CacheConfig:
    """Cache TTL configuration"""
    SYMBOLS_TTL = 3600  # 1 hour - symbols don't change often
    HISTORICAL_DATA_TTL = 300  # 5 minutes - OHLCV data
    HISTORICAL_DATA_LONG_TTL = 1800  # 30 minutes - older historical data (> 1 day old)


def get_symbols_cache_key():
    """Generate cache key for symbols list"""
    return "symbols:all"


def get_historical_data_cache_key(exchange, symbol, timeframe, limit, start_date=None, end_date=None):
    """
    Generate cache key for historical OHLCV data.

    Args:
        exchange: Exchange name (binance, zerodha)
        symbol: Trading pair symbol
        timeframe: Candlestick timeframe (1m, 5m, 1h, etc.)
        limit: Number of candles
        start_date: Optional start date
        end_date: Optional end date

    Returns:
        Cache key string
    """
    key_parts = [
        "historical",
        exchange.lower(),
        symbol.upper(),
        timeframe,
        str(limit)
    ]

    if start_date:
        key_parts.append(start_date.isoformat() if hasattr(start_date, 'isoformat') else str(start_date))
    if end_date:
        key_parts.append(end_date.isoformat() if hasattr(end_date, 'isoformat') else str(end_date))

    return ":".join(key_parts)


def cache_symbols(symbols_list, ttl=CacheConfig.SYMBOLS_TTL):
    """
    Cache symbols list in Redis.

    Args:
        symbols_list: List of symbol dictionaries
        ttl: Time to live in seconds

    Returns:
        True if cached successfully
    """
    try:
        cache_key = get_symbols_cache_key()
        cache.set(cache_key, symbols_list, ttl)
        return True
    except Exception as e:
        print(f"Error caching symbols: {e}")
        return False


def get_cached_symbols():
    """
    Retrieve symbols from Redis cache.

    Returns:
        List of symbols or None if cache miss
    """
    try:
        cache_key = get_symbols_cache_key()
        return cache.get(cache_key)
    except Exception as e:
        print(f"Error retrieving cached symbols: {e}")
        return None


def cache_historical_data(exchange, symbol, timeframe, limit, data, start_date=None, end_date=None, ttl=None):
    """
    Cache historical OHLCV data in Redis.

    Args:
        exchange: Exchange name
        symbol: Trading pair symbol
        timeframe: Candlestick timeframe
        limit: Number of candles
        data: OHLCV data dictionary to cache
        start_date: Optional start date
        end_date: Optional end date
        ttl: Time to live in seconds (auto-determined if None)

    Returns:
        True if cached successfully
    """
    try:
        # Auto-determine TTL based on data recency
        if ttl is None:
            ttl = CacheConfig.HISTORICAL_DATA_TTL

            # Use longer TTL for older data
            if data.get('stats') and data['stats'].get('last_timestamp'):
                from datetime import datetime, timezone
                last_timestamp = data['stats']['last_timestamp']
                if isinstance(last_timestamp, str):
                    try:
                        last_dt = datetime.fromisoformat(last_timestamp.replace('Z', '+00:00'))
                        now = datetime.now(timezone.utc)
                        age = now - last_dt

                        # If data is more than 1 day old, cache for longer
                        if age.total_seconds() > 86400:  # 24 hours
                            ttl = CacheConfig.HISTORICAL_DATA_LONG_TTL
                    except:
                        pass

        cache_key = get_historical_data_cache_key(exchange, symbol, timeframe, limit, start_date, end_date)
        cache.set(cache_key, data, ttl)
        return True
    except Exception as e:
        print(f"Error caching historical data: {e}")
        return False


def get_cached_historical_data(exchange, symbol, timeframe, limit, start_date=None, end_date=None):
    """
    Retrieve historical data from Redis cache.

    Args:
        exchange: Exchange name
        symbol: Trading pair symbol
        timeframe: Candlestick timeframe
        limit: Number of candles
        start_date: Optional start date
        end_date: Optional end date

    Returns:
        Cached data dictionary or None if cache miss
    """
    try:
        cache_key = get_historical_data_cache_key(exchange, symbol, timeframe, limit, start_date, end_date)
        return cache.get(cache_key)
    except Exception as e:
        print(f"Error retrieving cached historical data: {e}")
        return None


def invalidate_symbols_cache():
    """
    Invalidate (clear) symbols cache.
    Use when symbols are updated in the database.

    Returns:
        True if invalidated successfully
    """
    try:
        cache_key = get_symbols_cache_key()
        cache.delete(cache_key)
        return True
    except Exception as e:
        print(f"Error invalidating symbols cache: {e}")
        return False


def invalidate_historical_data_cache(exchange, symbol):
    """
    Invalidate all historical data cache for a specific symbol.
    Use when market data is updated.

    Args:
        exchange: Exchange name
        symbol: Trading pair symbol

    Returns:
        Number of keys deleted
    """
    try:
        # Pattern: historical:exchange:symbol:*
        pattern = f"historical:{exchange.lower()}:{symbol.upper()}:*"

        # Django's cache doesn't support pattern deletion directly
        # We'll need to use django-redis client for this
        from django_redis import get_redis_connection
        redis_conn = get_redis_connection("default")

        keys = redis_conn.keys(pattern)
        if keys:
            return redis_conn.delete(*keys)
        return 0
    except Exception as e:
        print(f"Error invalidating historical data cache: {e}")
        return 0


def get_cache_stats():
    """
    Get Redis cache statistics.

    Returns:
        Dictionary with cache statistics
    """
    try:
        from django_redis import get_redis_connection
        redis_conn = get_redis_connection("default")

        info = redis_conn.info('stats')

        return {
            'total_keys': redis_conn.dbsize(),
            'hits': info.get('keyspace_hits', 0),
            'misses': info.get('keyspace_misses', 0),
            'hit_rate': (info.get('keyspace_hits', 0) /
                        (info.get('keyspace_hits', 0) + info.get('keyspace_misses', 1)) * 100)
        }
    except Exception as e:
        print(f"Error getting cache stats: {e}")
        return {}
