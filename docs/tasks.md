# CryptoWebServer - Development Tasks & Roadmap

**Last Updated:** 2025-12-29
**Status:** In Progress - Real-time Price Updates Implementation

---

## 🔄 IN PROGRESS

### Real-Time Price Updates (WebSocket Implementation)

**Status:** Backend Complete, Frontend Integration In Progress

**What's Been Done:**
- ✅ Installed Django Channels and dependencies (`channels`, `channels-redis`, `websockets`)
- ✅ Created `CryptoWebServer/asgi.py` for ASGI application support
- ✅ Configured Channel Layers with Redis backend in `settings.py`
- ✅ Created WebSocket consumers in `home/consumers.py`:
  - `BinancePriceConsumer` - Connects to Binance WebSocket API and streams ticker data
  - `ZerodhaPriceConsumer` - Placeholder for Zerodha KiteTicker integration
  - `AllPricesConsumer` - Combined multi-exchange consumer
- ✅ Set up WebSocket routing in `home/routing.py`
- ✅ Created reusable React hook `frontend/src/hooks/useWebSocket.js`
- ✅ Updated `HistoricalData.js` with WebSocket integration (Live toggle button)
- ✅ Updated `BinancePositions.js` with live price display
- ✅ Built frontend with WebSocket support

**WebSocket Endpoints:**
```
ws://localhost:8000/ws/prices/binance/   # Binance ticker streams
ws://localhost:8000/ws/prices/zerodha/   # Zerodha price streams (placeholder)
ws://localhost:8000/ws/prices/all/       # All exchanges combined
```

**Current Issues:**
1. **Live button not visible on Historical Data page**
   - Component updated but button may not be rendering
   - Need to verify button placement in JSX
   - Check if component is re-bundled correctly

2. **Live Prices not working in Binance Portfolio**
   - Button is present but prices not updating
   - Need to verify WebSocket connection is established
   - Check browser console for connection errors
   - Verify Django is running in ASGI mode (supports WebSockets)

**Next Steps:**
1. **Debug Frontend Issues**
   - Verify button visibility in HistoricalData.js
   - Check browser console for WebSocket connection errors
   - Confirm Django server supports WebSocket connections
   - Test with browser DevTools Network tab (WS tab)

2. **Server Configuration**
   - Switch from `python manage.py runserver` to Daphne or Uvicorn
   - Command: `daphne -p 8000 CryptoWebServer.asgi:application`
   - Or: `uvicorn CryptoWebServer.asgi:application --host 0.0.0.0 --port 8000`

3. **Testing Checklist**
   - [ ] Verify Redis is running (`redis-cli ping`)
   - [ ] Start Django with ASGI server (Daphne)
   - [ ] Open browser DevTools → Network → WS tab
   - [ ] Navigate to Historical Data page
   - [ ] Look for WebSocket connection attempt
   - [ ] Check console for any JavaScript errors
   - [ ] Click Live button and verify subscription message sent

---

## 📋 REMAINING TASKS

### 1. Complete WebSocket Implementation Testing

**Priority:** HIGH
**Estimated Time:** 2-3 hours

**Tasks:**
- [ ] Fix button visibility issues in frontend
- [ ] Verify WebSocket connections establish correctly
- [ ] Test Binance price streaming with real symbols
- [ ] Add error handling for connection failures
- [ ] Add reconnection visual feedback
- [ ] Test with multiple browser tabs

**Technical Details:**
- WebSocket connections require ASGI server (Daphne or Uvicorn)
- Django's `runserver` has limited WebSocket support
- Redis must be running for Channel Layers to work
- Frontend connects to `ws://` or `wss://` depending on protocol

**Troubleshooting:**
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Install ASGI server
pip install daphne

# Run Django with WebSocket support
daphne -p 8000 CryptoWebServer.asgi:application

# Check WebSocket connection in browser
# DevTools → Network → WS tab → Should see connection to /ws/prices/binance/
```

---

### 2. Implement Zerodha Real-Time Updates

**Priority:** MEDIUM
**Estimated Time:** 4-6 hours

**Context:**
Zerodha uses KiteTicker, a synchronous library that requires:
- Valid access token (expires after 24 hours)
- Instrument tokens (not symbol names)
- Running in a separate thread to avoid blocking asyncio

**Current Status:**
- Placeholder consumer exists (`ZerodhaPriceConsumer`)
- Needs KiteTicker integration
- Requires thread-safe communication between KiteTicker and async consumer

**Implementation Approach:**

1. **Create Zerodha Ticker Manager** (`app/zerodha_ticker_manager.py`):
```python
from kiteconnect import KiteTicker
import asyncio
from channels.layers import get_channel_layer

class ZerodhaTickerManager:
    def __init__(self, api_key, access_token):
        self.kws = KiteTicker(api_key, access_token)
        self.channel_layer = get_channel_layer()

        # Set up callbacks
        self.kws.on_ticks = self.on_ticks
        self.kws.on_connect = self.on_connect
        self.kws.on_close = self.on_close

    def on_ticks(self, ws, ticks):
        # Forward ticks to WebSocket consumers via Channel Layer
        for tick in ticks:
            asyncio.run(self.channel_layer.group_send(
                'zerodha_prices',
                {
                    'type': 'price_update',
                    'data': tick
                }
            ))

    def start(self, tokens):
        self.kws.connect(threaded=True)
        self.kws.subscribe(tokens)
        self.kws.set_mode(self.kws.MODE_FULL, tokens)
```

2. **Update `ZerodhaPriceConsumer`**:
```python
async def connect(self):
    await self.channel_layer.group_add('zerodha_prices', self.channel_name)
    await self.accept()

async def price_update(self, event):
    # Receive from channel layer and send to WebSocket
    await self.send(text_data=json.dumps(event['data']))
```

3. **Handle Token Mapping**:
   - Zerodha uses instrument tokens (integers), not symbols
   - Need to maintain mapping: symbol → token
   - Query from `symbols` table in TimescaleDB
   - Send token list from frontend instead of symbol names

4. **Token Refresh**:
   - Access token expires after 24 hours
   - Need to handle token expiration gracefully
   - Reconnect KiteTicker when token refreshed

**Tasks:**
- [ ] Create `ZerodhaTickerManager` class
- [ ] Integrate with `ZerodhaPriceConsumer`
- [ ] Add symbol-to-token mapping utility
- [ ] Handle token expiration and refresh
- [ ] Update frontend to send instrument tokens
- [ ] Test with real Zerodha account
- [ ] Add error handling for KiteTicker failures

---

### 3. Add WebSocket Monitoring & Debugging

**Priority:** MEDIUM
**Estimated Time:** 2-3 hours

**Features to Add:**

1. **Connection Status Indicator**
   - Show WebSocket connection state in UI
   - Display reconnection attempts
   - Show last update timestamp

2. **Debug Panel** (Development Only):
   - Show received messages
   - Display subscription list
   - Show connection statistics (uptime, messages received)

3. **Logging**:
```python
# Add to consumers.py
import logging
logger = logging.getLogger(__name__)

logger.info(f"WebSocket connected: {self.channel_name}")
logger.debug(f"Received price update: {data}")
logger.error(f"Connection error: {error}")
```

4. **Health Check Endpoint**:
```python
# home/views.py
class WebSocketHealthAPIView(APIView):
    def get(self, request):
        # Check if channel layer is working
        # Check if Redis is accessible
        # Return connection statistics
        pass
```

**Tasks:**
- [ ] Add connection status to all components using WebSocket
- [ ] Create debug panel component
- [ ] Implement comprehensive logging
- [ ] Add health check endpoint
- [ ] Create monitoring dashboard (admin view)

---

### 4. Performance Optimization

**Priority:** LOW-MEDIUM
**Estimated Time:** 3-4 hours

**Optimizations:**

1. **Message Throttling**:
   - Binance sends updates very frequently (~1/second per symbol)
   - Throttle updates to max 1 update per 500ms on frontend
   - Use debouncing to reduce chart redraws

2. **Selective Subscriptions**:
   - Only subscribe to visible symbols
   - Unsubscribe when switching symbols
   - Batch subscription requests

3. **Memory Management**:
   - Limit price history in memory (keep last 100 updates)
   - Clean up old subscriptions
   - Properly dispose of chart instances

4. **Backend Optimization**:
   - Connection pooling for Redis
   - Limit concurrent WebSocket connections per user
   - Add rate limiting to prevent abuse

**Implementation:**
```javascript
// Throttle price updates
import { throttle } from 'lodash';

const throttledUpdate = throttle((price) => {
  updateChart(price);
}, 500);

useEffect(() => {
  if (lastMessage && lastMessage.price) {
    throttledUpdate(lastMessage.price);
  }
}, [lastMessage]);
```

**Tasks:**
- [ ] Implement message throttling on frontend
- [ ] Add selective subscriptions
- [ ] Optimize memory usage
- [ ] Add connection limits
- [ ] Performance testing with many symbols

---

### 5. User Experience Enhancements

**Priority:** MEDIUM
**Estimated Time:** 2-3 hours

**Features:**

1. **Price Alerts** (when price reaches threshold):
```javascript
// Alert component
const PriceAlert = () => {
  const [alerts, setAlerts] = useState([]);

  // Check alerts against live prices
  useEffect(() => {
    if (lastMessage) {
      checkAlerts(lastMessage);
    }
  }, [lastMessage]);
};
```

2. **Sound Notifications**:
   - Play sound when price alert triggered
   - Configurable sounds for different alert types

3. **Desktop Notifications**:
```javascript
if (Notification.permission === 'granted') {
  new Notification('Price Alert', {
    body: 'BTC reached $50,000',
    icon: '/icon.png'
  });
}
```

4. **Live Order Book** (if needed):
   - Display bid/ask depth
   - Show recent trades
   - Visualize order book as chart

5. **Connection Status Banner**:
   - Show notification when WebSocket disconnects
   - Display "Reconnecting..." message
   - Show success when reconnected

**Tasks:**
- [ ] Implement price alert system
- [ ] Add sound notifications
- [ ] Add desktop notifications
- [ ] Create connection status banner
- [ ] User preference settings for notifications

---

### 6. Production Deployment

**Priority:** HIGH (Before Production)
**Estimated Time:** 4-6 hours

**Requirements:**

1. **ASGI Server Setup**:
```bash
# Install Daphne
pip install daphne

# Run with Daphne
daphne -b 0.0.0.0 -p 8000 CryptoWebServer.asgi:application

# Or with Uvicorn
pip install uvicorn
uvicorn CryptoWebServer.asgi:application --host 0.0.0.0 --port 8000 --workers 4
```

2. **Nginx Configuration** (WebSocket Proxy):
```nginx
upstream django {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://django;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws/ {
        proxy_pass http://django;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

3. **Supervisor Configuration** (Keep process running):
```ini
[program:cryptowebserver]
command=/home/vamsi/venv/bin/daphne -b 127.0.0.1 -p 8000 CryptoWebServer.asgi:application
directory=/home/vamsi/Dev/Projects/CryptoWebServer
user=vamsi
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/cryptowebserver.log
```

4. **Redis Configuration**:
   - Set up Redis persistence
   - Configure memory limits
   - Enable Redis authentication

5. **SSL/TLS** (for WSS - secure WebSockets):
   - Use Let's Encrypt for SSL certificates
   - Configure Nginx for HTTPS
   - Update frontend to use `wss://` instead of `ws://`

**Tasks:**
- [ ] Set up ASGI server (Daphne or Uvicorn)
- [ ] Configure Nginx reverse proxy
- [ ] Set up Supervisor for process management
- [ ] Configure Redis for production
- [ ] Set up SSL certificates
- [ ] Test WebSocket over WSS
- [ ] Load testing
- [ ] Set up monitoring (Prometheus/Grafana)

---

### 7. Documentation

**Priority:** MEDIUM
**Estimated Time:** 2-3 hours

**Documents to Create/Update:**

1. **WebSocket API Documentation**:
   - Document all WebSocket endpoints
   - Message format specifications
   - Authentication requirements (if added)
   - Example messages
   - Error codes and handling

2. **Frontend Integration Guide**:
   - How to use `useWebSocket` hook
   - Example components
   - Best practices
   - Troubleshooting common issues

3. **Deployment Guide**:
   - Step-by-step deployment instructions
   - Server requirements
   - Configuration examples
   - Security considerations

4. **Update ARCHITECTURE.md**:
   - Add WebSocket data flow diagram
   - Document Channel Layers architecture
   - Update microservices diagram

**Tasks:**
- [ ] Create `docs/WEBSOCKET_API.md`
- [ ] Create `docs/WEBSOCKET_DEPLOYMENT.md`
- [ ] Update `docs/ARCHITECTURE.md`
- [ ] Add inline code comments
- [ ] Create troubleshooting guide

---

## 🐛 KNOWN ISSUES

### Issue 1: Django runserver doesn't fully support WebSockets
**Impact:** HIGH
**Status:** Known limitation

**Description:**
Django's development server (`manage.py runserver`) has limited WebSocket support. Connections may work but can be unstable.

**Solution:**
Use Daphne or Uvicorn ASGI server instead:
```bash
pip install daphne
daphne -p 8000 CryptoWebServer.asgi:application
```

---

### Issue 2: Live button not visible on Historical Data page
**Impact:** HIGH
**Status:** Under investigation

**Description:**
User reports the "Live" toggle button is not visible on the Historical Data page despite being added to the code.

**Potential Causes:**
1. Frontend not rebuilt after changes
2. Component JSX structure issue
3. CSS hiding the button
4. Button placed outside visible area

**Investigation Steps:**
- [ ] Verify frontend was rebuilt (`npm run build`)
- [ ] Check browser console for errors
- [ ] Inspect element to see if button exists in DOM
- [ ] Check CSS for display/visibility issues
- [ ] Verify button placement in component JSX

---

### Issue 3: Live Prices not updating in Binance Portfolio
**Impact:** HIGH
**Status:** Under investigation

**Description:**
"Live Prices" button is visible but clicking it doesn't show live price updates.

**Potential Causes:**
1. WebSocket connection not establishing
2. Django not running in ASGI mode
3. Redis not running
4. Frontend not receiving messages
5. Subscription not being sent to backend

**Investigation Steps:**
- [ ] Check Redis is running: `redis-cli ping`
- [ ] Check Django server logs for WebSocket connection
- [ ] Open browser DevTools → Network → WS tab
- [ ] Look for WebSocket connection attempt
- [ ] Check console for JavaScript errors
- [ ] Verify subscription message is sent

**Debug Commands:**
```bash
# Terminal 1: Redis
redis-server

# Terminal 2: Django with Daphne
cd /home/vamsi/Dev/Projects/CryptoWebServer
daphne -p 8000 CryptoWebServer.asgi:application

# Browser: DevTools Console
# Should see: "Connecting to WebSocket: ws://localhost:8000/ws/prices/binance/"
# Should see: "WebSocket connected"
# Should see: "Subscribed to: ['BTCUSDT', 'ETHUSDT', ...]"
```

---

## 📅 FUTURE ENHANCEMENTS

### Phase 1: Core Features (1-2 weeks)
- [ ] Fix current WebSocket issues
- [ ] Complete Zerodha integration
- [ ] Add connection monitoring
- [ ] Performance optimization

### Phase 2: User Features (2-3 weeks)
- [ ] Price alert system
- [ ] Desktop notifications
- [ ] Sound notifications
- [ ] User preferences

### Phase 3: Advanced Features (3-4 weeks)
- [ ] Live order book visualization
- [ ] Trade execution via WebSocket
- [ ] Portfolio analytics dashboard
- [ ] Multi-user support with authentication

### Phase 4: Production (1-2 weeks)
- [ ] Production deployment
- [ ] Load testing
- [ ] Monitoring setup
- [ ] Documentation

---

## 🔗 RELATED DOCUMENTS

- [Project Analysis & Roadmap](PROJECT_ANALYSIS_AND_ROADMAP.md)
- [Architecture Documentation](ARCHITECTURE.md)
- [Historical Data Implementation](HISTORICAL_DATA_IMPLEMENTATION.md)
- [Redis Caching Implementation](REDIS_CACHING_IMPLEMENTATION.md)
- [TimescaleDB Setup](TIMESCALE_SETUP.md)

---

## 📝 NOTES

**WebSocket vs HTTP Polling:**
- WebSocket: Real-time, low latency, efficient for continuous updates
- HTTP Polling: Simple, works everywhere, higher latency, more overhead

**Why WebSocket?**
- Financial data changes rapidly
- Users need instant updates for trading decisions
- Reduces server load vs polling
- Better user experience

**Security Considerations:**
- Implement authentication for WebSocket connections
- Rate limiting to prevent abuse
- Input validation for subscription requests
- Monitor for DoS attacks

**Testing Checklist:**
1. ✅ Backend WebSocket consumers created
2. ✅ Frontend hook created
3. ✅ Components updated
4. ⏳ WebSocket connections establish
5. ⏳ Messages flow correctly
6. ⏳ UI updates in real-time
7. ⏳ Reconnection works
8. ⏳ Error handling works

---

**Last Updated:** 2025-12-29
**Next Review:** After fixing current WebSocket issues
