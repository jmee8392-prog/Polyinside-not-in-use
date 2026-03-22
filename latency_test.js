const WebSocket = require('ws');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const ADMIN_ID = 8041089644;
const LATENCY_THRESHOLD_MS = 100;
const WS_URL = process.env.WS_URL || 'ws://localhost:3001';

let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
}

const stats = {
  totalMessages: 0,
  highLatencyCount: 0,
  avgLatency: 0,
  maxLatency: 0,
  minLatency: Infinity,
  latencies: []
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function calculateStats() {
  if (stats.latencies.length === 0) return;

  stats.avgLatency = (stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length).toFixed(2);
  stats.maxLatency = Math.max(...stats.latencies);
  stats.minLatency = Math.min(...stats.latencies);
}

function formatLatency(latency) {
  if (latency > LATENCY_THRESHOLD_MS) {
    return `${colors.red}⚠️  ${latency.toFixed(2)}ms${colors.reset}`;
  } else if (latency > 50) {
    return `${colors.yellow}⚡ ${latency.toFixed(2)}ms${colors.reset}`;
  }
  return `${colors.green}✅ ${latency.toFixed(2)}ms${colors.reset}`;
}

function sendAlert(latency, walletId, market) {
  if (!bot) return;

  const message =
    `⚠️ HIGH LATENCY DETECTED\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📊 Latency: ${latency.toFixed(2)}ms\n` +
    `⚙️ Threshold: ${LATENCY_THRESHOLD_MS}ms\n` +
    `📈 Excess: ${(latency - LATENCY_THRESHOLD_MS).toFixed(2)}ms\n` +
    `🎯 Market: ${market}\n` +
    `💼 Wallet: ${walletId.substring(0, 16)}...\n\n` +
    `Status: ${latency > 150 ? '🔴 CRITICAL' : '🟠 WARNING'}`;

  bot.sendMessage(ADMIN_ID, message).catch(err => {
    console.error('Failed to send Telegram alert:', err.message);
  });
}

function printStats() {
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━ LATENCY STATISTICS ━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`Total Messages: ${stats.totalMessages}`);
  console.log(`High Latency Events (>${LATENCY_THRESHOLD_MS}ms): ${stats.highLatencyCount}`);
  console.log(`Average Latency: ${formatLatency(parseFloat(stats.avgLatency))}`);
  console.log(`Max Latency: ${formatLatency(stats.maxLatency)}`);
  console.log(`Min Latency: ${formatLatency(stats.minLatency)}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

function startLatencyTest() {
  console.log(`${colors.cyan}🔍 Starting Latency Test...${colors.reset}`);
  console.log(`Connecting to: ${WS_URL}`);
  console.log(`Threshold: ${LATENCY_THRESHOLD_MS}ms\n`);

  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log(`${colors.green}✅ WebSocket connected${colors.reset}\n`);
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'update' && message.data) {
        const now = Date.now();
        const eventTimestamp = new Date(message.data.timestamp).getTime();

        // Calculate latency: current time - event timestamp
        const latency = now - eventTimestamp;

        stats.totalMessages++;
        stats.latencies.push(latency);

        // Keep only last 100 latencies for memory efficiency
        if (stats.latencies.length > 100) {
          stats.latencies.shift();
        }

        calculateStats();

        // Log each message
        const latencyStr = formatLatency(latency);
        console.log(
          `[${new Date().toLocaleTimeString()}] ` +
          `Latency: ${latencyStr} | ` +
          `Avg: ${formatLatency(parseFloat(stats.avgLatency))} | ` +
          `Wallets: ${message.data.wallets?.length || 0}`
        );

        // Alert if high latency
        if (latency > LATENCY_THRESHOLD_MS) {
          stats.highLatencyCount++;

          if (stats.highLatencyCount % 5 === 0) {
            // Send alert every 5th high latency event to avoid spam
            const wallet = message.data.wallets?.[0];
            if (wallet) {
              sendAlert(latency, wallet.id, wallet.market);
            }
          }

          console.log(
            `${colors.red}🚨 HIGH LATENCY! ${latency.toFixed(2)}ms (${(latency - LATENCY_THRESHOLD_MS).toFixed(2)}ms over threshold)${colors.reset}`
          );
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error.message);
    }
  });

  ws.on('close', () => {
    console.log(`${colors.red}❌ WebSocket disconnected${colors.reset}`);
    printStats();
    console.log('Reconnecting in 5 seconds...');
    setTimeout(startLatencyTest, 5000);
  });

  ws.on('error', (err) => {
    console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  });
}

// Print stats every 30 seconds
setInterval(() => {
  if (stats.totalMessages > 0) {
    printStats();
  }
}, 30000);

console.log(`${colors.cyan}
╔════════════════════════════════════════════╗
║     POLYMARKET LATENCY TEST SUITE          ║
║  Measuring WebSocket-to-Event Delay        ║
╚════════════════════════════════════════════╝
${colors.reset}`);

startLatencyTest();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Shutting down...${colors.reset}`);
  printStats();
  process.exit(0);
});
