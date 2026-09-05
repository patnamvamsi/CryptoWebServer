# Docker + WebSocket Setup Guide

**Last Updated:** 2025-12-29

This document explains the Docker configuration changes made to enable WebSocket support for real-time price updates.

---

## 🔄 Changes Made

### 1. Updated Dockerfile

**File:** `/home/vamsi/Dev/Projects/CryptoWebServer/Dockerfile`

**Changed:**
```dockerfile
# OLD (Django runserver - no WebSocket support)
CMD ["python","/CryptoWebServer/manage.py", "runserver","0.0.0.0:8000"]

# NEW (Daphne ASGI server - full WebSocket support)
# Collect static files before starting server
RUN python manage.py collectstatic --noinput
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "CryptoWebServer.asgi:application"]
```

**Why:**
- Django's `runserver` does NOT support WebSocket connections. Daphne is an ASGI server that fully supports HTTP, HTTP/2, and WebSocket protocols.
- Daphne does NOT serve static files automatically. We use WhiteNoise middleware to serve static files (CSS, JS).
- `collectstatic` gathers all static files into a single directory that WhiteNoise can serve.

### 2. Updated requirements.txt

**File:** `/home/vamsi/Dev/Projects/CryptoWebServer/requirements.txt`

**Added:**
- `daphne` - ASGI server for WebSocket support
- `channels` - Django Channels for WebSocket handling
- `channels-redis` - Redis backend for Channel Layers
- `websockets` - WebSocket client library
- `whitenoise` - Static file serving middleware for production

### 3. Updated settings.py for Static Files

**File:** `/home/vamsi/Dev/Projects/CryptoWebServer/CryptoWebServer/settings.py`

**Added WhiteNoise middleware:**
```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Serve static files with Daphne/ASGI
    # ... rest of middleware
]
```

**Configured static file settings:**
```python
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# WhiteNoise configuration for serving static files with Daphne/ASGI
WHITENOISE_USE_FINDERS = True
WHITENOISE_AUTOREFRESH = True if DEBUG else False
```

**Why:** Daphne (ASGI server) does not automatically serve static files like Django's development server. WhiteNoise middleware allows serving static files (CSS, JS, images) directly from Django without needing nginx.

### 4. Updated docker-compose.yml

**File:** `/home/vamsi/Dev/Projects/docker-compose.yml`

**Changed:** Added comment to webserver service:
```yaml
# Web Server (API Gateway + WebSocket Support)
# NOTE: Uses Daphne ASGI server for WebSocket real-time price updates
```

No other changes needed - Redis is already configured and connected.

---

## 🚀 How to Rebuild & Deploy

### Option 1: Rebuild ALL Services (Recommended First Time)

```bash
cd /home/vamsi/Dev/Projects
./start-all.sh --build
```

This will:
- Rebuild Docker image for webserver (installs Daphne)
- Rebuild all other services
- Start all services with WebSocket support

### Option 2: Rebuild ONLY WebServer (Faster)

```bash
cd /home/vamsi/Dev/Projects
./start-all.sh --build --service webserver
```

This will:
- Rebuild ONLY the webserver Docker image
- Keep other services running
- Restart webserver with Daphne

### Option 3: Force Clean Rebuild (Troubleshooting)

```bash
cd /home/vamsi/Dev/Projects
./start-all.sh --force-build --service webserver
```

This will:
- Force rebuild without Docker cache
- Ensures clean installation of all dependencies
- Use if you have build issues

---

## ✅ Verify WebSocket is Working

### Step 1: Check Containers are Running

```bash
docker ps
```

You should see:
```
CONTAINER ID   IMAGE                  STATUS         PORTS                    NAMES
xxxxx          cryptowebserver...     Up 2 minutes   0.0.0.0:8000->8000/tcp   vritti-webserver
xxxxx          redis:7-alpine         Up 2 minutes   0.0.0.0:6379->6379/tcp   vritti-redis
...
```

### Step 2: Check Daphne is Running

```bash
docker logs vritti-webserver
```

You should see:
```
INFO Starting server at tcp:port=8000:interface=0.0.0.0
INFO HTTP/2 support enabled
INFO Configuring endpoint tcp:port=8000:interface=0.0.0.0
INFO Listening on TCP address 0.0.0.0:8000
```

**NOT:**
```
Watching for file changes with StatReloader  # This means runserver (wrong!)
```

### Step 3: Test WebSocket Connection

**From Browser:**

1. Navigate to `http://localhost:8000/binance` or `http://192.168.0.201:8000/binance`
2. Open DevTools (F12) → Console tab
3. Click "🔴 Live Prices" button

**Expected Console Output:**
```
Connecting to WebSocket: ws://localhost:8000/ws/prices/binance/
WebSocket connected
Subscribed to: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']
[binance] BTCUSDT: $43250.50 (+0.25%)
```

**Check Network Tab:**
- DevTools → Network → WS filter
- Should see green connection to `/ws/prices/binance/`
- Messages flowing

### Step 4: Check Redis Connection

```bash
docker exec -it vritti-redis redis-cli ping
```

Expected output: `PONG`

---

## 🔍 Troubleshooting

### Issue 1: WebSocket Connection Refused

**Symptom:** Browser console shows "WebSocket connection failed"

**Check:**
```bash
# Check if Daphne is running (not runserver)
docker logs vritti-webserver | grep "Starting server"
# Should see: "Starting server at tcp:port=8000"

# If you see "Watching for file changes" - Dockerfile wasn't updated
```

**Fix:**
```bash
# Rebuild the webserver image
cd /home/vamsi/Dev/Projects
./start-all.sh --force-build --service webserver
```

---

### Issue 2: Container Won't Start

**Symptom:** `docker ps` doesn't show vritti-webserver

**Check:**
```bash
docker logs vritti-webserver
```

**Common Errors:**

1. **"daphne: command not found"**
   - Daphne not installed in Docker image
   - Fix: Rebuild with `--force-build`

2. **"Cannot connect to Redis"**
   - Redis container not running
   - Fix: `docker compose up -d redis`

3. **"ModuleNotFoundError: No module named 'channels'"**
   - Channels not installed
   - Fix: Rebuild with `--force-build`

---

### Issue 3: Live Prices Not Updating

**Symptom:** Button works, WebSocket connects, but no price updates

**Check Daphne Logs:**
```bash
docker logs -f vritti-webserver
```

Look for:
```
INFO WebSocket CONNECT /ws/prices/binance/
INFO Binance WebSocket consumer connected
INFO Connected to Binance WebSocket: 5 symbols
```

**If missing:**
- Check if Binance API is accessible from container
- Check if consumers.py has errors

**Debug:**
```bash
# Get a shell inside the container
docker exec -it vritti-webserver bash

# Test Binance API
python3 -c "import websockets; print('websockets installed')"

# Check consumers.py exists
ls -la /CryptoWebServer/home/consumers.py
```

---

### Issue 4: "ModuleNotFoundError" After Rebuild

**Cause:** Old cached Python packages

**Fix:**
```bash
# Force rebuild without cache
cd /home/vamsi/Dev/Projects
./start-all.sh --force-build --service webserver

# Or rebuild with no cache
docker compose build --no-cache webserver
docker compose up -d webserver
```

---

### Issue 5: MIME Type Error for CSS/JS Files

**Symptom:** Browser shows "Refused to apply style from 'http://..../static/css/index.css' because its MIME type ('text/html') is not a supported stylesheet MIME type"

**Cause:** Daphne (ASGI server) does NOT automatically serve static files like Django's development server does. The browser is receiving HTML error pages instead of CSS/JS files.

**Fix Applied:**
1. Added `whitenoise` to requirements.txt
2. Added `WhiteNoiseMiddleware` to settings.py MIDDLEWARE
3. Configured STATIC_ROOT and WhiteNoise settings
4. Updated Dockerfile to run `collectstatic` before starting Daphne

**Verify Fix:**
```bash
# After rebuilding, check static files are collected
docker exec -it vritti-webserver ls -la /CryptoWebServer/staticfiles/

# You should see directories like:
# - admin/ (Django admin static files)
# - frontend/ (React build output)
# - rest_framework/ (DRF browsable API)
```

**If still broken:**
```bash
# Manually collect static files inside container
docker exec -it vritti-webserver python manage.py collectstatic --noinput

# Restart container
docker restart vritti-webserver
```

---

## 📋 Docker Commands Reference

### View Logs

```bash
# Real-time logs for webserver
docker logs -f vritti-webserver

# Last 100 lines
docker logs --tail 100 vritti-webserver

# All services
docker compose logs -f
```

### Restart Services

```bash
# Restart only webserver
docker restart vritti-webserver

# Restart all services
docker compose restart
```

### Stop Services

```bash
# Stop only webserver
docker stop vritti-webserver

# Stop all services
cd /home/vamsi/Dev/Projects
./stop-all.sh
```

### Check Service Health

```bash
# Check if webserver is responding
curl http://localhost:8000/

# Check Redis
docker exec -it vritti-redis redis-cli ping

# Check container status
docker ps -a | grep vritti
```

### Rebuild Specific Service

```bash
cd /home/vamsi/Dev/Projects

# Rebuild webserver only
./start-all.sh --build --service webserver

# Rebuild multiple services
./start-all.sh --build --service webserver,ta-engine
```

---

## 🎯 Quick Start Checklist

After pulling latest code with WebSocket changes:

- [ ] **Navigate to Projects directory**
  ```bash
  cd /home/vamsi/Dev/Projects
  ```

- [ ] **Rebuild webserver container**
  ```bash
  ./start-all.sh --build --service webserver
  ```

- [ ] **Wait for container to start** (5-10 seconds)

- [ ] **Check Daphne is running**
  ```bash
  docker logs vritti-webserver | grep "Starting server"
  ```

- [ ] **Open browser to webserver**
  - `http://localhost:8000/binance` or
  - `http://192.168.0.201:8000/binance`

- [ ] **Open DevTools** (F12) → Console tab

- [ ] **Click "Live Prices" button**

- [ ] **Verify console shows:**
  ```
  Connecting to WebSocket: ws://...
  WebSocket connected
  Subscribed to: [...]
  [binance] BTCUSDT: $...
  ```

- [ ] **Verify prices update in table**
  - "Price (USDT)" column shows values
  - Values change every 1-2 seconds
  - 24h change % shows in green/red

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│         Browser (Frontend)          │
│  - React Components                 │
│  - useWebSocket Hook                │
└──────────────┬──────────────────────┘
               │
               │ WebSocket (ws://)
               ↓
┌─────────────────────────────────────┐
│    Docker: vritti-webserver         │
│  ┌───────────────────────────────┐  │
│  │  Daphne ASGI Server           │  │
│  │  - HTTP/HTTPS                 │  │
│  │  - WebSocket Support          │  │
│  └──────────┬────────────────────┘  │
│             │                        │
│  ┌──────────▼────────────────────┐  │
│  │  Django Channels              │  │
│  │  - WebSocket Consumers        │  │
│  │  - BinancePriceConsumer       │  │
│  │  - ZerodhaPriceConsumer       │  │
│  └──────────┬────────────────────┘  │
└─────────────┼────────────────────────┘
              │ Channel Layer
              ↓
┌─────────────────────────────────────┐
│    Docker: vritti-redis             │
│  - Channel Layer Backend            │
│  - Message Passing                  │
└─────────────────────────────────────┘

              ↓ WebSocket Client
┌─────────────────────────────────────┐
│   Binance WebSocket API             │
│  - Real-time Ticker Streams         │
│  - wss://stream.binance.com:9443    │
└─────────────────────────────────────┘
```

---

## 📝 Files Modified

1. **Dockerfile** - Changed CMD to use Daphne, added collectstatic step
2. **requirements.txt** - Added daphne, channels, channels-redis, websockets, whitenoise
3. **docker-compose.yml** - Added comment about WebSocket support
4. **settings.py** - Added Channel Layers configuration, WhiteNoise middleware, static file settings
5. **asgi.py** - Created ASGI application (NEW FILE)
6. **home/consumers.py** - WebSocket consumers (NEW FILE)
7. **home/routing.py** - WebSocket URL routing (NEW FILE)
8. **frontend/src/hooks/useWebSocket.js** - React WebSocket hook (NEW FILE)
9. **frontend/src/components/HistoricalData.js** - Added Live button
10. **frontend/src/components/BinancePositions.js** - Added live prices

---

## 🔐 Production Considerations

### 1. Use WSS (Secure WebSocket)

For production with HTTPS, configure Nginx:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # SSL certificates
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # WebSocket upgrade
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;  # 24 hours
    }
}
```

### 2. Scale with Multiple Workers

For high load, run multiple Daphne workers:

```dockerfile
# In Dockerfile
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "--workers", "4", "CryptoWebServer.asgi:application"]
```

### 3. Monitor WebSocket Connections

Add monitoring:
- Track active WebSocket connections
- Monitor message throughput
- Alert on connection failures

### 4. Rate Limiting

Prevent abuse:
- Limit WebSocket connections per IP
- Limit subscription requests
- Throttle message sending

---

## 📚 Additional Resources

- **Django Channels Docs:** https://channels.readthedocs.io/
- **Daphne Docs:** https://github.com/django/daphne
- **Binance WebSocket API:** https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams
- **Project Documentation:**
  - `docs/WEBSOCKET_DEBUG_GUIDE.md` - Detailed debugging guide
  - `docs/tasks.md` - Remaining tasks and roadmap

---

**Last Updated:** 2025-12-29
**Status:** Ready for testing after rebuild
