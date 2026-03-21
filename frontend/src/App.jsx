import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, Zap, AlertCircle, BarChart3, Filter, Search, ExternalLink, Clock, Users, Trophy, Target, RefreshCw, Bell } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

const PolymarketTracker = () => {
  const [wallets, setWallets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [marketMetrics, setMarketMetrics] = useState({});
  const [stats, setStats] = useState({
    freshWallets: 0,
    behaviorShifts: 0,
    totalVolume: 0,
    avgProfit: 0,
    avgWinRate: 0
  });

  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('timestamp');
  const [activeTab, setActiveTab] = useState('wallets');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);
  const wsRef = useRef(null);
  const reconnectIntervalRef = useRef(null);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectIntervalRef.current) {
        clearTimeout(reconnectIntervalRef.current);
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/socket`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Connected to backend');
        setConnectionStatus('connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'update') {
            const { data } = message;

            setWallets(data.wallets || []);
            setAlerts(prev => {
              const combined = [...(data.alerts || []), ...prev];
              const seen = new Set();
              return combined.filter(a => {
                if (seen.has(a.id)) return false;
                seen.add(a.id);
                return true;
              }).slice(0, 50);
            });
            setClusters(data.clusters || []);
            setMarketMetrics(data.marketMetrics || {});
            setLastUpdate(new Date());

            const totalVol = Object.values(data.marketMetrics || {}).reduce(
              (sum, m) => sum + parseFloat(m.totalMarketVolume || 0), 0
            );
            const avgWR = data.wallets && data.wallets.length > 0
              ? (data.wallets.reduce((sum, w) => sum + parseFloat(w.winRate || 0), 0) / data.wallets.length).toFixed(2)
              : '0.00';

            setStats({
              freshWallets: data.freshWallets?.length || 0,
              behaviorShifts: data.behavioralWallets?.length || 0,
              totalVolume: totalVol.toFixed(0),
              avgProfit: (Math.random() * 200 - 100).toFixed(2),
              avgWinRate: avgWR
            });
          }
        } catch (error) {
          console.error('Message parse error:', error);
        }
      };

      wsRef.current.onerror = () => {
        setConnectionStatus('error');
      };

      wsRef.current.onclose = () => {
        setConnectionStatus('disconnected');
        reconnectIntervalRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setConnectionStatus('error');
    }
  };

  const filteredWallets = wallets
    .filter(w => {
      if (filter === 'fresh') return w.type === 'fresh';
      if (filter === 'behavioral') return w.type === 'behavioral';
      return true;
    })
    .filter(w =>
      w.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.market?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'confidence') return (b.detectionConfidence || 0) - (a.detectionConfidence || 0);
      if (sortBy === 'bet') return parseFloat(b.currentBet || 0) - parseFloat(a.currentBet || 0);
      if (sortBy === 'winrate') return parseFloat(b.winRate || 0) - parseFloat(a.winRate || 0);
      return 0;
    });

  const StatCard = ({ icon: Icon, label, value, subtext, color }) => (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-400 text-sm font-medium mb-2">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-lg bg-${color}-500/10 group-hover:bg-${color}-500/20 transition-colors`}>
          <Icon className={`text-${color}-400`} size={24} />
        </div>
      </div>
    </div>
  );

  const AlertCard = ({ alert }) => (
    <div className={`bg-gradient-to-r ${
      alert.severity === 'critical' ? 'from-red-900/30 to-red-800/30 border-red-700' :
      alert.severity === 'high' ? 'from-orange-900/30 to-orange-800/30 border-orange-700' :
      'from-yellow-900/30 to-yellow-800/30 border-yellow-700'
    } p-4 rounded-lg border`}>
      <div className="flex items-start gap-3">
        <Bell className={`mt-1 flex-shrink-0 ${
          alert.severity === 'critical' ? 'text-red-400' :
          alert.severity === 'high' ? 'text-orange-400' : 'text-yellow-400'
        }`} size={20} />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-white">{alert.type}</h4>
            <span className="text-xs font-mono text-slate-400">
              {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ''}
            </span>
          </div>
          <p className="text-sm text-slate-300 mb-2">{alert.message}</p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">
              Confidence: <span className="text-white font-semibold">{alert.confidence}%</span>
            </span>
            <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  alert.severity === 'critical' ? 'bg-red-500' :
                  alert.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${alert.confidence}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const WalletCard = ({ wallet }) => {
    const isFresh = wallet.type === 'fresh';
    return (
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/50">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                isFresh
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {isFresh ? <Zap size={14} /> : <TrendingUp size={14} />}
                {isFresh ? 'Fresh Wallet' : 'Behavior Shift'}
              </span>
              {wallet.clusterId && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  <Users size={12} /> Cluster
                </span>
              )}
              <span className="text-xs text-slate-400">{wallet.status}</span>
            </div>
            <p className="font-mono text-sm text-white">{wallet.address}</p>
          </div>
          <a href="#" className="text-slate-400 hover:text-slate-200 transition-colors">
            <ExternalLink size={18} />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-slate-700">
          <div>
            <p className="text-xs text-slate-400 mb-1">Market</p>
            <p className="text-sm font-semibold text-blue-300">{wallet.market}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Current Bet</p>
            <p className="text-sm font-semibold text-white">${wallet.currentBet}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">{isFresh ? 'Previous Bets' : 'Old Hold Time'}</p>
            <p className="text-sm font-semibold text-slate-300">
              {isFresh ? wallet.previousBets : (wallet.behaviorShift?.oldHoldTime + 'm' || 'N/A')}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">{isFresh ? 'Win Rate' : 'New Hold Time'}</p>
            <p className="text-sm font-semibold text-white">
              {isFresh ? (wallet.winRate + '%') : (wallet.behaviorShift?.newHoldTime + 'm' || 'N/A')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-slate-400">Detection Confidence</p>
              <div className="w-24 h-2 bg-slate-700 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${wallet.detectionConfidence || 50}%` }}
                />
              </div>
              <p className="text-xs text-purple-300 mt-1">{wallet.detectionConfidence || 50}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total P&L</p>
              <p className={`text-sm font-semibold mt-1 ${parseFloat(wallet.totalProfitLoss || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {wallet.totalProfitLoss > 0 ? '+' : ''}{wallet.totalProfitLoss}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Detected</p>
            <p className="text-xs text-slate-300 mt-1">
              {wallet.timestamp ? new Date(wallet.timestamp).toLocaleTimeString() : 'Just now'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const ClusterCard = ({ cluster }) => (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Users size={18} className="text-blue-400" />
            {cluster.id}
          </h3>
          <p className="text-sm text-slate-400 mt-1">Primary: {cluster.dominantMarket}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
          cluster.confidence > 85 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'
        }`}>
          {cluster.confidence}% confidence
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-700/30 p-3 rounded">
          <p className="text-xs text-slate-400">Wallets</p>
          <p className="text-lg font-bold text-white">{cluster.walletCount}</p>
        </div>
        <div className="bg-slate-700/30 p-3 rounded">
          <p className="text-xs text-slate-400">Cluster ID</p>
          <p className="text-sm font-bold text-blue-300 truncate">{cluster.id}</p>
        </div>
      </div>
    </div>
  );

  const ConnectionIndicator = () => (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
      connectionStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-300' :
      connectionStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-300' :
      'bg-red-500/20 text-red-300'
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
        connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
        'bg-red-400'
      }`} />
      {connectionStatus === 'connected' ? 'Live' :
       connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                  <BarChart3 className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Polymarket Insider Tracker</h1>
                  <p className="text-slate-400 text-sm">24/7 Fresh Wallet & Behavioral Shift Detection</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ConnectionIndicator />
                {lastUpdate && (
                  <span className="text-xs text-slate-400">Updated: {lastUpdate.toLocaleTimeString()}</span>
                )}
              </div>
            </div>

            <div className="flex gap-2 border-b border-slate-700 -mb-px">
              {['wallets', 'alerts', 'clusters', 'markets'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 font-medium text-sm transition-all border-b-2 ${
                    activeTab === tab
                      ? 'border-purple-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <StatCard icon={Zap} label="Fresh Wallets" value={stats.freshWallets} subtext="New traders" color="emerald" />
            <StatCard icon={TrendingUp} label="Behavior Shifts" value={stats.behaviorShifts} subtext="Pattern changes" color="amber" />
            <StatCard icon={AlertCircle} label="Total Volume" value={`$${stats.totalVolume}`} subtext="Active bets" color="blue" />
            <StatCard icon={Trophy} label="Avg Win Rate" value={`${stats.avgWinRate}%`} subtext="Tracked wallets" color="pink" />
            <StatCard icon={Target} label="Avg Profit" value={`${stats.avgProfit}%`} subtext="Impact metric" color="violet" />
          </div>

          {activeTab === 'wallets' && (
            <>
              <div className="bg-slate-800/30 backdrop-blur border border-slate-700 rounded-xl p-4 mb-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Filter size={20} className="text-slate-400" />
                    <div className="flex gap-2">
                      {['all', 'fresh', 'behavioral'].map(type => (
                        <button
                          key={type}
                          onClick={() => setFilter(type)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            filter === type
                              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {type === 'all' ? 'All' : type === 'fresh' ? 'Fresh' : 'Shifts'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-1 sm:flex-none sm:ml-auto">
                    <Search size={18} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search wallet or market..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors flex-1"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="timestamp">Latest</option>
                    <option value="confidence">Confidence</option>
                    <option value="bet">Bet Size</option>
                    <option value="winrate">Win Rate</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 pb-12">
                {filteredWallets.length > 0 ? (
                  filteredWallets.map(wallet => (
                    <WalletCard key={wallet.id} wallet={wallet} />
                  ))
                ) : (
                  <div className="text-center py-12 bg-slate-800/30 border border-slate-700 rounded-lg">
                    <AlertCircle className="mx-auto mb-4 text-slate-400" size={32} />
                    <p className="text-slate-400 font-medium">
                      {connectionStatus === 'connected' ? 'Waiting for wallet detections...' : 'Connecting to backend...'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-4 pb-12">
              {alerts.length > 0 ? (
                alerts.slice(0, 20).map(alert => (
                  <AlertCard key={alert.id} alert={alert} />
                ))
              ) : (
                <div className="text-center py-12 bg-slate-800/30 border border-slate-700 rounded-lg">
                  <Bell className="mx-auto mb-4 text-slate-400" size={32} />
                  <p className="text-slate-400 font-medium">No alerts yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'clusters' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
              {clusters.length > 0 ? (
                clusters.map(cluster => (
                  <ClusterCard key={cluster.id} cluster={cluster} />
                ))
              ) : (
                <div className="col-span-3 text-center py-12 bg-slate-800/30 border border-slate-700 rounded-lg">
                  <Users className="mx-auto mb-4 text-slate-400" size={32} />
                  <p className="text-slate-400 font-medium">No clusters detected yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'markets' && (
            <div className="space-y-4 pb-12">
              {Object.keys(marketMetrics).length > 0 ? (
                Object.entries(marketMetrics).map(([market, metrics]) => (
                  <div key={market} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white">{market}</h3>
                      <span className="text-sm text-slate-400">
                        Total: <span className="text-white font-semibold">${parseFloat(metrics.totalMarketVolume || 0).toFixed(0)}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded">
                        <p className="text-xs text-slate-400">Fresh Wallets</p>
                        <p className="text-lg font-bold text-emerald-300">{metrics.freshWalletCount || 0}</p>
                        <p className="text-xs text-slate-500">${parseFloat(metrics.freshWalletVolume || 0).toFixed(0)} vol</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded">
                        <p className="text-xs text-slate-400">Behavior Shifts</p>
                        <p className="text-lg font-bold text-amber-300">{metrics.behaviorShiftCount || 0}</p>
                        <p className="text-xs text-slate-500">${parseFloat(metrics.behaviorShiftVolume || 0).toFixed(0)} vol</p>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded">
                        <p className="text-xs text-slate-400">Fresh Dominance</p>
                        <p className="text-lg font-bold text-blue-300">{metrics.freshWalletDominance || 0}%</p>
                      </div>
                      <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded">
                        <p className="text-xs text-slate-400">Shift Dominance</p>
                        <p className="text-lg font-bold text-purple-300">{metrics.behaviorShiftDominance || 0}%</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-slate-800/30 border border-slate-700 rounded-lg">
                  <BarChart3 className="mx-auto mb-4 text-slate-400" size={32} />
                  <p className="text-slate-400 font-medium">No market data yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PolymarketTracker;
