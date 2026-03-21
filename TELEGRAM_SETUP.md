# 🤖 Telegram Bot Setup Guide

**In 5 minutes, you'll have your bot sending alerts to Telegram**

---

## Step 1: Create Telegram Bot (2 minutes)

1. **Open Telegram** and search for `@BotFather`
2. **Start chat** and type `/newbot`
3. **Answer the prompts:**
   - Name: `Polymarket Tracker` (or any name)
   - Username: `polymarket_tracker_bot` (must be unique, must end with `_bot`)

4. **Copy the token** you get (looks like: `123456789:ABCDefghijklmnopqrstuvwxyz`)

---

## Step 2: Add Token to System (1 minute)

### Option A: Using .env file
```bash
# On your VM, edit .env:
nano .env

# Add this line:
TELEGRAM_BOT_TOKEN=123456789:ABCDefghijklmnopqrstuvwxyz

# Save: Ctrl+X, then Y, then Enter
```

### Option B: Using deploy.sh
```bash
# Edit deploy.sh before running:
# Add this line in the setup section:
export TELEGRAM_BOT_TOKEN="123456789:ABCDefghijklmnopqrstuvwxyz"
```

---

## Step 3: Start the Bot (1 minute)

```bash
# If already running:
npm start

# Or restart if running:
pm2 restart polymarket-tracker
pm2 logs polymarket-tracker

# Look for: ✅ Telegram Bot connected
```

---

## Step 4: Test It (1 minute)

1. **In Telegram**, search for your bot name: `@polymarket_tracker_bot`
2. **Start chat** and type `/start`
3. **You should see:**
   ```
   👋 Welcome to Polymarket Insider Tracker!
   
   Commands:
   /subscribe_free - Get delayed alerts (30s delay)
   /subscribe_pro - Get instant alerts (API key required)
   /status - Check subscription status
   /help - Show help
   ```

---

## Step 5: Subscribe to Alerts

### For Free Tier (Learning)
```
/subscribe_free
```
✅ You'll get alerts 30 seconds after they happen

### For Pro Tier (Trading)
```
/subscribe_pro your_api_key_here
```
⚡ You'll get alerts INSTANTLY

---

## 🎯 That's It!

Your bot is now:
- ✅ Connected to Telegram
- ✅ Monitoring wallets 24/7
- ✅ Sending you alerts automatically
- ✅ Tracking which tier you're on

---

## 🔔 What You'll Receive

### Fresh Wallet Alert (Example)
```
🟢 FRESH_WALLET
🟠 Severity: HIGH
💯 Confidence: 82%
💬 Fresh wallet detected with $450 in TRUMP2024
⏰ 22:30:45

⚡ PRO TIER - INSTANT
```

### Behavioral Shift Alert (Example)
```
🟡 BEHAVIOR_SHIFT
🔴 Severity: CRITICAL
💯 Confidence: 91%
💬 Behavioral shift detected: Hold time 25m → 180m
⏰ 23:15:30

⚡ PRO TIER - INSTANT
```

---

## ⚙️ Bot Commands

| Command | Does |
|---------|------|
| `/start` | Show welcome & commands |
| `/subscribe_free` | Join free tier (30s delay) |
| `/subscribe_pro <api_key>` | Join pro tier (instant) |
| `/status` | Check your subscription |
| `/help` | Show help & pricing |

---

## 🐛 Troubleshooting

### Bot doesn't respond to /start
```bash
# Check logs:
pm2 logs polymarket-tracker

# Should show: ✅ Telegram Bot connected

# If not, check:
echo $TELEGRAM_BOT_TOKEN  # Should show token
```

### Can't find bot on Telegram
- Make sure bot username ends with `_bot`
- Wait 1-2 minutes after creating
- Restart backend: `pm2 restart polymarket-tracker`

### Not receiving alerts
```bash
# Check you're subscribed:
/status  # Should show tier

# If nothing, subscribe:
/subscribe_free

# Check logs:
pm2 logs polymarket-tracker | grep -i telegram
```

### "Invalid API key" error
```bash
# When using /subscribe_pro, format is:
/subscribe_pro actual_api_key_here

# Not:
/subscribe_pro <api_key>  # This won't work
```

---

## 💰 Pricing (Optional Implementation)

Currently FREE for beta. Once you monetize:

| Tier | Price | Alert Delay | Features |
|------|-------|-------------|----------|
| **FREE** | Free | 30 seconds | Basic alerts |
| **PRO** | $99/mo | Instant | + lead time predictions |
| **ENTERPRISE** | $999/mo | Instant | + identity enrichment |

---

## 🔐 Security Notes

- Your **API key is stored securely** in the database
- Bot token is only used for sending messages
- Alerts are **not** shared between users
- Your Telegram chat ID is **never public**

---

## 📱 Multiple Accounts

You can subscribe from **multiple Telegram accounts**:

1. Bot will track each separately
2. Each gets their own subscription tier
3. Stats are aggregated in backend

---

## 🚀 Next Steps

1. ✅ Create bot with @BotFather
2. ✅ Add token to .env
3. ✅ Start backend
4. ✅ Subscribe on Telegram
5. ✅ Wait for first alert (5 seconds)
6. ✅ Start making money 💰

---

**Questions?** Check logs: `pm2 logs polymarket-tracker`
