# 🎯 Polymarket Insider Tracker - Quick Reference

## 🚀 Getting Started (Choose One)

### Auto-Deploy to VM (Recommended)
```bash
sudo bash deploy.sh
# Installs everything, starts service, opens port 80
```

### Manual Start (Development)
```bash
npm install
npm start
# Backend: http://localhost:3001
```

---

## 📊 What Gets Monitored

| Detection | Description | Confidence | Use Case |
|-----------|-------------|-----------|----------|
| **Fresh Wallet** | 0 bets → first bet | 60-80% | New trader entry |
| **Behavior Shift** | Hold time <1h → >2h | 75-95% | Strategy change |
| **Whale Cluster** | Similar behavior pattern | 50-90% | Coordinated trading |

---

## 🔌 Quick API Examples

### Get Fresh Wallets
```bash
curl http://localhost:3001/api/wallets?type=fresh
```

### Get Market Stats
```bash
curl http://localhost:3001/api/markets
```

### Get Recent Alerts
```bash
curl http://localhost:3001/api/alerts?limit=20
```

### Get System Stats
```bash
curl http://localhost:3001/api/stats
```

---

## 🎮 Frontend Features

| Tab | Shows |
|-----|-------|
| **Wallets** | Live fresh wallets & behavior shifts |
| **Alerts** | High-confidence detections |
| **Clusters** | Related wallets grouped |
| **Markets** | Per-market volume breakdown |

---

## 💾 Database Files

```
polymarket_tracker.db  (SQLite database - auto-created)
  ├── wallets          (wallet data + scores)
  ├── transactions     (bet history)
  ├── alerts           (detected patterns)
  ├── clusters         (whale groupings)
  ├── market_metrics   (volume & dominance)
  └── behavior_history (shift tracking)
```

---

## ⚙️ Key Settings

| Setting | Default | Range | Impact |
|---------|---------|-------|--------|
| Monitoring Interval | 5 seconds | 1-60s | How often detection runs |
| Fresh Wallet Threshold | 65% | 0-100 | Confidence needed for alert |
| Behavior Shift Threshold | 75% | 0-100 | Hold time change detection |
| Data Retention | 90 days | 7-365 | How long data kept |

---

## 🔍 Detection Algorithms

### Fresh Wallet
```
IF wallet.previousBets == 0 AND wallet.currentBet > 0
  → Alert with 60-80% confidence
```

### Behavioral Shift
```
IF oldHoldTime < 60 min AND newHoldTime > 60 min
  AND (newHoldTime / oldHoldTime) > 1.5
  → Alert with 75-95% confidence
```

### Whale Clustering
```
IF similarity(wallet1, wallet2) > 0.75
  → Group in same cluster
  confidence = similarity * 100%
```

---

## 📈 Real-Time Metrics

### Per Wallet
- Win Rate (%)
- Total P&L ($)
- Hold Duration (minutes)
- Detection Confidence (%)
- Cluster ID (if grouped)

### Per Market
- Fresh Wallet Volume ($)
- Behavior Shift Volume ($)
- Fresh Dominance (%)
- Behavior Dominance (%)

---

## 🚨 Alert Types

### FRESH_WALLET
- **Severity**: HIGH
- **Confidence**: 70-85%
- **Trigger**: New wallet bets
- **Action**: Monitor first trades

### BEHAVIOR_SHIFT
- **Severity**: CRITICAL
- **Confidence**: 80-95%
- **Trigger**: Hold time +150%
- **Action**: Track profit impact

---

## 📊 Useful PM2 Commands

```bash
pm2 start polymarket_backend.js          # Start
pm2 stop polymarket-tracker              # Stop
pm2 restart polymarket-tracker           # Restart
pm2 logs polymarket-tracker              # View logs (tail)
pm2 logs polymarket-tracker --lines 100  # Last 100 lines
pm2 monit                                # Live monitoring
pm2 delete polymarket-tracker            # Remove from PM2
pm2 save                                 # Save startup list
pm2 startup                              # Auto-start on reboot
```

---

## 🐛 Debug Mode

```bash
# Enable verbose logging
DEBUG=true npm start

# View all SQL queries
VERBOSE_LOGGING=true npm start

# Check backend connection
curl http://localhost:3001/health

# Inspect database
sqlite3 polymarket_tracker.db
> SELECT COUNT(*) FROM wallets;
> SELECT * FROM alerts ORDER BY created_at DESC LIMIT 5;
```

---

## 🔐 Security Quick Setup

### Change API Port
```bash
# In .env
PORT=8443
```

### Add API Key Protection
```bash
# In .env
API_KEY=your_secret_key_here

# Then request with:
curl -H "X-API-Key: your_secret_key_here" http://localhost:3001/api/wallets
```

### Enable HTTPS
```bash
# Generate cert:
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# Backend auto-detects and serves HTTPS
```

---

## 📱 Web UI Access

```
Frontend URL: http://your-ip:80
API Endpoint: http://your-ip:3001/api/*
WebSocket: ws://your-ip:3001
```

---

## ⚡ Performance Tips

### Fast Detection (Lower Latency)
```env
MONITORING_INTERVAL=5000        # 5 seconds
MAX_WALLETS_PER_CYCLE=500       # Check fewer wallets
```

### High Throughput (More Wallets)
```env
MONITORING_INTERVAL=60000       # 60 seconds
MAX_WALLETS_PER_CYCLE=5000      # Check more wallets
BATCH_INSERT_SIZE=500           # Larger batches
```

### Low Resource (Minimal CPU/RAM)
```env
MONITORING_INTERVAL=300000      # 5 minutes
BATCH_INSERT_SIZE=10            # Smaller batches
DATA_RETENTION_DAYS=7           # Keep less data
```

---

## 🔗 Real Polymarket Integration

To use real data instead of simulation:

1. Get API key from https://docs.polymarket.com
2. Add to `.env`: `POLYMARKET_API_KEY=your_key`
3. Replace in `polymarket_backend.js`:
   ```javascript
   // Replace WalletSimulator.generateWallet() with:
   const realWallets = await axios.get(
     'https://api.polymarket.com/wallets',
     { headers: { 'Authorization': `Bearer ${process.env.POLYMARKET_API_KEY}` } }
   );
   ```

---

## 🎯 System Architecture

```
Frontend (React)
    ↓↑ WebSocket
Node.js Backend
    ↓↑ SQLite
Database
    ↓ (optional)
Polymarket API
```

---

## 📊 Sample Output

### REST API Response
```json
{
  "wallets": [
    {
      "id": "wallet_abc123",
      "address": "0xabc123...def456",
      "type": "fresh",
      "previousBets": 0,
      "currentBet": 450.00,
      "market": "TRUMP2024",
      "winRate": 75.5,
      "totalProfitLoss": 1240.00,
      "clusterId": null,
      "detectionConfidence": 82
    }
  ]
}
```

### WebSocket Update
```json
{
  "type": "update",
  "data": {
    "freshWallets": 12,
    "behavioralWallets": 8,
    "totalVolume": 45000,
    "avgWinRate": 58.3,
    "alerts": [
      {
        "type": "FRESH_WALLET",
        "confidence": 85,
        "severity": "HIGH"
      }
    ]
  }
}
```

---

## 🆘 Common Issues

| Problem | Solution |
|---------|----------|
| Port 3001 in use | `lsof -i :3001` then `kill -9 <PID>` |
| Database locked | Restart backend: `pm2 restart polymarket-tracker` |
| High memory | `NODE_OPTIONS=--max-old-space-size=4096 npm start` |
| WebSocket fails | Check backend running: `pm2 status` |

---

## 📋 Deployment Checklist

- [ ] Copy all files to VM
- [ ] Run `sudo bash deploy.sh`
- [ ] Edit `.env` with your settings
- [ ] Check logs: `pm2 logs polymarket-tracker`
- [ ] Test API: `curl http://localhost:3001/api/stats`
- [ ] Access frontend: `http://your-ip`
- [ ] Setup backups: Verify cron job running
- [ ] Monitor system: `pm2 monit`

---

## 📞 Need Help?

1. **Check Logs**: `pm2 logs polymarket-tracker`
2. **Read Docs**: `cat SETUP_GUIDE.md`
3. **Test API**: `curl http://localhost:3001/api/wallets`
4. **Check DB**: `sqlite3 polymarket_tracker.db`
5. **Verify Config**: `cat .env`

---

**Status**: Ready for 24/7 production deployment ✅
