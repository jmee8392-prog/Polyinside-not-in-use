# Latency Test Suite

Measures real-time latency between WebSocket message receive and Polymarket event timestamps to detect VPS bottlenecks.

## Overview

The `latency_test.js` script monitors incoming WebSocket updates and calculates the delay:

```
Latency = Current Time - Event Timestamp
```

This tells us:
- **< 10ms**: Peak execution, zero lag
- **10-50ms**: Optimal performance
- **50-100ms**: Acceptable, monitor
- **> 100ms**: 🚨 VPS lagging or bottleneck alert

## Features

✅ **Real-time Monitoring**
- Continuous WebSocket connection to backend
- Calculates latency for each message
- Color-coded console output (green/yellow/red)

✅ **Automatic Alerts**
- Telegram notification on high latency (>100ms)
- Alert throttling: Every 5th high latency event (anti-spam)
- Sends market/wallet context with alert

✅ **Statistics Tracking**
- Average, Min, Max latency
- High latency event counter
- Rolling 100-message window for memory efficiency
- Stats printed every 30 seconds

✅ **PM2 Integration**
- Runs as background service: `latency-monitor`
- Auto-restart on crash
- Persistent logs with timestamps

## Usage

### Start Continuous Monitoring
```bash
pm2 start latency_test.js --name "latency-monitor"
```

### View Real-time Logs
```bash
pm2 logs latency-monitor
```

### View Statistics
```bash
pm2 logs latency-monitor | tail -20
```

### Stop Monitoring
```bash
pm2 stop latency-monitor
pm2 delete latency-monitor
```

### Check All Processes
```bash
pm2 status
```

## Output Example

```
╔════════════════════════════════════════════╗
║     POLYMARKET LATENCY TEST SUITE          ║
║  Measuring WebSocket-to-Event Delay        ║
╚════════════════════════════════════════════╝

🔍 Starting Latency Test...
Connecting to: ws://localhost:3001
Threshold: 100ms

✅ WebSocket connected

[2:31:52 AM] Latency: ✅ 3.00ms | Avg: ✅ 3.00ms | Wallets: 14
[2:31:53 AM] Latency: ✅ 3.00ms | Avg: ✅ 3.00ms | Wallets: 14
[2:31:58 AM] Latency: ✅ 2.00ms | Avg: ✅ 2.67ms | Wallets: 14

━━━━━━━━━━━━━━━━━━ LATENCY STATISTICS ━━━━━━━━━━━━━━━━━
Total Messages: 100
High Latency Events (>100ms): 0
Average Latency: ✅ 2.50ms
Max Latency: ✅ 15.00ms
Min Latency: ✅ 1.00ms
```

## Thresholds

| Metric | Value | Purpose |
|--------|-------|---------|
| `LATENCY_THRESHOLD_MS` | 100ms | Alert threshold |
| `WS_URL` | ws://localhost:3001 | WebSocket server |
| `ADMIN_ID` | 8041089644 | Telegram alert recipient |

## Interpretation

### Low Latency (< 50ms) 🟢
- Your VPS is fast
- You're executing at peak speed
- Network/processing is optimal

### Medium Latency (50-100ms) 🟡
- Still acceptable for most use cases
- Monitor but not critical
- Could be due to market burst activity

### High Latency (> 100ms) 🔴
- **VPS bottleneck**: CPU/memory stress, check `top`
- **Network issue**: Packet loss, check `ping`
- **Backend queued**: Too many clients/alerts piling up
- **Polymarket API slowdown**: Check their status

## Troubleshooting

**High latency on fresh start?**
- First message might be stale from queue. Monitor next 10 messages.

**Intermittent spikes?**
- Could be market volatility causing backend load.
- Check `pm2 monit` for poly-bot CPU/memory.

**No WebSocket connection?**
- Verify `poly-bot` is running: `pm2 status`
- Check port 3001 is accessible: `netstat -tuln | grep 3001`

**Missing Telegram alerts?**
- Verify `TELEGRAM_BOT_TOKEN` in `.env`
- Check bot is connected: `pm2 logs poly-bot`

## Integration with Alert System

When latency exceeds 100ms, automatic Telegram alert is sent:

```
⚠️ HIGH LATENCY DETECTED
━━━━━━━━━━━━━━━━━━━━━━

📊 Latency: 142.56ms
⚙️ Threshold: 100ms
📈 Excess: 42.56ms
🎯 Market: TRUMP2024
💼 Wallet: wallet_abc123...

Status: 🟠 WARNING
```

## Fine-tuning

To adjust thresholds, edit these constants in `latency_test.js`:

```javascript
const LATENCY_THRESHOLD_MS = 100;  // Alert when latency exceeds this
const WS_URL = 'ws://localhost:3001';  // Backend WebSocket URL
const ADMIN_ID = 8041089644;  // Telegram ID for alerts
```

Then restart:
```bash
pm2 restart latency-monitor
```

## Performance Notes

- 📊 Minimal overhead (~18MB memory)
- ⚡ Efficient timestamp-only tracking
- 🔄 Auto-cleanup: Only keeps last 100 messages
- 🔔 Alert throttling: Prevents spam on persistent lag
