# Historical Data Implementation Summary

## Overview

The Historical Data feature has been implemented to work with the actual TimescaleDB structure used by the CryptoMarketData microservice. It now correctly queries data from the `market_data_dev1` database using the proper table naming conventions.

## Database Structure

### Symbol Tables

1. **Binance Symbols**: `binance_symbols`
   - Columns: symbol, base_asset, quote_asset, status
   - Used for Binance trading pairs

2. **Zerodha Symbols**: `symbols`
   - Columns: exchange, symbol, base_asset, quote_asset, active, priority
   - Filtered by `exchange = 'zerodha'`

### Historical Data Tables

Format: `<exchange>_<symbol>_kline_1m`

Examples:
- `binance_BTCUSDT_kline_1m`
- `binance_ETHUSDT_kline_1m`
- `zerodha_SBIN_kline_1m`

Each table contains:
- `open_time` (timestamp)
- `open` (decimal)
- `high` (decimal)
- `low` (decimal)
- `close` (decimal)
- `volume` (decimal)

All data is stored as **1-minute candles** (1m klines).

## Implementation Details

### 1. Symbol Fetching (`get_symbols_from_timescale()`)

Location: `home/views.py`

**Functionality:**
- Queries `binance_symbols` table for Binance symbols
- Queries `symbols` table for Zerodha symbols (where exchange='zerodha')
- Combines both into a unified list
- Filters for active/trading symbols only

**Returns:**
```python
[
    {
        'exchange': 'binance',
        'symbol': 'BTCUSDT',
        'base_asset': 'BTC',
        'quote_asset': 'USDT',
        'active': True,
        'priority': 1
    },
    ...
]
```

### 2. Historical Data API (`HistoricalDataAPIView`)

Location: `home/historical_data_view.py`

**Key Features:**

1. **Dynamic Table Query**
   - Constructs table name: `{exchange}_{symbol}_kline_1m`
   - Example: `binance_BTCUSDT_kline_1m`

2. **Timeframe Aggregation**
   - All data stored as 1-minute candles
   - API aggregates on-demand for larger timeframes:
     - 5m: Groups 5 x 1m candles
     - 15m: Groups 15 x 1m candles
     - 1h: Groups 60 x 1m candles
     - 4h: Groups 240 x 1m candles
     - 1d: Groups 1440 x 1m candles

3. **Aggregation Logic**
   - **Open**: First candle's open price in the bucket
   - **High**: Maximum high across all candles in the bucket
   - **Low**: Minimum low across all candles in the bucket
   - **Close**: Last candle's close price in the bucket
   - **Volume**: Sum of all volumes in the bucket

4. **Query Optimization**
   - Fetches `limit * timeframe_minutes` raw 1m candles
   - Example: For 100 x 1h candles, fetches 6000 x 1m candles
   - Aggregates and returns exactly `limit` candles

5. **Error Handling**
   - Returns 404 if table doesn't exist (symbol has no data)
   - Graceful handling of missing date ranges
   - Database connection error handling

### 3. Frontend Component

Location: `frontend/src/components/HistoricalData.js`

**Features:**
- Exchange selector (Binance/Zerodha)
- Symbol dropdown (dynamically filtered by exchange)
- Timeframe selector (1m to 1d)
- Date range filters (optional)
- Limit control (1-5000 candles)
- Statistics dashboard (count, min/max, change %)
- OHLCV data table with color-coded price changes

## API Usage Examples

### Example 1: Get Last 100 Hourly Candles

```bash
GET /api/historical/data?exchange=binance&symbol=BTCUSDT&timeframe=1h&limit=100
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exchange": "binance",
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "ohlcv": [
      {
        "timestamp": "2024-01-01T00:00:00",
        "open": 42000.50,
        "high": 42500.00,
        "low": 41800.00,
        "close": 42300.75,
        "volume": 125.5
      },
      ...
    ],
    "stats": {
      "count": 100,
      "first_timestamp": "2024-01-01T00:00:00",
      "last_timestamp": "2024-01-05T03:00:00",
      "min_price": 41500.00,
      "max_price": 43200.00,
      "price_change": 300.25,
      "price_change_percent": 0.72
    }
  }
}
```

### Example 2: Get 1-Minute Data for Specific Date Range

```bash
GET /api/historical/data?exchange=binance&symbol=ETHUSDT&timeframe=1m&start_date=2024-01-01T00:00:00&end_date=2024-01-01T01:00:00
```

### Example 3: Get Daily Candles for Zerodha Symbol

```bash
GET /api/historical/data?exchange=zerodha&symbol=SBIN&timeframe=1d&limit=30
```

## Configuration

### Environment Variables

Update your `.env` file:

```bash
TIMESCALE_HOST=localhost
TIMESCALE_PORT=5432
TIMESCALE_DB=market_data_dev1  # Changed from market_data
TIMESCALE_USER=postgres
TIMESCALE_PASSWORD=your_password
```

### Prerequisites

1. **TimescaleDB Running**
   - Database: `market_data_dev1`
   - Port: 5432 (default)

2. **Tables Must Exist**
   - `binance_symbols` - Populated by CryptoMarketData
   - `symbols` - Contains Zerodha symbols
   - `<exchange>_<symbol>_kline_1m` - One per symbol with historical data

3. **CryptoMarketData Microservice**
   - Should be running and populating data
   - Located one level up from CryptoWebServer

## Testing

### 1. Test Symbol Fetching

```bash
curl http://localhost:8000/api/backtest/symbols
```

Should return symbols from both exchanges.

### 2. Test Historical Data

```bash
# Test Binance
curl "http://localhost:8000/api/historical/data?exchange=binance&symbol=BTCUSDT&timeframe=1h&limit=10"

# Test Zerodha
curl "http://localhost:8000/api/historical/data?exchange=zerodha&symbol=SBIN&timeframe=1d&limit=10"
```

### 3. Test Aggregation

```bash
# Get 1-minute data
curl "http://localhost:8000/api/historical/data?symbol=BTCUSDT&timeframe=1m&limit=60"

# Get same period as 1-hour (should show 1 aggregated candle)
curl "http://localhost:8000/api/historical/data?symbol=BTCUSDT&timeframe=1h&limit=1"
```

## Troubleshooting

### Error: "Table not found"

**Cause**: The symbol doesn't have a kline table in TimescaleDB.

**Solution**:
- Check if CryptoMarketData has collected data for this symbol
- Verify table exists: `SELECT * FROM binance_BTCUSDT_kline_1m LIMIT 1;`

### Error: "Database error: password authentication failed"

**Cause**: Incorrect database credentials.

**Solution**:
- Update `.env` with correct `TIMESCALE_PASSWORD`
- Ensure database name is `market_data_dev1`

### Error: "No data found"

**Cause**: Date range contains no data.

**Solution**:
- Check available date range: `SELECT MIN(open_time), MAX(open_time) FROM binance_BTCUSDT_kline_1m;`
- Adjust date filters or remove them

### Empty Symbol List

**Cause**: Symbol tables don't exist or are empty.

**Solution**:
- Verify `binance_symbols` table exists and has data
- Verify `symbols` table has Zerodha entries
- Ensure CryptoMarketData microservice has run

## Performance Considerations

1. **Large Timeframe Requests**
   - Requesting 1000 daily candles fetches 1,440,000 x 1m candles
   - Keep limits reasonable (≤500 for daily, ≤1000 for hourly)

2. **Date Range Queries**
   - Indexed on `open_time` for fast filtering
   - Use date ranges to limit data scanned

3. **Caching** (Future Enhancement)
   - Consider caching aggregated results
   - Cache popular symbol/timeframe combinations

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live data
2. **Chart Visualization**: Add Plotly/Chart.js candlestick charts
3. **Technical Indicators**: Calculate indicators (RSI, MACD, etc.) on-demand
4. **Data Export**: CSV/JSON download functionality
5. **Caching Layer**: Redis cache for frequently accessed data
