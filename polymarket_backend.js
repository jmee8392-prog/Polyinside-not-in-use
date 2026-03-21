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

// ==================== TELEGRAM BOT SETUP ====================
let telegramBot = null;
const telegramUsers = new Map(); // Store user subscription tiers

const initTelegramBot = () => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN not set. Telegram alerts disabled.');
    return;
  }

  telegramBot = new TelegramBot(botToken, { polling: true });

  telegramBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
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

        // Generate alerts
        const alerts = [];
        
        freshWallets.forEach(wallet => {
          if (wallet.detectionConfidence > 70) {
            alerts.push({
              id: `alert_${wallet.id}`,
              walletId: wallet.id,
              type: 'FRESH_WALLET',
              confidence: wallet.detectionConfidence,
              message: `Fresh wallet detected with ${wallet.currentBet} in ${wallet.market}`,
              timestamp: new Date(),
              severity: 'high'
            });
          }
        });

        behavioralWallets.forEach(wallet => {
          if (wallet.behaviorShift.confidence > 75) {
            alerts.push({
              id: `alert_${wallet.id}`,
              walletId: wallet.id,
              type: 'BEHAVIOR_SHIFT',
              confidence: wallet.behaviorShift.confidence,
              message: `Behavioral shift detected: Hold time ${wallet.behaviorShift.oldHoldTime}m → ${wallet.behaviorShift.newHoldTime}m`,
              timestamp: new Date(),
              severity: wallet.profitChange > 0 ? 'critical' : 'medium'
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

    // Get all telegram users from database
    db.all('SELECT * FROM telegram_subscriptions', async (err, users) => {
      if (err) {
        console.error('Error fetching telegram users:', err);
        return;
      }

      if (!users || users.length === 0) return;

      // Process each user and alert
      for (const alert of alerts) {
        for (const user of users) {
          // Determine if user should receive alert based on tier
          const isFree = user.tier === 'free';
          
          if (isFree) {
            // Free users get 30-second delay - queue them
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

    const emoji = alert.type === 'FRESH_WALLET' ? '🟢' : alert.type === 'BEHAVIOR_SHIFT' ? '🟡' : '👥';
    const severityEmoji = alert.severity === 'critical' ? '🔴' : alert.severity === 'high' ? '🟠' : '🟡';

    const message = 
      `${emoji} ${alert.type}\n` +
      `${severityEmoji} Severity: ${alert.severity.toUpperCase()}\n` +
      `💯 Confidence: ${alert.confidence}%\n` +
      `💬 ${alert.message}\n` +
      `⏰ ${new Date(alert.timestamp).toLocaleTimeString()}\n\n` +
      `${user.tier === 'pro' ? '⚡ PRO TIER - INSTANT' : '📱 FREE TIER - DELAYED'}`;

    telegramBot.sendMessage(user.chat_id, message).catch(err => {
      console.error(`Failed to send Telegram alert to ${user.chat_id}:`, err);
    });

    // Update user stats
    db.run(
      `UPDATE telegram_subscriptions SET alerts_sent = alerts_sent + 1, last_alert = ? WHERE user_id = ?`,
      [new Date(), user.user_id]
    );
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
        `INSERT INTO alerts (id, wallet_id, alert_type, confid
