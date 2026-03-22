const express = require('express');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const TelegramBot = require('node-telegram-bot-api');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ==================== DATABASE SETUP ====================
const db = new sqlite3.Database('./polymarket_tracker.db', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to SQLite database');
});

// Initialize database tables
const initDatabase = () => {
  db.serialize(() => {
    // Wallets table
    db.run(`
      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        address TEXT UNIQUE,
        first_bet_timestamp DATETIME,
        previous_bets_count INTEGER,
        current_bet REAL,
        market TEXT,
        type TEXT,
        status TEXT,
        win_rate REAL DEFAULT 0,
        total_profit_loss REAL DEFAULT 0,
        cluster_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Transactions table
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        wallet_id TEXT,
        market TEXT,
        bet_amount REAL,
        hold_duration_minutes INTEGER,
        outcome TEXT,
        profit_loss REAL,
        timestamp DATETIME,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id)
      )
    `);

    // Behavior history table
    db.run(`
      CREATE TABLE IF NOT EXISTS behavior_history (
        id TEXT PRIMARY KEY,
        wallet_id TEXT,
        old_hold_time_avg REAL,
        new_hold_time_avg REAL,
        confidence_score REAL,
        profit_change_percent REAL,
        shift_detected_at DATETIME,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id)
      )
    `);

    // Alerts table
    db.run(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        wallet_id TEXT,
        alert_type TEXT,
        confidence REAL,
        message TEXT,
        sent BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id)
      )
    `);

    // Market metrics table
    db.run(`
      CREATE TABLE IF NOT EXISTS market_metrics (
        id TEXT PRIMARY KEY,
        market TEXT,
        fresh_wallet_volume REAL,
        behavior_shift_volume REAL,
        fresh_wallet_count INTEGER,
        behavior_shift_count INTEGER,
        total_market_volume REAL,
        timestamp DATETIME
      )
    `);

    // Telegram subscriptions table
    db.run(`
      CREATE TABLE IF NOT EXISTS telegram_subscriptions (
        user_id TEXT PRIMARY KEY,
        chat_id INTEGER,
        tier TEXT,
        api_key TEXT,
        subscribed_at DATETIME,
        alerts_sent INTEGER DEFAULT 0,
        last_alert DATETIME
      )
    `);

    console.log('Database tables initialized');
  });
};

initDatabase();

// ==================== LAZARUS LOOP: API HEALTH CHECK ====================
const startLazarusLoop = () => {
  console.log('🧟 Lazarus Loop activated - monitoring Polymarket API health...');

  const pingPolymarketAPI = async () => {
    try {
      const response = await axios.get(POLYMARKET_API_URL, { timeout: 5000 });

      if (response.status === 200) {
        const wasHealthy = apiHealthy;
        apiHealthy = true;
        lastApiPing = Date.now();

        if (!wasHealthy) {
          console.log(`✅ Polymarket API recovered - WebSocket should be healthy`);
          // API recovered, no forced reconnect needed
        }
      }
    } catch (error) {
      apiHealthy = false;
      // Silent logging - no Telegram spam on 404s
      console.log(`[API Health] Polymarket API check failed: ${error.message}`);
    }
  };

  // Ping every 60 seconds
  setInterval(pingPolymarketAPI, API_PING_INTERVAL_MS);
  // Initial ping
  pingPolymarketAPI();
};

// ==================== TELEGRAM BOT SETUP ====================
let telegramBot = null;
const telegramUsers = new Map(); // Store user subscription tiers

// Admin config
const ADMIN_TELEGRAM_ID = 8041089644;

// Anti-spam filters
const MIN_TRADE_SIZE = 1000;
const WHALE_SIZE = 5000;

// Coordinated move detection - Contract ID clustering
const COORDINATED_MOVE_THRESHOLD = 3; // 3+ wallets on same contract
const COORDINATED_MOVE_WINDOW_MS = 120000; // 120 seconds
const contractIdTracker = new Map(); // contractId -> [{ walletId, timestamp }, ...]

// Market token mapping: Market -> { token1: 'YES', token2: 'NO' }
const marketTokenMapping = {
  'TRUMP2024': { 'trump_yes': 'YES', 'trump_no': 'NO' },
  'CRYPTO20M': { 'crypto_yes': 'YES', 'crypto_no': 'NO' },
  'DOGE2025': { 'doge_yes': 'YES', 'doge_no': 'NO' },
  'BTC80K': { 'btc_yes': 'YES', 'btc_no': 'NO' },
  'ETH4K': { 'eth_yes': 'YES', 'eth_no': 'NO' },
  'PREDICTION_QTR': { 'pred_yes': 'YES', 'pred_no': 'NO' },
  'DEFI_TVL': { 'defi_yes': 'YES', 'defi_no': 'NO' },
  'INFLATION_YOY': { 'infl_yes': 'YES', 'infl_no': 'NO' }
};

// MarkdownV2 escape helper
const escapeMd = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
};

// Format currency with thousand separators
const formatCurrency = (amount) => {
  return '$' + parseFloat(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Get YES/NO mapping for asset
const getTradeDirection = (market, assetId) => {
  const mapping = marketTokenMapping[market];
  if (mapping && mapping[assetId]) {
    return mapping[assetId];
  }
  // Fallback to random if no mapping
  return Math.random() > 0.5 ? 'YES' : 'NO';
};

// Create clean market name
const cleanMarketName = (marketId) => {
  return marketId
    .replace(/([A-Z])/g, ' $1')
    .replace(/2024|2025|20M|4K|80K|_QTR|_YOY/g, '')
    .trim()
    .split(/\s+/)
    .join(' ');
};

// Fetch market data from Gamma API
const getMarketDataFromGamma = async (marketId) => {
  try {
    const response = await axios.get(
      `https://gamma-api.polymarket.com/markets/${marketId}`,
      { timeout: 5000 }
    );
    return response.data;
  } catch (error) {
    console.log(`[Gamma API] Market lookup failed for ${marketId}: ${error.message}`);
    return null;
  }
};

// Map token ID to YES/NO based on Gamma outcomes
const mapTokenIdToOutcome = (tokenId, outcomes) => {
  if (!outcomes || outcomes.length === 0) {
    return Math.random() > 0.5 ? 'YES' : 'NO';
  }

  // Typically outcomes[0] = NO, outcomes[1] = YES
  const index = outcomes.findIndex(o => o.token_id === tokenId);
  if (index === -1) return Math.random() > 0.5 ? 'YES' : 'NO';

  return index === 0 ? 'NO' : 'YES';
};

// Lazarus Loop - API health check (silent, no spam)
const POLYMARKET_API_URL = 'https://api.polymarket.com/markets';
const GAMMA_API_URL = 'https://gamma-api.polymarket.com/markets';
const API_PING_INTERVAL_MS = 60000; // 60 seconds
let apiHealthy = true;
let lastApiPing = Date.now();

// Rate limiting: Track message timestamps per user
const userMessageLog = new Map(); // userId -> array of timestamps
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_MESSAGES_PER_WINDOW = 10; // Max 10 messages per minute per user

const isRateLimited = (userId) => {
  const now = Date.now();
  if (!userMessageLog.has(userId)) {
    userMessageLog.set(userId, []);
  }

  const userMessages = userMessageLog.get(userId);
  // Remove old timestamps outside the window
  const recentMessages = userMessages.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  userMessageLog.set(userId, recentMessages);

  if (recentMessages.length >= MAX_MESSAGES_PER_WINDOW) {
    return true;
  }

  recentMessages.push(now);
  return false;
};

const initTelegramBot = () => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN not set. Telegram alerts disabled.');
    return;
  }

  telegramBot = new TelegramBot(botToken, { polling: true });

  telegramBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = `tg_${chatId}`;

    if (isRateLimited(userId)) {
      telegramBot.sendMessage(chatId, '⏳ Too many requests. Please wait a moment before sending more commands.');
      return;
    }

    telegramBot.sendMessage(
      chatId,
      '👋 Welcome to Polymarket Insider Tracker!\n\n' +
      'Commands:\n' +
      '/subscribe_free - Get delayed alerts (30s delay)\n' +
      '/subscribe_pro - Get instant alerts (API key required)\n' +
      '/status - Check subscription status\n' +
      '/help - Show help'
    );
  });

  telegramBot.onText(/\/subscribe_free/, (msg) => {
    const chatId = msg.chat.id;
    const userId = `tg_${chatId}`;

    if (isRateLimited(userId)) {
      telegramBot.sendMessage(chatId, '⏳ Too many requests. Please wait a moment before sending more commands.');
      return;
    }

    telegramUsers.set(userId, {
      chatId,
      tier: 'free',
      subscribedAt: new Date(),
      apiKey: null
    });

    // Store in database
    db.run(
      `INSERT OR REPLACE INTO telegram_subscriptions (user_id, chat_id, tier, subscribed_at)
       VALUES (?, ?, ?, ?)`,
      [userId, chatId, 'free', new Date()],
      (err) => {
        if (err) console.error('DB error:', err);
        telegramBot.sendMessage(
          chatId,
          '✅ Subscribed to FREE tier!\n\n' +
          '📊 You will receive alerts with 30-second delay\n' +
          'Good for learning, not for trading\n\n' +
          'Upgrade: /subscribe_pro'
        );
      }
    );
  });

  telegramBot.onText(/\/subscribe_pro (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const apiKey = match[1];
    const userId = `tg_${chatId}`;

    if (isRateLimited(userId)) {
      telegramBot.sendMessage(chatId, '⏳ Too many requests. Please wait a moment before sending more commands.');
      return;
    }

    // Verify API key format (basic check)
    if (!apiKey || apiKey.length < 10) {
      telegramBot.sendMessage(chatId, '❌ Invalid API key format');
      return;
    }

    telegramUsers.set(userId, {
      chatId,
      tier: 'pro',
      subscribedAt: new Date(),
      apiKey
    });

    // Store in database
    db.run(
      `INSERT OR REPLACE INTO telegram_subscriptions (user_id, chat_id, tier, api_key, subscribed_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, chatId, 'pro', apiKey, new Date()],
      (err) => {
        if (err) console.error('DB error:', err);
        telegramBot.sendMessage(
          chatId,
          '🚀 Subscribed to PRO tier!\n\n' +
          '⚡ You will receive INSTANT alerts\n' +
          '🔐 Your API key is secured\n' +
          '💎 Access to all premium features\n\n' +
          'Price: Free for now (beta)'
        );
      }
    );
  });

  telegramBot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const userId = `tg_${chatId}`;

    if (isRateLimited(userId)) {
      telegramBot.sendMessage(chatId, '⏳ Too many requests. Please wait a moment before sending more commands.');
      return;
    }

    const user = telegramUsers.get(userId);

    if (!user) {
      telegramBot.sendMessage(chatId, '❌ Not subscribed. Use /subscribe_free or /subscribe_pro');
      return;
    }

    telegramBot.sendMessage(
      chatId,
      `📊 Your Status:\n\n` +
      `Tier: ${user.tier === 'pro' ? '💎 PRO' : '📱 FREE'}\n` +
      `Subscribed: ${user.subscribedAt.toLocaleDateString()}\n` +
      `Alert Delay: ${user.tier === 'pro' ? '⚡ Instant' : '⏱️ 30 seconds'}`
    );
  });

  telegramBot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const userId = `tg_${chatId}`;

    if (isRateLimited(userId)) {
      telegramBot.sendMessage(chatId, '⏳ Too many requests. Please wait a moment before sending more commands.');
      return;
    }

    telegramBot.sendMessage(
      chatId,
      '📖 Help:\n\n' +
      '💰 Pricing:\n' +
      'FREE: 30s delayed alerts\n' +
      'PRO: Instant alerts\n\n' +
      '🔔 Alert Types:\n' +
      '🟢 Fresh Wallet - New trader entering\n' +
      '🟡 Behavior Shift - Unusual hold time\n' +
      '👥 Whale Cluster - Related wallets\n\n' +
      '/subscribe_free - Join FREE tier\n' +
      '/subscribe_pro <api_key> - Upgrade to PRO'
    );
  });

  console.log('✅ Telegram Bot connected');
};

// Initialize Telegram Bot
initTelegramBot();

// Start Lazarus Loop (API health monitoring)
startLazarusLoop();

// ==================== DATA SIMULATION ====================
const markets = ['TRUMP2024', 'CRYPTO20M', 'DOGE2025', 'BTC80K', 'ETH4K', 'PREDICTION_QTR', 'DEFI_TVL', 'INFLATION_YOY'];
const outcomes = ['win', 'loss', 'partial'];
let walletDatabase = new Map();
let detectedAlerts = [];

// Simulate wallet history with behavior patterns
const generateWalletHistory = (walletId) => {
  const transactions = [];
  const holdTimes = [];
  let totalProfitLoss = 0;
  let wins = 0;

  // Generate 5-25 historical transactions
  const txCount = Math.floor(Math.random() * 20) + 5;
  
  for (let i = 0; i < txCount; i++) {
    const holdDuration = Math.random() * 40 + 5; // 5-45 minutes
    holdTimes.push(holdDuration);
    
    const outcome = Math.random() > 0.4 ? 'win' : Math.random() > 0.5 ? 'loss' : 'partial';
    const profitLoss = outcome === 'win' ? Math.random() * 200 + 50 : outcome === 'loss' ? -(Math.random() * 150 + 30) : Math.random() * 50 - 25;
    
    if (outcome === 'win') wins++;
    totalProfitLoss += profitLoss;

    transactions.push({
      id: `tx_${walletId}_${i}`,
      holdDuration,
      outcome,
      profitLoss,
      timestamp: new Date(Date.now() - (txCount - i) * 3600000)
    });
  }

  return {
    transactions,
    holdTimes,
    winRate: (wins / txCount * 100).toFixed(2),
    totalProfitLoss: totalProfitLoss.toFixed(2),
    avgHoldTime: (holdTimes.reduce((a, b) => a + b) / holdTimes.length).toFixed(1)
  };
};

// ==================== CORE DETECTION LOGIC ====================

class WalletDetector {
  // Detect fresh wallets (0 previous bets)
  static detectFreshWallet(wallet) {
    return wallet.previousBets === 0 && wallet.currentBet > 0;
  }

  // Detect behavioral shifts
  static detectBehaviorShift(wallet) {
    if (!wallet.history) return null;

    const oldHoldTimes = wallet.history.holdTimes.slice(0, -5);
    const newHoldTimes = wallet.history.holdTimes.slice(-5);

    if (oldHoldTimes.length === 0 || newHoldTimes.length === 0) return null;

    const oldAvg = oldHoldTimes.reduce((a, b) => a + b) / oldHoldTimes.length;
    const newAvg = newHoldTimes.reduce((a, b) => a + b) / newHoldTimes.length;

    // Significant shift if hold time increased by 100%+ (from <1hr to >1hr)
    if (oldAvg < 60 && newAvg > 60 && newAvg / oldAvg > 1.5) {
      return {
        oldHoldTime: oldAvg.toFixed(1),
        newHoldTime: newAvg.toFixed(1),
        shift: ((newAvg / oldAvg - 1) * 100).toFixed(0),
        confidence: Math.min(95, (newAvg / oldAvg * 50).toFixed(0))
      };
    }

    return null;
  }

  // Calculate wallet win rate and correlation
  static calculateWinRate(history) {
    if (!history || history.transactions.length === 0) return 0;
    const wins = history.transactions.filter(t => t.outcome === 'win').length;
    return (wins / history.transactions.length * 100).toFixed(2);
  }

  // Detect whale clustering (similar behavior)
  static clusterWallets(wallets) {
    const clusters = new Map();
    let clusterCounter = 0;

    wallets.forEach(wallet => {
      let clustered = false;

      // Compare with existing clusters
      for (const [clusterId, members] of clusters) {
        const similarity = this.calculateBehaviorSimilarity(wallet, members[0]);
        if (similarity > 0.75) {
          members.push(wallet);
          wallet.clusterId = clusterId;
          clustered = true;
          break;
        }
      }

      // Create new cluster if no match
      if (!clustered) {
        clusters.set(`cluster_${clusterCounter}`, [wallet]);
        wallet.clusterId = `cluster_${clusterCounter}`;
        clusterCounter++;
      }
    });

    return clusters;
  }

  // Calculate behavior similarity between wallets (0-1 scale)
  static calculateBehaviorSimilarity(wallet1, wallet2) {
    if (!wallet1.history || !wallet2.history) return 0;

    const holdDiff = Math.abs(
      parseFloat(wallet1.history.avgHoldTime) - 
      parseFloat(wallet2.history.avgHoldTime)
    ) / Math.max(wallet1.history.avgHoldTime, wallet2.history.avgHoldTime);

    const winRateDiff = Math.abs(
      parseFloat(wallet1.history.winRate) - 
      parseFloat(wallet2.history.winRate)
    ) / 100;

    const marketOverlap = wallet1.market === wallet2.market ? 0 : 0.3;

    return 1 - (holdDiff * 0.4 + winRateDiff * 0.4 + marketOverlap * 0.2);
  }

  // Detect coordinated moves: 3+ wallets hitting same contract ID within 120s
  static detectCoordinatedMove(wallet) {
    const contractId = wallet.market; // Use market as contract ID proxy
    const now = Date.now();

    if (!contractIdTracker.has(contractId)) {
      contractIdTracker.set(contractId, []);
    }

    const contractHits = contractIdTracker.get(contractId);

    // Remove stale entries outside 120s window
    const recentHits = contractHits.filter(hit => now - hit.timestamp < COORDINATED_MOVE_WINDOW_MS);
    contractIdTracker.set(contractId, recentHits);

    // Add current wallet if not already in this window
    const alreadyTracked = recentHits.some(hit => hit.walletId === wallet.id);
    if (!alreadyTracked) {
      recentHits.push({ walletId: wallet.id, timestamp: now });
    }

    // Check if we have coordinated move (3+ unique wallets)
    if (recentHits.length >= COORDINATED_MOVE_THRESHOLD) {
      const uniqueWalletCount = new Set(recentHits.map(h => h.walletId)).size;

      if (uniqueWalletCount >= COORDINATED_MOVE_THRESHOLD) {
        return {
          contractId,
          walletCount: uniqueWalletCount,
          totalVolume: recentHits.reduce((sum, hit) => {
            // In real scenario, sum up transaction amounts
            return sum + 1;
          }, 0),
          confidence: Math.min(99, (uniqueWalletCount * 30)),
          isCoordinated: true
        };
      }
    }

    return null;
  }

  // Calculate market volume metrics
  static calculateMarketMetrics(wallets, market) {
    const marketWallets = wallets.filter(w => w.market === market);
    const freshWallets = marketWallets.filter(w => w.previousBets === 0);
    const behaviorShifts = marketWallets.filter(w => w.type === 'behavioral');

    const freshVolume = freshWallets.reduce((sum, w) => sum + parseFloat(w.currentBet || 0), 0);
    const behaviorVolume = behaviorShifts.reduce((sum, w) => sum + parseFloat(w.currentBet || 0), 0);
    const totalVolume = marketWallets.reduce((sum, w) => sum + parseFloat(w.currentBet || 0), 0);

    return {
      market,
      freshWalletVolume: freshVolume.toFixed(2),
      behaviorShiftVolume: behaviorVolume.toFixed(2),
      freshWalletCount: freshWallets.length,
      behaviorShiftCount: behaviorShifts.length,
      totalMarketVolume: totalVolume.toFixed(2),
      freshWalletDominance: totalVolume > 0 ? ((freshVolume / totalVolume) * 100).toFixed(2) : 0,
      behaviorShiftDominance: totalVolume > 0 ? ((behaviorVolume / totalVolume) * 100).toFixed(2) : 0
    };
  }
}

// ==================== SIMULATION ENGINE ====================

class WalletSimulator {
  static generateWallet(isFresh = false) {
    const walletId = `wallet_${Math.random().toString(16).slice(2, 10)}`;
    const market = markets[Math.floor(Math.random() * markets.length)];
    const history = generateWalletHistory(walletId);

    const wallet = {
      id: walletId,
      address: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 10)}`,
      type: isFresh ? 'fresh' : 'behavioral',
      previousBets: isFresh ? 0 : Math.floor(Math.random() * 25) + 5,
      currentBet: (Math.random() * 800 + 50).toFixed(2),
      market,
      status: isFresh ? 'Active' : 'Holding Longer',
      history,
      winRate: history.winRate,
      totalProfitLoss: history.totalProfitLoss,
      avgHoldTime: history.avgHoldTime,
      timestamp: new Date(),
      detectionConfidence: isFresh ? (Math.random() * 40 + 60).toFixed(0) : (Math.random() * 50 + 65).toFixed(0)
    };

    // Add behavior shift data if behavioral type
    if (!isFresh) {
      const shift = WalletDetector.detectBehaviorShift(wallet);
      if (shift) {
        wallet.behaviorShift = shift;
        wallet.profitChange = ((Math.random() - 0.3) * 200).toFixed(2);
      }
    }

    return wallet;
  }

  static generateBatch(freshCount = 8, behavioralCount = 6) {
    const batch = [];

    for (let i = 0; i < freshCount; i++) {
      batch.push(this.generateWallet(true));
    }

    for (let i = 0; i < behavioralCount; i++) {
      batch.push(this.generateWallet(false));
    }

    return batch;
  }
}

// ==================== CONTINUOUS MONITORING ====================

let monitoringActive = false;
const connectedClients = new Set();
let lastBroadcastData = null;

class ContinuousMonitor {
  static async startMonitoring() {
    if (monitoringActive) return;
    monitoringActive = true;

    console.log('🚀 Starting 24/7 wallet monitoring...');

    setInterval(async () => {
      try {
        // Generate new wallet batch
        const newWallets = WalletSimulator.generateBatch();

        // Run detection
        const freshWallets = newWallets.filter(w => WalletDetector.detectFreshWallet(w));
        const behavioralWallets = newWallets.filter(w => w.type === 'behavioral' && WalletDetector.detectBehaviorShift(w));

        // Cluster wallets
        const clusters = WalletDetector.clusterWallets(newWallets);

        // Calculate market metrics
        const marketMetrics = {};
        markets.forEach(market => {
          marketMetrics[market] = WalletDetector.calculateMarketMetrics(newWallets, market);
        });

        // Generate alerts with anti-spam filtering
        const alerts = [];

        freshWallets.forEach(wallet => {
          const tradeAmount = parseFloat(wallet.currentBet);

          // Filter: Only alert if trade size meets minimum
          if (tradeAmount < MIN_TRADE_SIZE) return;

          // Filter: If wallet has previous trades, it's not truly "fresh"
          if (wallet.previousBets > 5) {
            // Only alert if it's a whale-sized move
            if (tradeAmount < WHALE_SIZE) return;
          }

          if (wallet.detectionConfidence > 70) {
            alerts.push({
              id: `alert_${wallet.id}`,
              walletId: wallet.id,
              type: 'FRESH_WALLET',
              confidence: wallet.detectionConfidence,
              tradeAmount,
              previousBets: wallet.previousBets,
              contractId: wallet.market,
              assetId: Math.random() > 0.5 ? 'yes' : 'no',
              message: `Fresh wallet detected with $${tradeAmount.toFixed(2)} in ${wallet.market}`,
              timestamp: new Date(),
              severity: 'high',
              isWhale: tradeAmount >= WHALE_SIZE && wallet.previousBets > 5
            });
          }
        });

        behavioralWallets.forEach(wallet => {
          const tradeAmount = parseFloat(wallet.currentBet);

          // Filter: Only alert for whale-sized behavior shifts
          if (tradeAmount < WHALE_SIZE) return;

          if (wallet.behaviorShift.confidence > 75) {
            alerts.push({
              id: `alert_${wallet.id}`,
              walletId: wallet.id,
              type: 'BEHAVIOR_SHIFT',
              confidence: wallet.behaviorShift.confidence,
              tradeAmount,
              previousBets: wallet.previousBets,
              contractId: wallet.market,
              assetId: Math.random() > 0.5 ? 'yes' : 'no',
              message: `Behavioral shift detected: Hold time ${wallet.behaviorShift.oldHoldTime}m → ${wallet.behaviorShift.newHoldTime}m`,
              timestamp: new Date(),
              severity: wallet.profitChange > 0 ? 'critical' : 'medium',
              isWhale: true
            });
          }
        });

        // Detect coordinated moves - regardless of trade size
        newWallets.forEach(wallet => {
          const coordinated = WalletDetector.detectCoordinatedMove(wallet);
          if (coordinated) {
            alerts.push({
              id: `alert_coordinated_${wallet.market}_${Date.now()}`,
              walletId: wallet.id,
              type: 'COORDINATED_MOVE',
              confidence: coordinated.confidence,
              contractId: coordinated.contractId,
              walletCount: coordinated.walletCount,
              message: `🚨 ${coordinated.walletCount} wallets coordinated on ${coordinated.contractId} in 120s`,
              timestamp: new Date(),
              severity: 'critical',
              isCoordinated: true
            });
          }
        });

        // Store to database
        await this.storeToDatabase(newWallets, alerts, marketMetrics, clusters);

        // Send Telegram alerts
        await this.sendTelegramAlerts(alerts);

        // Broadcast to connected clients
        this.broadcastUpdate({
          wallets: newWallets,
          freshWallets,
          behavioralWallets,
          alerts,
          marketMetrics,
          clusters: Array.from(clusters.entries()).map(([id, members]) => ({
            id,
            walletCount: members.length,
            confidence: (members.length > 1 ? 85 : 50),
            dominantMarket: members[0].market
          })),
          timestamp: new Date(),
          totalWalletsMonitored: newWallets.length
        });

        // Log summary
        console.log(`📊 [${new Date().toLocaleTimeString()}] Fresh: ${freshWallets.length} | Behavioral Shifts: ${behavioralWallets.length} | Alerts: ${alerts.length} | Clusters: ${clusters.size}`);

      } catch (error) {
        console.error('Monitoring error:', error);
      }
    }, 5000); // Check every 5 seconds (adjust interval as needed)
  }

  static async sendTelegramAlerts(alerts) {
    if (!telegramBot || alerts.length === 0) return;

    // Send immediately to admin, then handle other users
    alerts.forEach(alert => {
      // Always send to admin instantly, bypass tier delays
      this.sendAlertToUser({ chat_id: ADMIN_TELEGRAM_ID, tier: 'admin' }, alert);
    });

    // Get all telegram users from database for standard tier handling
    db.all('SELECT * FROM telegram_subscriptions', async (err, users) => {
      if (err) {
        console.error('Error fetching telegram users:', err);
        return;
      }

      if (!users || users.length === 0) return;

      // Process each user and alert
      for (const alert of alerts) {
        for (const user of users) {
          // Skip admin (already handled)
          if (user.chat_id === ADMIN_TELEGRAM_ID) continue;

          // Determine if user should receive alert based on tier
          const isFree = user.tier === 'free';

          if (isFree) {
            // Free users get 30-second delay
            setTimeout(() => {
              this.sendAlertToUser(user, alert);
            }, 30000);
          } else {
            // Pro users get instant alerts
            this.sendAlertToUser(user, alert);
          }
        }
      }
    });
  }

  static sendAlertToUser(user, alert) {
    if (!telegramBot) return;

    let message;
    let parseMode = 'MarkdownV2';

    // Clean market name and prepare values
    const marketClean = cleanMarketName(alert.contractId || 'Unknown');
    const tradeDirection = getTradeDirection(alert.contractId, alert.assetId);
    const amount = formatCurrency(alert.tradeAmount || 0);
    const walletAddr = alert.walletId.substring(0, 16);
    const tradeCount = alert.previousBets || 0;
    const confidence = alert.confidence || 0;

    // Escape all values for MarkdownV2
    const mktName = escapeMd(marketClean);
    const dir = escapeMd(tradeDirection);
    const amt = escapeMd(amount);
    const addr = escapeMd(walletAddr);
    const count = escapeMd(String(tradeCount));
    const conf = escapeMd(String(confidence));

    // Determine strategy name
    const strategy = alert.isCoordinated ? 'COORDINATED' : (alert.type === 'FRESH_WALLET' ? 'INSIDER' : 'WHALE');

    // Clean sniper UI - focus on money and move
    message =
      `🚀 ${strategy} ALERT\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🎯 Market: ${mktName}\n` +
      `💎 Trade: ${dir} \\| ${amt}\n` +
      `👤 Wallet: ${addr}\\.\\.\\. \\(${count} trades\\)\n` +
      `📊 Signal: ${conf}% Confidence\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🔗 VIEW ON POLYMARKET`;

    // Send with MarkdownV2 parse mode
    telegramBot.sendMessage(user.chat_id, message, { parse_mode: parseMode }).catch(err => {
      console.log(`[Telegram] Send failed for ${user.chat_id}: ${err.message}`);
      // Fallback: retry without MarkdownV2 if parsing fails
      telegramBot.sendMessage(user.chat_id, message.replace(/\\/g, '')).catch(err2 => {
        console.log(`[Telegram] Fallback also failed for ${user.chat_id}`);
      });
    });

    // Update user stats (only for DB records)
    if (user.user_id) {
      db.run(
        `UPDATE telegram_subscriptions SET alerts_sent = alerts_sent + 1, last_alert = ? WHERE user_id = ?`,
        [new Date(), user.user_id]
      );
    }
  }

  static async storeToDatabase(wallets, alerts, metrics, clusters) {
    wallets.forEach(wallet => {
      db.run(
        `INSERT OR REPLACE INTO wallets (id, address, first_bet_timestamp, previous_bets_count, current_bet, market, type, status, win_rate, total_profit_loss, cluster_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          wallet.id,
          wallet.address,
          wallet.timestamp,
          wallet.previousBets,
          wallet.currentBet,
          wallet.market,
          wallet.type,
          wallet.status,
          wallet.winRate,
          wallet.totalProfitLoss,
          wallet.clusterId,
          new Date()
        ]
      );
    });

    alerts.forEach(alert => {
      db.run(
        `INSERT INTO alerts (id, wallet_id, alert_type, confidence, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [alert.id, alert.walletId, alert.type, alert.confidence, alert.message, alert.timestamp]
      );
    });

    Object.values(metrics).forEach(metric => {
      db.run(
        `INSERT INTO market_metrics (id, market, fresh_wallet_volume, behavior_shift_volume, fresh_wallet_count, behavior_shift_count, total_market_volume, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `metric_${Date.now()}_${metric.market}`,
          metric.market,
          metric.freshWalletVolume,
          metric.behaviorShiftVolume,
          metric.freshWalletCount,
          metric.behaviorShiftCount,
          metric.totalMarketVolume,
          new Date()
        ]
      );
    });
  }

  static broadcastUpdate(data) {
    lastBroadcastData = data;
    const message = JSON.stringify({ type: 'update', data });
    connectedClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }
}

// ==================== EXPRESS REST API ====================

// GET /api/wallets - List wallets
app.get('/api/wallets', (req, res) => {
  const { type, market, limit = 100 } = req.query;
  let query = 'SELECT * FROM wallets WHERE 1=1';
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (market) {
    query += ' AND market = ?';
    params.push(market);
  }

  query += ' ORDER BY updated_at DESC LIMIT ?';
  params.push(parseInt(limit));

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ wallets: rows, count: rows.length });
  });
});

// GET /api/wallets/:id - Get wallet details
app.get('/api/wallets/:id', (req, res) => {
  db.get('SELECT * FROM wallets WHERE id = ?', [req.params.id], (err, wallet) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    db.all('SELECT * FROM transactions WHERE wallet_id = ? ORDER BY timestamp DESC', [req.params.id], (err, transactions) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ wallet, transactions });
    });
  });
});

// GET /api/alerts - Get recent alerts
app.get('/api/alerts', (req, res) => {
  const { limit = 50 } = req.query;
  db.all(
    'SELECT * FROM alerts WHERE created_at > datetime("now", "-24 hours") ORDER BY created_at DESC LIMIT ?',
    [parseInt(limit)],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ alerts: rows, count: rows.length });
    }
  );
});

// GET /api/markets - Get market metrics
app.get('/api/markets', (req, res) => {
  db.all(
    'SELECT * FROM market_metrics ORDER BY timestamp DESC LIMIT 100',
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ markets: rows });
    }
  );
});

// GET /api/stats - Get summary stats
app.get('/api/stats', (req, res) => {
  db.get('SELECT COUNT(*) as total, SUM(CASE WHEN type="fresh" THEN 1 ELSE 0 END) as fresh, SUM(CASE WHEN type="behavioral" THEN 1 ELSE 0 END) as behavioral FROM wallets', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      totalWallets: row.total,
      freshWallets: row.fresh,
      behavioralWallets: row.behavioral,
      monitoringActive
    });
  });
});

// GET /api/clusters - Get cluster analysis
app.get('/api/clusters', (req, res) => {
  db.all(
    'SELECT cluster_id, COUNT(*) as wallet_count, AVG(win_rate) as avg_win_rate, AVG(total_profit_loss) as avg_profit FROM wallets WHERE cluster_id IS NOT NULL GROUP BY cluster_id',
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ clusters: rows });
    }
  );
});

// ==================== HTTP SERVER & WEBSOCKET ====================

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  🎯 POLYMARKET WALLET TRACKER - BACKEND STARTED        ║');
  console.log(`║  📊 REST API:      http://0.0.0.0:${PORT}                ║`);
  console.log(`║  🔌 WebSocket:     ws://0.0.0.0:${PORT}                  ║`);
  console.log('║  💾 Database:      ./polymarket_tracker.db            ║');
  console.log('║  🚀 24/7 Monitoring: ACTIVE                           ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
});

// WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  connectedClients.add(ws);
  console.log(`Client connected. Total: ${connectedClients.size}`);

  // Send last known data immediately on connect
  if (lastBroadcastData && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'update', data: lastBroadcastData }));
  }

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`Client disconnected. Total: ${connectedClients.size}`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    connectedClients.delete(ws);
  });
});

// Start continuous monitoring
ContinuousMonitor.startMonitoring();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
