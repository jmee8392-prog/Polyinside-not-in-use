# Polymarket Insider Tracker - Complete Setup Guide

## 🎯 Overview

A production-grade 24/7 wallet monitoring system that detects:
- **Fresh Wallets**: New traders entering markets (0 previous bets)
- **Behavioral Shifts**: Low-activity wallets changing patterns (hold time <1hr → >2hrs)
- **Whale Clustering**: Grouping related wallets with similar behavior
- **Market Metrics**: Real-time volume and dominance tracking
- **Alert System**: High-confidence pattern detection with severity levels

## 📋 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  POLYMARKET BACKEND (Node.js)                               │
├─────────────────────────────────────────────────────────────┤
│ • Express REST API (Port 3001)                              │
│ • WebSocket Server (Real-time updates)                      │
│ • SQLite Database (Persistent storage)                      │
│ • 24/7 Monitoring Loop (5-second intervals)                 │
│ • Detection Algorithms (Fresh, Behavioral, Clustering)      │
└─────────────────────────────────────────────────────────────┘
           ↓↑ WebSocket / REST
┌─────────────────────────────────────────────────────────────┐
│  POLYMARKET FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────┤
│ • Real-time wallet dashboard                                │
│ • Alert notifications                                       │
│ • Whale cluster visualization                               │
│ • Market metrics analysis                                   │
│ • Win rate tracking                                         │
└─────────────────────────────────────────────────────────────┘
           ↓↑ HTTP / WebSocket
┌─────────────────────────────────────────────────────────────┐
│  POLYMARKET API / BLOCKCHAIN (Optional Integration)          │
├─────────────────────────────────────────────────────────────┤
│ • Real wallet data from Polymarket API                      │
│ • On-chain transaction history                              │
│ • Live market data                                          │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start (Development)

### 1. Install Node.js & npm
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node
```

### 2. Clone & Setup
```bash
# Create project directory
mkdir polymarket-tracker
cd polymarket-tracker

# Copy files into directory
cp polymarket_backend.js .
cp package.json .
cp polymarket_frontend.jsx ./src/  # For React projects

# Install dependencies
npm install
```

### 3. Start Backend
```bash
npm start
# Output:
# ╔═══════════════════════════════════════════════════════╗
# ║  🎯 POLYMARKET WALLET TRACKER - BACKEND STARTED        ║
# ║  📊 REST API:      http://localhost:3001              ║
# ║  🔌 WebSocket:     ws://localhost:3001                ║
# ║  💾 Database:      ./polymarket_tracker.db            ║
# ║  🚀 24/7 Monitoring: ACTIVE                           ║
# ╚═══════════════════════════════════════════════════════╝
```

The system will immediately start monitoring. Check logs for detection events.

### 4. Access Frontend
- Open `polymarket_frontend.jsx` in your React application
- Or use with any web framework that supports React components
- Frontend will auto-connect to backend via WebSocket

## 📊 API Endpoints

### REST API (for polling, dashboards, exports)

#### Get Wallets
```bash
# All wallets
curl http://localhost:3001/api/wallets

# Filter by type
curl http://localhost:3001/api/wallets?type=fresh
curl http://localhost:3001/api/wallets?type=behavioral

# Filter by market
curl http://localhost:3001/api/wallets?market=TRUMP2024

# Combined filters & sorting
curl http://localhost:3001/api/wallets?type=fresh&market=BTC80K
```

#### Get Wallet Details
```bash
curl http://localhost:3001/api/wallets/wallet_abc123
# Returns wallet + full transaction history
```

#### Get Markets Analysis
```bash
curl http://localhost:3001/api/markets
# Returns fresh wallet volume, behavior shift volume, dominance per market
```

#### Get Recent Alerts
```bash
# Last 50 alerts from 24 hours
curl http://localhost:3001/api/alerts?limit=50
```

#### Get Cluster Analysis
```bash
curl http://localhost:3001/api/clusters
# Returns wallet clusters with avg win rate, profit metrics
```

#### Get Stats Summary
```bash
curl http://localhost:3001/api/stats
# Fresh wallets, behavior shifts, volumes, win rates, avg profit
```

### WebSocket (for real-time monitoring)

```javascript
// Connect
const ws = new WebSocket('ws://localhost:3001');

// Listen for updates
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  
  if (type === 'update') {
    console.log('Fresh Wallets:', data.freshWallets);
    console.log('Behavior Shifts:', data.behavioralWallets);
    console.log('Alerts:', data.alerts);
    console.log('Market Metrics:', data.marketMetrics);
    console.log('Clusters:', data.clusters);
  }
};
```

## 🔧 Configuration

### Environment Variables (.env)
```env
PORT=3001
NODE_ENV=production
LOG_LEVEL=info

# Optional: For real Polymarket API integration
POLYMARKET_API_KEY=your_api_key
RPC_ENDPOINT=https://rpc.endpoint.com
```

### Monitoring Interval
In `polymarket_backend.js`, adjust detection frequency:
```javascript
setInterval(async () => {
  // Monitoring logic
}, 5000); // Change 5000 (5 seconds) to desired milliseconds
```

## 📱 Database Schema

### wallets
- `id`: Wallet identifier
- `address`: Wallet address
- `type`: 'fresh' or 'behavioral'
- `previous_bets_count`: Historical bet count
- `current_bet`: Active bet amount
- `market`: Betting market
- `win_rate`: Historical win percentage
- `total_profit_loss`: Cumulative P&L
- `cluster_id`: Related whale cluster
- `updated_at`: Last update timestamp

### transactions
- `id`: Transaction ID
- `wallet_id`: Associated wallet
- `market`: Market traded
- `bet_amount`: Bet size
- `hold_duration_minutes`: Time held
- `outcome`: 'win', 'loss', 'partial'
- `profit_loss`: Amount gained/lost

### alerts
- `id`: Alert ID
- `wallet_id`: Detected wallet
- `alert_type`: 'FRESH_WALLET' or 'BEHAVIOR_SHIFT'
- `confidence`: 0-100 confidence score
- `message`: Alert description
- `created_at`: Detection timestamp

### market_metrics
- `market`: Market name
- `fresh_wallet_volume`: Total fresh wallet bets
- `behavior_shift_volume`: Total shifted wallet bets
- `fresh_wallet_count`: Number of fresh wallets
- `behavior_shift_count`: Number of shift wallets
- `total_market_volume`: Total market volume

### behavior_history
- `wallet_id`: Tracked wallet
- `old_hold_time_avg`: Previous average hold time
- `new_hold_time_avg`: Current average hold time
- `confidence_score`: Detection confidence
- `shift_detected_at`: When shift was detected

## 🚢 Production Deployment

### Option 1: VM Deployment (Ubuntu/Debian)

```bash
# 1. SSH into VM
ssh user@your-vm-ip

# 2. Install Node.js & PM2
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# 3. Clone project
git clone your-repo
cd polymarket-tracker

# 4. Install dependencies
npm install

# 5. Start with PM2 (automatically restarts on crash)
pm2 start polymarket_backend.js --name "polymarket-tracker"
pm2 save
pm2 startup

# 6. View logs
pm2 logs polymarket-tracker

# 7. Monitor system
pm2 monit
```

### Option 2: Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY polymarket_backend.js .

EXPOSE 3001

CMD ["node", "polymarket_backend.js"]
```

```bash
# Build
docker build -t polymarket-tracker .

# Run
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/polymarket_tracker.db:/app/polymarket_tracker.db \
  --name tracker \
  polymarket-tracker

# View logs
docker logs -f tracker
```

### Option 3: Cloud Deployment (AWS EC2)

```bash
# 1. Launch Ubuntu 22.04 LTS instance
# 2. Security group: Allow ports 3001 (HTTP), 80, 443

# 3. SSH and setup
ssh -i key.pem ubuntu@instance-ip
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Install Nginx for reverse proxy
sudo apt install -y nginx

# 5. Configure Nginx
sudo nano /etc/nginx/sites-available/default
# Add:
# upstream polymarket {
#   server localhost:3001;
# }
# server {
#   location / {
#     proxy_pass http://polymarket;
#     proxy_http_version 1.1;
#     proxy_set_header Upgrade $http_upgrade;
#     proxy_set_header Connection "upgrade";
#   }
# }

sudo systemctl restart nginx

# 6. Deploy application
git clone your-repo
cd polymarket-tracker
npm install
npm start
```

## 📊 Detection Algorithms

### Fresh Wallet Detection
```
IF wallet.previousBets == 0 AND wallet.currentBet > 0
  THEN fresh_wallet = TRUE
  confidence = base_confidence (60-80%)
```

### Behavioral Shift Detection
```
old_hold_avg = average(hold_times[0:5])
new_hold_avg = average(hold_times[-5:])

IF old_hold_avg < 60 minutes AND new_hold_avg > 60 minutes
  AND (new_hold_avg / old_hold_avg) > 1.5
  THEN behavior_shift = TRUE
  confidence = min(95, new_hold_avg / old_hold_avg * 50)
```

### Whale Clustering
```
FOR each wallet pair:
  hold_time_diff = |holdTime1 - holdTime2| / max(holdTime1, holdTime2)
  win_rate_diff = |winRate1 - winRate2| / 100
  market_overlap = (market1 == market2) ? 0 : 0.3
  
  similarity = 1 - (hold_diff*0.4 + win_rate_diff*0.4 + market_overlap*0.2)
  
  IF similarity > 0.75:
    add_to_same_cluster()
```

## 🎯 Key Metrics & Insights

### Per-Wallet Metrics
- **Win Rate**: % of profitable trades
- **Total P&L**: Cumulative profit/loss
- **Hold Duration**: Average time before selling
- **Detection Confidence**: Algorithm certainty (0-100%)
- **Cluster Membership**: Grouped wallets (potential coordinated actors)

### Per-Market Metrics
- **Fresh Wallet Volume**: Total $ from new traders
- **Behavior Shift Volume**: Total $ from behavior-changed wallets
- **Fresh Wallet Dominance**: % of market from fresh wallets
- **Behavior Shift Dominance**: % of market from shifting wallets

### System Metrics
- **Alert Severity**: Critical (>90% conf), High (70-90%), Medium (<70%)
- **Cluster Size**: Number of coordinated wallets in cluster
- **Win Rate Correlation**: How accurate predictions are across wallet types

## 🔔 Alert Examples

### FRESH_WALLET Alert
```json
{
  "type": "FRESH_WALLET",
  "severity": "HIGH",
  "confidence": 82,
  "message": "Fresh wallet detected with $450 in TRUMP2024",
  "walletAddress": "0xabc123..."
}
```

### BEHAVIOR_SHIFT Alert
```json
{
  "type": "BEHAVIOR_SHIFT",
  "severity": "CRITICAL",
  "confidence": 91,
  "message": "Behavioral shift: Hold time 25m → 180m (7.2x increase)",
  "previousWinRate": 62.5,
  "profitChange": "+$1,240"
}
```

## 🔐 Security Considerations

1. **API Rate Limiting** - Add rate limiter for REST API
   ```javascript
   const rateLimit = require('express-rate-limit');
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100
   });
   app.use('/api/', limiter);
   ```

2. **Authentication** - Protect with API keys
   ```javascript
   app.use((req, res, next) => {
     if (req.headers['x-api-key'] !== process.env.API_KEY) {
       return res.status(401).json({ error: 'Unauthorized' });
     }
     next();
   });
   ```

3. **HTTPS** - Use in production
   ```javascript
   const https = require('https');
   const fs = require('fs');
   const options = {
     key: fs.readFileSync('key.pem'),
     cert: fs.readFileSync('cert.pem')
   };
   https.createServer(options, app).listen(443);
   ```

4. **Database Backups** - Daily backups
   ```bash
   # Daily backup script
   0 2 * * * cp /app/polymarket_tracker.db /backups/tracker_$(date +%Y%m%d).db
   ```

## 📈 Performance Optimization

### For High Volume (1000+ wallets/minute)

1. **Increase monitoring interval** (reduce detection frequency)
2. **Batch database writes** (bulk inserts)
3. **Implement data retention** (archive old data)
4. **Add Redis caching** for frequent queries
5. **Scale to multiple workers** (process clustering)

```javascript
// Batch insert example
const walletBatch = newWallets.slice(0, 100);
const placeholders = walletBatch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
db.run(`INSERT INTO wallets (...) VALUES ${placeholders}`, walletBatch.flat());
```

## 🐛 Troubleshooting

### "Cannot connect to backend"
- Check if backend is running: `ps aux | grep polymarket`
- Verify port 3001 is open: `netstat -an | grep 3001`
- Check firewall: `ufw allow 3001`

### "Database locked"
- SQLite issue; restart backend
- For production, migrate to PostgreSQL

### "Out of memory"
- Increase Node.js heap: `NODE_OPTIONS=--max-old-space-size=4096 npm start`
- Implement data cleanup/archival

### "WebSocket connection fails"
- Ensure backend is serving over WebSocket
- Check for proxy/firewall blocking ws:// protocol

## 📚 Integration with Real Polymarket Data

Replace `WalletSimulator.generateWallet()` with actual API calls:

```javascript
// Using Polymarket API
async function fetchWalletData() {
  const response = await axios.get('https://api.polymarket.com/wallets', {
    headers: { 'Authorization': `Bearer ${process.env.POLYMARKET_API_KEY}` }
  });
  return response.data;
}

// Using blockchain RPC
async function fetchTransactionHistory(walletAddress) {
  const response = await axios.post(process.env.RPC_ENDPOINT, {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getLogs',
    params: [{ address: walletAddress }]
  });
  return response.data;
}
```

## 📞 Support & Updates

- Monitor system logs: `pm2 logs`
- Database queries: `sqlite3 polymarket_tracker.db`
- Real-time monitoring: Visit web UI
- Alert integration: Use Telegram/Email webhooks

## 🎓 Learning Resources

- Polymarket API: https://docs.polymarket.com
- SQLite: https://www.sqlite.org/docs.html
- WebSocket: https://github.com/websockets/ws
- Express: https://expressjs.com/

---

**Status**: Production-ready for 24/7 deployment
**Last Updated**: 2024
