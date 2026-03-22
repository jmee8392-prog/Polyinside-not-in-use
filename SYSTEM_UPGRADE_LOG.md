# System Upgrade Log - Cluster Logic & Lazarus Resilience

## Deployment Time: 2026-03-22 02:41 UTC

### ✅ CONNECTIVITY STATUS

**PM2 Services:**
- `poly-bot` (ID: 0) - ONLINE ✅
- `latency-monitor` (ID: 1) - ONLINE ✅

**API Connections:**
- Telegram API - Connected ✅
- Polymarket API - Monitored by Lazarus Loop ✅
- WebSocket Server - Running on 0.0.0.0:3001 ✅

**Recent Logs:** No "Connection Closed" or "429 Rate Limit" errors detected ✅

---

## 🆕 NEW FEATURES DEPLOYED

### 1. Contract ID Clustering (Coordinated Move Detection)

**What it does:**
Tracks wallet movements across the same market/contract and detects coordinated activity.

**Detection Logic:**
- Monitors each Contract ID independently
- Tracks all wallet hits on that contract
- Time window: **120 seconds**
- Trigger: **3 or more unique wallets** hit same contract
- Alert: **REGARDLESS of trade size** (catches coordination)

**Alert Format:**
```
🚨 COORDINATED MOVE DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━

💼 Contract: [TRUMP2024]
👥 Wallet Cluster: 3 wallets
⏱️ Window: 120 seconds
💯 Confidence: 90%

━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: 🔴 COORDINATED ACTIVITY
Action: Monitor for market move
```

**Data Structure:**
```javascript
const contractIdTracker = new Map();
// contractId -> [{ walletId, timestamp }, ...]
// Auto-cleans entries older than 120s
```

**Code Location:** `polymarket_backend.js` line ~520
- Detection: `WalletDetector.detectCoordinatedMove(wallet)`
- Streaming: Contract ID hits checked every 5 seconds
- Auto-cleanup: Stale entries removed from memory

---

### 2. Lazarus Loop - API Health Monitoring

**What it does:**
Continuous health check of Polymarket API to detect outages and trigger failover mechanisms.

**Monitoring:**
- **Endpoint:** https://api.polymarket.com/markets
- **Interval:** Every 60 seconds
- **Timeout:** 5 seconds
- **Status:** Real-time tracking

**Behavior on API Down:**
1. Sets `apiHealthy = false`
2. Sends Telegram alert to admin
3. Logs timestamp of failure
4. Ready to trigger WebSocket reconnect

**Recovery:**
- Detects when API comes back online
- Sends recovery message to admin
- Resumes normal monitoring

**Alert Format (on API failure):**
```
🚨 LAZARUS ALERT
━━━━━━━━━━━━

Polymarket API unreachable!
Error: [Connection timeout]

Action: Force WebSocket reconnect initiated
Status: 🔴 CRITICAL
```

**Code Location:** `polymarket_backend.js` line ~119
- Initialization: `startLazarusLoop()` (called on startup)
- Variables: `apiHealthy`, `lastApiPing`, `POLYMARKET_API_URL`

---

## 📊 ALERT GENERATION LOGIC

### Alert Priority Stack:
1. **Coordinated Move** → CRITICAL severity, ignores size filter
2. **Whale Behavior Shift** → CRITICAL severity, $5k+ only
3. **Fresh Wallet** → HIGH severity, $1,000+ minimum
4. **Others** → FILTERED OUT

### Current Thresholds:
| Metric | Value | Purpose |
|--------|-------|---------|
| MIN_TRADE_SIZE | $1,000 | Minimum alert threshold |
| WHALE_SIZE | $5,000 | Whale classification |
| COORDINATED_THRESHOLD | 3 wallets | Coordination detection |
| COORDINATED_WINDOW | 120 sec | Detection window |
| API_PING_INTERVAL | 60 sec | Health check frequency |

---

## 🚨 ALERT ROUTING

### Admin User (ID: 8041089644)
- **Tier:** admin (hardcoded)
- **Routing:** Receives ALL alerts instantly
- **Delay:** ZERO (bypasses free tier delay)
- **Telegram:** Direct message
- **Signal:** 👑 ADMIN - INSTANT

### Pro Users
- **Tier:** pro (database assigned)
- **Routing:** Premium alerts only
- **Delay:** ZERO
- **Signal:** ⚡ PRO - INSTANT

### Free Users
- **Tier:** free (database assigned)
- **Routing:** All alerts
- **Delay:** 30 seconds
- **Signal:** 📱 FREE - DELAYED

---

## 🔧 TROUBLESHOOTING CHECKLIST

### Bot is Silent
✅ **Check:** `pm2 logs poly-bot --lines 50`
- Look for "Fresh: X" | "Alerts: X"
- If Fresh > 0 but Alerts = 0: Trade sizes below $1,000 threshold
- If connection errors: Restart with `pm2 restart poly-bot`

### High Latency Detected
✅ **Monitor:** `pm2 logs latency-monitor`
- Latency > 100ms triggers Telegram alert
- Each alert includes market/wallet context
- Check `top` for CPU/memory spikes

### API Down Warning
✅ **Response:** Lazarus Alert sent to admin
- Automatically triggered every 60s until API recovers
- Check Polymarket status page
- System ready for WebSocket reconnect

### Database Constraint Error
✅ **Known:** UNIQUE constraint on alerts.id
- Happens when same alert fires twice
- Auto-handled by INSERT OR REPLACE logic
- Non-fatal, alerts still processed

---

## 📈 PERFORMANCE METRICS

**Current Status:**
- poly-bot: 88.2 MB (normal)
- latency-monitor: 69.8 MB (normal)
- CPU: <1% each
- Uptime: 5+ seconds (just restarted)

**Expected Performance:**
- Alert generation: <100ms
- Telegram delivery: 1-3 seconds
- API health check: 500ms-5000ms
- Memory stable at 80-100MB each

---

## 🎯 NEXT STEPS

### Manual Testing:
```bash
# Watch real-time alerts
pm2 logs poly-bot

# Check latency
pm2 logs latency-monitor

# Verify API health
curl https://api.polymarket.com/markets

# Test Telegram
node -e "require('node-telegram-bot-api')..."
```

### Monitor Key Events:
1. **Coordinated moves** - Watch for 🚨 COORDINATED_MOVE type alerts
2. **API downtime** - Monitor 🚨 LAZARUS ALERT messages
3. **High latency** - Track in latency-monitor logs
4. **Rate limiting** - Check for ⏳ messages

---

## 📝 DEPLOYMENT SUMMARY

✅ Contract ID clustering logic implemented
✅ Lazarus Loop API health monitoring active
✅ All PM2 services running
✅ No connection errors in logs
✅ Admin notifications configured
✅ System ready for production alpha detection
