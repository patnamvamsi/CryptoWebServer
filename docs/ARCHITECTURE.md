# CryptoWebServer Architecture

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Data Sources & Flow                          │
└─────────────────────────────────────────────────────────────────┘

MARKET DATA FLOW (Historical & Real-time prices):
════════════════════════════════════════════════════════════════

1. PRIMARY SOURCE: TimescaleDB (market_data_dev1)
   ├── Binance Symbols: binance_symbols table
   ├── Zerodha Symbols: symbols table
   └── OHLCV Data: <exchange>_<symbol>_kline_1m tables

2. CACHING LAYER: Redis
   ├── Cache frequently accessed symbols
   ├── Cache recent OHLCV data
   └── TTL-based expiration

3. LIVE DATA (when needed): WebSocket / Kafka
   ├── Binance WebSocket: wss://stream.binance.com:9443
   ├── Zerodha WebSocket: Kite Connect ticker
   └── Kafka: Real-time market events


USER ACCOUNT DATA FLOW (Portfolios & Balances):
════════════════════════════════════════════════════════════════

1. BINANCE API (python-binance)
   ├── User wallet balances
   ├── Account permissions
   └── API: ba.get_binance_positions()

2. ZERODHA API (kiteconnect)
   ├── User holdings (long-term equity)
   ├── User positions (intraday/F&O)
   ├── Account info
   └── API: za.get_zerodha_positions(), za.get_zerodha_holdings()


BACKTESTING DATA FLOW:
════════════════════════════════════════════════════════════════

1. Submit backtest → CryptoTAEngine microservice
2. TA Engine queries TimescaleDB for historical data
3. Results stored in TA Engine database
4. CryptoWebServer caches metadata in Django DB


┌─────────────────────────────────────────────────────────────────┐
│                     Service Architecture                         │
└─────────────────────────────────────────────────────────────────┘

┌────────────────┐
│  Web Browser   │
└───────┬────────┘
        │
        ▼
┌────────────────────────────────┐
│    CryptoWebServer (Django)    │
│    - REST API                  │
│    - React Frontend            │
│    - User Auth                 │
└───┬───────────┬────────────┬───┘
    │           │            │
    ▼           ▼            ▼
┌─────────┐ ┌──────────┐ ┌─────────────┐
│  Redis  │ │TimescaleDB│ │External APIs│
│  Cache  │ │market_data│ │(Account Only)│
└─────────┘ │  _dev1    │ └─────────────┘
            └─────┬─────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
┌──────────────────┐ ┌──────────────┐
│CryptoMarketData  │ │CryptoTAEngine│
│  Microservice    │ │ Microservice │
│  (Data Collector)│ │ (Backtesting)│
└──────────────────┘ └──────────────┘


## Data Access Rules

### ✅ CORRECT: Market Data from TimescaleDB

```python
# Historical OHLCV data
cursor.execute("""
    SELECT open_time, open, high, low, close, volume
    FROM binance_BTCUSDT_kline_1m
    WHERE open_time >= %s AND open_time <= %s
""", [start_date, end_date])

# Symbol list
cursor.execute("SELECT * FROM binance_symbols WHERE status = 'TRADING'")
```

### ❌ INCORRECT: Market Data from Direct APIs

```python
# DON'T DO THIS for market data:
client = Client(api_key, api_secret)
klines = client.get_historical_klines("BTCUSDT", "1h", "1 Jan, 2024")  # ❌

# DON'T DO THIS for market data:
response = requests.get("https://api.binance.com/api/v3/klines")  # ❌
```

### ✅ CORRECT: Account Data from Direct APIs

```python
# User's wallet balances
balances = ba.get_binance_positions()  # ✅

# User's portfolio
holdings = za.get_zerodha_holdings()  # ✅
```

## Redis Caching Strategy

### Cache Keys

```
# Symbol lists (TTL: 1 hour)
symbols:binance → List[Symbol]
symbols:zerodha → List[Symbol]

# Recent OHLCV data (TTL: 1 minute for 1m candles, 1 hour for daily)
ohlcv:binance:BTCUSDT:1h:latest100 → List[OHLCV]
ohlcv:zerodha:SBIN:1d:latest30 → List[OHLCV]

# Statistics (TTL: 5 minutes)
stats:binance:BTCUSDT:24h → {high, low, volume, change}
```

### Cache Invalidation

- **Symbols**: Refresh every 1 hour (symbols don't change often)
- **1m candles**: TTL 1 minute (near real-time)
- **Hourly candles**: TTL 5 minutes
- **Daily candles**: TTL 1 hour
- **Manual flush**: When CryptoMarketData updates database

## Live Data (Future Implementation)

### When to Use WebSocket/Kafka

1. **Real-time price updates** on UI
2. **Live order book** display
3. **Trade notifications**
4. **Market alerts** and triggers

### WebSocket Implementation (Future)

```python
# Binance WebSocket
from binance.websocket import BinanceSocketManager

def process_message(msg):
    # Update Redis cache
    # Broadcast to frontend via Django Channels

bm = BinanceSocketManager(client)
bm.start_kline_socket('BTCUSDT', process_message, interval='1m')
```

### Kafka Implementation (Future)

```python
# Consume market events from CryptoMarketData
from kafka import KafkaConsumer

consumer = KafkaConsumer('market-data-events')
for message in consumer:
    # Update Redis
    # Notify WebSocket clients
```

## Data Freshness Guarantees

| Data Type | Source | Max Age | Update Frequency |
|-----------|--------|---------|------------------|
| 1m Candles | TimescaleDB→Redis | 1 minute | CryptoMarketData polls every 1m |
| Hourly Candles | TimescaleDB→Redis | 1 hour | Aggregated on-demand |
| Daily Candles | TimescaleDB→Redis | 1 day | Aggregated on-demand |
| Symbol Lists | TimescaleDB→Redis | 1 hour | Manual refresh |
| Account Balances | Direct API | Real-time | On-demand per request |
| Live Prices | WebSocket (future) | Real-time | Pushed via WebSocket |

## Performance Optimization

### Query Optimization

1. **Use Redis first**: Check cache before querying TimescaleDB
2. **Batch queries**: Fetch multiple symbols in one query
3. **Limit results**: Default to 100 candles, max 5000
4. **Index usage**: TimescaleDB indexed on `open_time`

### Caching Strategy

```python
def get_ohlcv_data(exchange, symbol, timeframe, limit):
    # 1. Check Redis cache
    cache_key = f"ohlcv:{exchange}:{symbol}:{timeframe}:latest{limit}"
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # 2. Query TimescaleDB
    data = query_timescale(exchange, symbol, timeframe, limit)
    
    # 3. Cache result
    ttl = get_ttl_for_timeframe(timeframe)
    redis.setex(cache_key, ttl, json.dumps(data))
    
    return data
```

## Error Handling

### TimescaleDB Unavailable
- Fallback to Redis cached data (stale but available)
- Return last known good data with timestamp
- Alert monitoring system

### Redis Unavailable
- Continue with direct TimescaleDB queries (slower but functional)
- Log degraded performance mode

### Symbol Not Found
- Return 404 with clear message
- Suggest similar symbols
- Check if symbol is delisted
