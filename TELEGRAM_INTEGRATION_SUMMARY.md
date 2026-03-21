# 🤖 Telegram Integration Summary

## ✅ What Was Added

### Code Changes

**1. polymarket_backend.js** (27 KB)
- ✅ Telegram Bot import & initialization
- ✅ `/start` command handler
- ✅ `/subscribe_free` command (free tier)
- ✅ `/subscribe_pro <api_key>` command (instant alerts)
- ✅ `/status` command (check subscription)
- ✅ `/help` command (view pricing & info)
- ✅ `sendTelegramAlerts()` function (sends alerts to users)
- ✅ `sendAlertToUser()` function (formats & sends message)
- ✅ Telegram subscriptions database table
- ✅ 30-second delay for free tier, instant for pro tier
- ✅ Alert tracking (counts sent alerts per user)

**2. package.json** (868 bytes)
- ✅ Added `node-telegram-bot-api` dependency (v0.61.0)

**3. .env.example** (1.9 KB)
- ✅ Added `TELEGRAM_BOT_TOKEN` configuration
- ✅ Added `TELEGRAM_FREE_DELAY_MS` setting (30 seconds)
- ✅ Added `TELEGRAM_PRO_DELAY_MS` setting (instant)
- ✅ Updated comments with Telegram info

**4. TELEGRAM_SETUP.md** (4.4 KB) - NEW FILE
- ✅ 5-minute setup guide
- ✅ How to create bot with @BotFather
- ✅ How to add token to .env
- ✅ How to subscribe on Telegram
- ✅ Example alerts shown
- ✅ Troubleshooting guide
- ✅ Command reference

---

## 🚀 How It Works

```
1. You create bot at @BotFather (2 min)
   ↓
2. Copy token to .env (1 min)
   ↓
3. Start backend: npm start (auto-connects to Telegram)
   ↓
4. Message bot: /start (gets welcome)
   ↓
5. Subscribe: /subscribe_free or /subscribe_pro
   ↓
6. System detects wallet → generates alert → sends to you on Telegram
   ↓
7. You see alert instantly (pro) or after 30s (free)
```

---

## 🔔 Alert Flow

```
Wallet Monitoring Loop (every 5 seconds)
    ↓
Fresh Wallet Detected OR Behavior Shift Detected
    ↓
Generate Alert (type, confidence, message)
    ↓
Find all Telegram users
    ↓
For each user:
  - If FREE tier: Queue alert for 30 seconds later
  - If PRO tier: Send alert immediately
    ↓
User receives formatted Telegram message
    ↓
Database updates: alerts_sent++, last_alert timestamp
```

---

## 📱 Database Changes

### New Table: `telegram_subscriptions`
```sql
CREATE TABLE telegram_subscriptions (
  user_id TEXT PRIMARY KEY,      -- tg_<chat_id>
  chat_id INTEGER,               -- Telegram chat ID
  tier TEXT,                     -- 'free' or 'pro'
  api_key TEXT,                  -- API key (for pro tier)
  subscribed_at DATETIME,        -- When they subscribed
  alerts_sent INTEGER DEFAULT 0, -- How many alerts sent
  last_alert DATETIME            -- Last alert time
)
```

---

## ⚙️ Configuration

### One-Time Setup (5 minutes)
1. Create bot at https://t.me/BotFather → get token
2. Add to `.env`: `TELEGRAM_BOT_TOKEN=your_token_here`
3. Run: `npm install` (installs node-telegram-bot-api)
4. Start: `npm start` (backend connects to Telegram)
5. Message bot: `/start` and `/subscribe_free` (or `/subscribe_pro`)

### Environment Variables
```env
TELEGRAM_BOT_TOKEN=123456789:ABCDefghijklmnopqrstuvwxyz
TELEGRAM_FREE_DELAY_MS=30000  # 30 seconds
TELEGRAM_PRO_DELAY_MS=0        # Instant
```

---

## 🎯 Bot Commands

All commands start with `/` in Telegram chat

| Command | Arguments | Function | Tier |
|---------|-----------|----------|------|
| `/start` | None | Show welcome & commands | All |
| `/subscribe_free` | None | Join free tier | All |
| `/subscribe_pro` | `<api_key>` | Join pro tier | All |
| `/status` | None | Check your subscription | All |
| `/help` | None | View pricing & info | All |

---

## 💬 Alert Messages

### Fresh Wallet Alert Example
```
🟢 FRESH_WALLET
🟠 Severity: HIGH
💯 Confidence: 82%
💬 Fresh wallet detected with $450 in TRUMP2024
⏰ 22:30:45

⚡ PRO TIER - INSTANT
```

### Behavior Shift Alert Example
```
🟡 BEHAVIOR_SHIFT
🔴 Severity: CRITICAL
💯 Confidence: 91%
💬 Behavioral shift detected: Hold time 25m → 180m
⏰ 23:15:30

📱 FREE TIER - DELAYED
```

---

## 🔄 Tiered System

### FREE Tier
- 30-second delay on all alerts
- Good for learning market patterns
- No cost
- Perfect for testing

### PRO Tier
- ⚡ Instant alerts (no delay)
- All alert types included
- Perfect for active trading
- Currently free (beta), future: $99-999/month

---

## 📊 Tracking & Analytics

System tracks per user:
- ✅ Subscription date
- ✅ Subscription tier
- ✅ Total alerts sent
- ✅ Last alert received
- ✅ API key (if pro)

Query example:
```bash
# Check which users are subscribed
sqlite3 polymarket_tracker.db "SELECT * FROM telegram_subscriptions;"

# Count alerts per user
sqlite3 polymarket_tracker.db "SELECT chat_id, alerts_sent FROM telegram_subscriptions ORDER BY alerts_sent DESC;"
```

---

## 🐛 Troubleshooting

### Bot Doesn't Connect
```bash
# Check logs
pm2 logs polymarket-tracker | grep -i telegram

# Should show: ✅ Telegram Bot connected

# If error: "TELEGRAM_BOT_TOKEN not set"
# → Add it to .env and restart
```

### Telegram Message Says "Invalid API Key"
```bash
# When using /subscribe_pro, use actual API key:
/subscribe_pro abc123xyz

# NOT:
/subscribe_pro <abc123xyz>  # This won't work
```

### Not Receiving Alerts
```bash
# Check you subscribed:
/status

# If not subscribed:
/subscribe_free

# Check logs:
pm2 logs polymarket-tracker | grep -i "telegram\|alert"
```

### Bot Offline in Telegram
```bash
# Restart backend
pm2 restart polymarket-tracker

# Wait 5 seconds, then try /start again
```

---

## 🔐 Security & Privacy

✅ **Secure by design:**
- Bot token only used for Telegram API
- API keys stored in database (not transmitted)
- Chat IDs private (1-to-1 mapping)
- No data shared between users
- No alerts shown to other users

---

## 📈 Monetization Ready

Current setup supports:
- ✅ Free tier (learning)
- ✅ Pro tier (instant alerts)
- ✅ Future: Enterprise tier (API + custom feeds)

To enable paid tiers, add:
- Payment processor (Stripe, PayPal)
- Subscription tracking
- Tier validation on alerts

---

## 🚀 Quick Start

```bash
# 1. Get token from @BotFather
# 2. Add to .env
TELEGRAM_BOT_TOKEN=your_token

# 3. Install & start
npm install
npm start

# 4. Open Telegram, find your bot
# 5. Type: /start

# 6. Subscribe to alerts
/subscribe_free

# 7. Wait for first alert (should come in 5-35 seconds)
```

---

## 📞 Commands at a Glance

```
/start                    # See menu
/subscribe_free          # Get free tier (30s delay)
/subscribe_pro KEY123    # Get pro tier (instant)
/status                  # Check your tier
/help                    # See pricing
```

---

## ✨ What's Next (Optional)

After Telegram works, you could add:

1. **Email alerts** - Similar pattern
2. **SMS alerts** - Via Twilio
3. **Discord bot** - For communities
4. **Custom webhooks** - For your own API
5. **Payment integration** - For monetization

---

**Status**: ✅ Telegram integration complete and ready to use
**Setup time**: 5 minutes
**Cost**: Free (bot creation + hosting)
