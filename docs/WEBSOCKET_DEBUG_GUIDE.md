# WebSocket Debugging Guide

**Date:** 2025-12-29

This guide helps you debug and test the WebSocket real-time price updates feature.

---

## 🐛 Issue #1: "Live" Button Not Visible on Historical Data Page

### Root Cause
The "Live" button only appears **AFTER** you fetch historical data. It's inside a conditional block:

```javascript
{data && data.ohlcv && data.ohlcv.length > 0 && (
  // Live button is here
)}
```

### How to See the Button

1. **Navigate to Historical Data page** (`http://localhost:8000/historical`)
2. **Select exchange, symbol, timeframe** (e.g., Binance, BTCUSDT, 1h)
3. **Click "Fetch Data" button**
4. **Wait for chart to load**
5. **Look for buttons below the chart** - You should now see:
   - Chart type buttons (📊 Chart, 📋 Table, 📊📋 Both)
   - Chart style buttons (Candlestick, Line, Area, Bars)
   - Indicator buttons (Volume, MA20, MA50, etc.)
   - **⚪ Live button** (between Pivots and Fullscreen buttons)

### Visual Location
```
[Pivots] [⚪ Live] [⛶ Fullscreen]
```

### Fix (Optional)
If you want the Live button visible even without data, move it outside the conditional block. However, this requires the chart to exist first for updates to work.

---

## 🐛 Issue #2: "Live Prices" Not Working in Binance Portfolio

### Root Cause
Django's `runserver` command does NOT fully support WebSocket connections. You need to use an ASGI server like Daphne.

### Step-by-Step Fix

#### Step 1: Install Daphne
```bash
cd /home/vamsi/Dev/Projects/CryptoWebServer
pip3 install daphne
```

#### Step 2: Make Sure Redis is Running
```bash
# Check if Redis is running
redis-cli ping
# Should output: PONG

# If not running, start Redis
redis-server
```

#### Step 3: Stop Django runserver
Press `Ctrl+C` if Django is running

#### Step 4: Start Django with Daphne
```bash
cd /home/vamsi/Dev/Projects/CryptoWebServer
daphne -b 0.0.0.0 -p 8000 CryptoWebServer.asgi:application
```

You should see:
```
2025-12-29 16:30:00 INFO     Starting server at tcp:port=8000:interface=0.0.0.0
2025-12-29 16:30:00 INFO     HTTP/2 support enabled
2025-12-29 16:30:00 INFO     Configuring endpoint tcp:port=8000:interface=0.0.0.0
2025-12-29 16:30:00 INFO     Listening on TCP address 0.0.0.0:8000
```

#### Step 5: Open Browser and Test
1. Navigate to `http://localhost:8000/binance` or `http://192.168.0.201:8000/binance`
2. **Open Browser DevTools** (F12 or Ctrl+Shift+I)
3. Go to **Console tab**
4. Click the **"🔴 Live Prices"** button

You should see console messages:
```
Connecting to WebSocket: ws://localhost:8000/ws/prices/binance/
WebSocket connected
Subscribed to: ['BTCUSDT', 'ETHUSDT', ...]
```

#### Step 6: Check Network Tab
1. **DevTools → Network tab**
2. **Click WS (WebSocket) filter**
3. You should see a connection to `/ws/prices/binance/`
4. **Click on the connection** to see messages flowing

Expected messages:
```json
{
  "exchange": "binance",
  "symbol": "BTCUSDT",
  "price": 43250.50,
  "change": -125.30,
  "changePercent": -0.29,
  "volume": 18234.5,
  "high": 43500.00,
  "low": 43100.00,
  "timestamp": 1704123456789
}
```

---

## 🔍 Debugging Checklist

### Backend Checks

- [ ] **Redis is running**
  ```bash
  redis-cli ping
  # Expected: PONG
  ```

- [ ] **Django running with Daphne (not runserver)**
  ```bash
  # Wrong:
  python manage.py runserver

  # Correct:
  daphne -p 8000 CryptoWebServer.asgi:application
  ```

- [ ] **Channel layers configured** in `settings.py`:
  ```python
  CHANNEL_LAYERS = {
      'default': {
          'BACKEND': 'channels_redis.core.RedisChannelLayer',
          'CONFIG': {
              "hosts": [(REDIS_HOST, int(REDIS_PORT))],
          },
      },
  }
  ```

- [ ] **ASGI application exists** at `CryptoWebServer/asgi.py`

- [ ] **WebSocket routing configured** at `home/routing.py`

- [ ] **Consumers exist** at `home/consumers.py`

### Frontend Checks

- [ ] **Frontend was rebuilt after changes**
  ```bash
  cd /home/vamsi/Dev/Projects/CryptoWebServer/frontend
  npm run build
  ```
  Check timestamp: `ls -lh static/frontend/main.js`

- [ ] **useWebSocket hook exists** at `frontend/src/hooks/useWebSocket.js`

- [ ] **Components import the hook**:
  ```javascript
  import useWebSocket from '../hooks/useWebSocket';
  ```

- [ ] **Browser console shows no errors**

- [ ] **WebSocket connection visible in Network → WS tab**

### Browser DevTools

1. **Open DevTools** (F12)

2. **Console Tab**:
   - Look for "Connecting to WebSocket..."
   - Look for "WebSocket connected"
   - Look for "Subscribed to: [...]"
   - Look for price update messages

3. **Network Tab → WS Filter**:
   - Should see connection to `/ws/prices/binance/`
   - Click connection → see messages
   - Green indicator = connected
   - Red indicator = disconnected/failed

4. **Application Tab → Storage**:
   - Check if any errors in storage
   - Clear cache if needed

---

## 🧪 Testing Steps

### Test 1: Basic WebSocket Connection

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Daphne
cd /home/vamsi/Dev/Projects/CryptoWebServer
daphne -p 8000 CryptoWebServer.asgi:application

# Browser: Open DevTools Console
# Navigate to: http://localhost:8000/binance
# Click: Live Prices button
# Expected: Console shows "WebSocket connected"
```

### Test 2: Subscription Message

```javascript
// In browser console, you should see:
"Subscribed to: ['BTCUSDT', 'ETHUSDT', ...]"

// This means frontend sent subscription request to backend
```

### Test 3: Price Updates

```javascript
// In browser console, you should see messages like:
{
  exchange: "binance",
  symbol: "BTCUSDT",
  price: 43250.50,
  changePercent: -0.29
}

// These are live price updates from Binance
```

### Test 4: UI Updates

1. **Click "Live Prices" button** - button turns green with red dot
2. **Wait 2-3 seconds**
3. **Look at the table** - "Price (USDT)" column should show prices
4. **Watch for updates** - prices should change every 1-2 seconds
5. **24h change %** should show in green/red

---

## 🚨 Common Errors & Solutions

### Error 1: "WebSocket connection failed"

**Cause:** Django not running in ASGI mode

**Solution:**
```bash
# Stop runserver, use Daphne instead
daphne -p 8000 CryptoWebServer.asgi:application
```

---

### Error 2: "Cannot connect to Redis"

**Cause:** Redis not running

**Solution:**
```bash
# Start Redis
redis-server

# Or start in background
redis-server --daemonize yes

# Check if running
redis-cli ping
```

---

### Error 3: No messages in Network → WS tab

**Cause:** WebSocket connection not establishing

**Check:**
1. Is Daphne running? (not runserver)
2. Is Redis running?
3. Is frontend built? (`npm run build`)
4. Any firewall blocking port 8000?

**Solution:**
```bash
# Restart everything
pkill redis-server
redis-server --daemonize yes
pkill -f daphne
daphne -p 8000 CryptoWebServer.asgi:application
```

---

### Error 4: "WebSocket connected" but no price updates

**Cause:** Subscription not being sent OR Binance WebSocket not connecting

**Debug:**
```bash
# Check Daphne logs for errors
# You should see something like:
# "Connected to Binance WebSocket: 2 symbols"
```

**Check browser console:**
```javascript
// Should see:
"Subscribed to: ['BTCUSDT', 'ETHUSDT']"

// If you see:
"WebSocket connected"
// But NOT "Subscribed to:"
// Then subscription message is not being sent
```

**Solution:**
- Check if positions loaded correctly
- Check if symbols array is not empty
- Try clicking Live Prices button after page fully loads

---

### Error 5: Prices show but don't update

**Cause:** Only getting one message, then connection stops

**Check Daphne logs:**
```
# Look for errors like:
ERROR: Exception in ASGI application
# or
ERROR: Connection closed
```

**Solution:**
- Check Binance API is accessible
- Check if rate limited by Binance
- Try subscribing to fewer symbols

---

## 📊 Expected Output

### Terminal (Daphne Logs)

```
INFO Starting server at tcp:port=8000:interface=0.0.0.0
INFO Listening on TCP address 0.0.0.0:8000
INFO WebSocket HANDSHAKING /ws/prices/binance/ [127.0.0.1:54321]
INFO WebSocket CONNECT /ws/prices/binance/ [127.0.0.1:54321]
INFO Binance WebSocket consumer connected
INFO Connected to Binance WebSocket: 5 symbols
```

### Browser Console

```
Connecting to WebSocket: ws://localhost:8000/ws/prices/binance/
WebSocket connected
Subscribed to: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']
[binance] BTCUSDT: $43250.50 (+0.25%)
[binance] ETHUSDT: $2280.30 (-0.15%)
[binance] BNBUSDT: $315.40 (+1.20%)
```

### Network Tab (WS)

```
Name: binance/
Status: 101 Switching Protocols
Type: websocket

Messages:
← {"status": "connected", "exchange": "binance"}
→ {"action": "subscribe", "symbols": ["BTCUSDT", "ETHUSDT"]}
← {"status": "subscribed", "symbols": ["BTCUSDT", "ETHUSDT"]}
← {"exchange": "binance", "symbol": "BTCUSDT", "price": 43250.50, ...}
← {"exchange": "binance", "symbol": "ETHUSDT", "price": 2280.30, ...}
...
```

---

## 🔧 Manual Testing with WebSocket Client

If browser testing doesn't work, test backend directly:

### Install wscat (WebSocket CLI client)

```bash
npm install -g wscat
```

### Test WebSocket Connection

```bash
# Connect to WebSocket endpoint
wscat -c ws://localhost:8000/ws/prices/binance/

# You should see:
Connected (press CTRL+C to quit)
< {"status":"connected","exchange":"binance"}

# Send subscription request
> {"action":"subscribe","symbols":["BTCUSDT"]}

# You should see:
< {"status":"subscribed","symbols":["BTCUSDT"]}
< {"exchange":"binance","symbol":"BTCUSDT","price":43250.50,...}
< {"exchange":"binance","symbol":"BTCUSDT","price":43251.20,...}
...
```

---

## 📝 Quick Start Script

Save this as `test_websocket.sh`:

```bash
#!/bin/bash

echo "=== WebSocket Test Script ==="

# Check Redis
echo "1. Checking Redis..."
redis-cli ping || { echo "❌ Redis not running! Start with: redis-server"; exit 1; }
echo "✅ Redis is running"

# Check if Daphne is installed
echo "2. Checking Daphne..."
python3 -c "import daphne" 2>/dev/null || { echo "❌ Daphne not installed! Install with: pip3 install daphne"; exit 1; }
echo "✅ Daphne is installed"

# Check if channels is installed
echo "3. Checking Django Channels..."
python3 -c "import channels" 2>/dev/null || { echo "❌ Channels not installed! Install with: pip3 install channels channels-redis"; exit 1; }
echo "✅ Django Channels is installed"

# Check frontend build
echo "4. Checking frontend build..."
if [ -f "frontend/static/frontend/main.js" ]; then
    echo "✅ Frontend built"
    echo "   Size: $(du -h frontend/static/frontend/main.js | cut -f1)"
    echo "   Modified: $(stat -c %y frontend/static/frontend/main.js | cut -d' ' -f1-2)"
else
    echo "❌ Frontend not built! Run: cd frontend && npm run build"
    exit 1
fi

echo ""
echo "✅ All checks passed!"
echo ""
echo "To start the server:"
echo "  daphne -p 8000 CryptoWebServer.asgi:application"
echo ""
echo "Then open: http://localhost:8000/binance"
echo "And click: 🔴 Live Prices"
```

Make it executable and run:
```bash
chmod +x test_websocket.sh
./test_websocket.sh
```

---

## 🎯 Success Criteria

You know WebSockets are working when:

1. ✅ Daphne starts without errors
2. ✅ Browser console shows "WebSocket connected"
3. ✅ Network tab shows WS connection with green indicator
4. ✅ Messages appear in WS connection frames
5. ✅ Prices display in the table
6. ✅ Prices update every 1-2 seconds
7. ✅ 24h change % shows in colors (green/red)
8. ✅ No errors in browser console
9. ✅ No errors in Daphne terminal

---

## 📞 Still Not Working?

If you've followed all steps and it still doesn't work:

1. **Check browser console for errors** - paste them here
2. **Check Daphne logs** - look for errors or connection messages
3. **Try a different browser** - test in Chrome/Firefox/Edge
4. **Clear browser cache** - Ctrl+F5
5. **Check firewall** - make sure port 8000 is open
6. **Try localhost instead of IP** - or vice versa
7. **Restart everything** - Redis, Daphne, browser

**Debug command:**
```bash
# Run this and share the output
echo "=== System Info ==="
redis-cli ping
python3 -c "import channels; print('Channels:', channels.__version__)"
python3 -c "import daphne; print('Daphne:', daphne.__version__)"
ls -lh frontend/static/frontend/main.js
echo ""
echo "=== Test connection ==="
curl -v http://localhost:8000/ 2>&1 | grep "HTTP"
```

---

**Last Updated:** 2025-12-29
