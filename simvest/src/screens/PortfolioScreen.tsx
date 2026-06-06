import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  InteractionManager,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  userService,
  PortfolioPosition,
  TradingHistory,
  UserProfile,
  computeWinRateFromTradingHistory,
} from '../services/userService';
import { referralService } from '../services/referralService';
import { Colors, Spacing, BorderRadius, Typography, Shadows, STARTING_CASH, Glass } from '../constants/theme';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import { getPeriodReturns } from '../utils/portfolioCalculations';
import AIExplainModal, { AIExplainStatus } from '../components/AIExplainModal';
import { explainPortfolio } from '../services/aiExplainService';
import { AI_EXPLAIN_ERRORS } from '../services/aiExplainService';
import TradeModal from '../components/TradeModal';

type PortfolioTab = 'overview' | 'holdings' | 'history' | 'performance';
type HoldingsFilter = 'all' | 'gainers' | 'losers';
type HistoryPeriod = 'all' | 'week' | 'month' | 'year';
type SortOrder = 'value_desc' | 'value_asc' | 'return_desc' | 'return_asc';

type TradeModalState = {
  visible: boolean;
  action: 'buy' | 'sell';
  symbol: string;
};

type PortfolioScreenProps = {
  onNavigateToProfile?: () => void;
  onNavigateToStock?: (symbol: string) => void;
};

function timeAgo(timestamp: any): string {
  let ms: number;
  if (timestamp?.toDate) {
    ms = timestamp.toDate().getTime();
  } else if (timestamp) {
    ms = new Date(timestamp).getTime();
  } else {
    return '';
  }
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Pulsing placeholder blocks for initial load */
function PortfolioSkeleton() {
  const pulse = useRef(new Animated.Value(0.42)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.42, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const Bone = ({ style }: { style: object }) => (
    <Animated.View style={[style, { opacity: pulse, backgroundColor: Colors.border }]} />
  );

  const tabs = ['Overview', 'Holdings', 'History', 'Performance'];

  return (
    <View style={styles.container}>
      <View style={styles.headerGlowBottom}>
        <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Bone style={{ width: 120, height: 12, borderRadius: 4, marginBottom: 8 }} />
              <Bone style={{ width: 200, height: 28, borderRadius: 6, marginBottom: 6 }} />
              <Bone style={{ width: 160, height: 14, borderRadius: 4 }} />
            </View>
            <Bone style={{ width: 88, height: 38, borderRadius: 999 }} />
          </View>
          <View style={styles.statsRow}>
            {[0, 1, 2].map((i) => (
              <React.Fragment key={i}>
                {i > 0 ? <View style={styles.statBoxDivider} /> : null}
                <View style={[styles.statBox, { gap: 6 }]}>
                  <Bone style={{ width: 36, height: 10, borderRadius: 3 }} />
                  <Bone style={{ width: 56, height: 16, borderRadius: 4 }} />
                </View>
              </React.Fragment>
            ))}
          </View>
          <Bone style={{ alignSelf: 'stretch', height: 40, borderRadius: 10, marginTop: 6, marginBottom: 10 }} />
        </View>
      </View>

      <View style={styles.tabBar}>
        {tabs.map((label) => (
          <View key={label} style={[styles.tab, { opacity: 0.5 }]}>
            <Text style={styles.tabText}>{label}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.metricsGrid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.metricCard, { minHeight: 96 }]}>
              <Bone style={{ width: 34, height: 34, borderRadius: 8, marginBottom: Spacing.sm }} />
              <Bone style={{ width: '70%', height: 11, borderRadius: 3, marginBottom: 8 }} />
              <Bone style={{ width: '55%', height: 18, borderRadius: 4 }} />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Bone style={{ width: 110, height: 16, borderRadius: 4, marginBottom: Spacing.sm }} />
          <View style={styles.periodRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.periodCard, { minHeight: 72 }]}>
                <Bone style={{ width: 28, height: 10, borderRadius: 3, marginBottom: 8 }} />
                <Bone style={{ width: '80%', height: 14, borderRadius: 3, marginBottom: 4 }} />
                <Bone style={{ width: '60%', height: 12, borderRadius: 3 }} />
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.section, { marginTop: 28 }]}>
          <Bone style={{ width: 100, height: 16, borderRadius: 4, marginBottom: 14 }} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.topPositionCard, { borderColor: Colors.border }]}>
              <View style={{ flex: 1 }}>
                <Bone style={{ width: 48, height: 16, borderRadius: 4, marginBottom: 6 }} />
                <Bone style={{ width: 64, height: 12, borderRadius: 3 }} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Bone style={{ width: 72, height: 16, borderRadius: 4, marginBottom: 6 }} />
                <Bone style={{ width: 88, height: 12, borderRadius: 3 }} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function tradeMatchesPeriod(timestamp: any, period: HistoryPeriod): boolean {
  if (period === 'all') return true;
  let ms: number;
  if (timestamp?.toDate) ms = timestamp.toDate().getTime();
  else ms = new Date(timestamp).getTime();
  const now = Date.now();
  if (period === 'week') return now - ms <= 7 * 24 * 60 * 60 * 1000;
  if (period === 'month') return now - ms <= 30 * 24 * 60 * 60 * 1000;
  if (period === 'year') return now - ms <= 365 * 24 * 60 * 60 * 1000;
  return true;
}

const PortfolioScreen: React.FC<PortfolioScreenProps> = ({ onNavigateToProfile, onNavigateToStock }) => {
  const { user } = useAuth();
  const isMountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [history, setHistory] = useState<TradingHistory[]>([]);
  const [realizedPnL, setRealizedPnL] = useState(0);
  const [snapshotValues, setSnapshotValues] = useState<{ ytd: number | null; oneWeek: number | null; oneMonth: number | null; oneYear: number | null }>({ ytd: null, oneWeek: null, oneMonth: null, oneYear: null });
  const [pricesRefreshing, setPricesRefreshing] = useState(false);
  const [referralEarningsTotal, setReferralEarningsTotal] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<PortfolioTab>('overview');
  const [holdingsFilter, setHoldingsFilter] = useState<HoldingsFilter>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('value_desc');
  const [periodInfoVisible, setPeriodInfoVisible] = useState(false);
  const [referralInfoVisible, setReferralInfoVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Trade modal
  const [tradeModal, setTradeModal] = useState<TradeModalState>({ visible: false, action: 'buy', symbol: '' });

  // AI explain
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIExplainStatus>('idle');
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiErrorCode, setAiErrorCode] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async (isRefresh = false) => {
    if (!user?.uid) return;
    const uid = user.uid;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // Reconcile in parallel with reads - same work as before, less wall-clock blocking first paint.
      const [, referralStats, userProfile, stalePositions, trades, realized] = await Promise.all([
        referralService.reconcileReferralBonusCash(uid),
        referralService.getReferralStats(uid, { skipReconcile: true }),
        userService.getUserProfile(uid),
        userService.getUserPortfolio(uid, false),
        userService.getUserTradingHistory(uid, 100),
        userService.getRealizedPnL(uid),
      ]);
      if (!isMountedRef.current) return;
      setReferralEarningsTotal(referralStats?.totalEarned ?? 0);

      setProfile(userProfile);
      setPositions(stalePositions);
      setHistory(trades);
      setRealizedPnL(realized);
      setLoading(false);
      setRefreshing(false);

      // Defer phase 2 until after transitions/initial paint so the shell shows immediately.
      InteractionManager.runAfterInteractions(() => {
        if (!isMountedRef.current) return;
        void (async () => {
          setPricesRefreshing(true);
          try {
            const now = new Date();
            const ytdDate = new Date(now.getFullYear(), 0, 1);
            const oneWeekDate = new Date(now); oneWeekDate.setDate(now.getDate() - 7);
            const oneMonthDate = new Date(now); oneMonthDate.setMonth(now.getMonth() - 1);
            const oneYearDate = new Date(now); oneYearDate.setFullYear(now.getFullYear() - 1);

            const [freshPositions, ytdSnap, weekSnap, monthSnap, yearSnap] = await Promise.all([
              userService.getUserPortfolio(uid, true),
              userService.getPortfolioSnapshotOnOrBefore(uid, ytdDate),
              userService.getPortfolioSnapshotOnOrBefore(uid, oneWeekDate),
              userService.getPortfolioSnapshotOnOrBefore(uid, oneMonthDate),
              userService.getPortfolioSnapshotOnOrBefore(uid, oneYearDate),
            ]);

            if (!isMountedRef.current) return;
            setPositions(freshPositions);
            setSnapshotValues({ ytd: ytdSnap, oneWeek: weekSnap, oneMonth: monthSnap, oneYear: yearSnap });

            const updatedProfile = await userService.getUserProfile(uid);
            if (!isMountedRef.current) return;
            if (updatedProfile) setProfile(updatedProfile);

            const total = updatedProfile?.totalPortfolioValue ?? userProfile?.totalPortfolioValue ?? STARTING_CASH;
            userService.savePortfolioSnapshot(uid, total).catch(() => {});
          } catch (bgError) {
            console.error('Error refreshing live prices:', bgError);
          } finally {
            if (isMountedRef.current) setPricesRefreshing(false);
          }
        })();
      });
    } catch (error) {
      console.error('Error loading portfolio:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => { fetchPortfolio(false); }, [fetchPortfolio]);

  // --- Derived values ---
  const totalValue = profile?.totalPortfolioValue ?? STARTING_CASH;
  const allTimeReturn = profile?.totalReturn ?? 0;
  const marketValue = useMemo(() => positions.reduce((s, p) => s + p.totalValue, 0), [positions]);
  const cash = useMemo(() => profile?.cash != null ? profile.cash : Math.max(0, totalValue - marketValue), [profile, totalValue, marketValue]);
  const unrealizedPnL = useMemo(() => positions.reduce((s, p) => s + p.totalReturn, 0), [positions]);

  // Today P/L from previousClose prices
  const todayPnL = useMemo(() => positions.reduce((sum, p) => {
    if (p.previousClose != null && p.previousClose > 0) {
      return sum + (p.currentPrice - p.previousClose) * p.shares;
    }
    return sum;
  }, 0), [positions]);

  const allTimePct = useMemo(() => {
    const costBasis = totalValue - allTimeReturn;
    return costBasis > 0 ? (allTimeReturn / costBasis) * 100 : 0;
  }, [totalValue, allTimeReturn]);

  const periodReturns = useMemo(() => getPeriodReturns(
    history, STARTING_CASH, totalValue, snapshotValues, allTimeReturn
  ), [history, totalValue, snapshotValues, allTimeReturn]);

  const bestPosition = useMemo(() => {
    if (positions.length === 0) return null;
    return [...positions].sort((a, b) => b.returnPercentage - a.returnPercentage)[0];
  }, [positions]);

  const winRate = useMemo(() => computeWinRateFromTradingHistory(history), [history]);

  // --- Holdings filters/sort ---
  const filteredHoldings = useMemo(() => {
    let list = [...positions];
    if (holdingsFilter === 'gainers') list = list.filter(p => p.totalReturn >= 0);
    if (holdingsFilter === 'losers') list = list.filter(p => p.totalReturn < 0);
    switch (sortOrder) {
      case 'value_desc': list.sort((a, b) => b.totalValue - a.totalValue); break;
      case 'value_asc': list.sort((a, b) => a.totalValue - b.totalValue); break;
      case 'return_desc': list.sort((a, b) => b.returnPercentage - a.returnPercentage); break;
      case 'return_asc': list.sort((a, b) => a.returnPercentage - b.returnPercentage); break;
    }
    return list;
  }, [positions, holdingsFilter, sortOrder]);

  const filteredHistory = useMemo(() => history.filter(t => {
    const matchesPeriod = tradeMatchesPeriod(t.timestamp, historyPeriod);
    const matchesSearch = historySearch.trim() === '' || t.symbol.toUpperCase().includes(historySearch.toUpperCase());
    return matchesPeriod && matchesSearch;
  }), [history, historyPeriod, historySearch]);

  // --- AI explain ---
  const handleAIExplain = async () => {
    if (!user?.uid) return;
    setAiModalVisible(true);
    setAiStatus('loading');
    setAiExplanation(null);
    setAiErrorCode(null);
    try {
      const result = await explainPortfolio(user.uid, {
        totalPortfolioValue: totalValue,
        cash,
        positions: positions.map(p => ({ symbol: p.symbol, shares: p.shares, totalValue: p.totalValue })),
      });
      setAiExplanation(result);
      setAiStatus('success');
    } catch (err: any) {
      setAiErrorCode(err?.message ?? AI_EXPLAIN_ERRORS.UNKNOWN);
      setAiStatus('error');
    }
  };

  // --- Trade modal ---
  const openTradeModal = (action: 'buy' | 'sell', position: PortfolioPosition) => {
    setTradeModal({ visible: true, action, symbol: position.symbol });
  };

  if (loading) {
    return <PortfolioSkeleton />;
  }

  const tabs: { key: PortfolioTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'holdings', label: 'Holdings' },
    { key: 'history', label: 'History' },
    { key: 'performance', label: 'Performance' },
  ];

  return (
    <View style={styles.container}>
      {/* ── Fixed header (always visible) ── */}
      <View style={styles.headerGlowBottom}>
        <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View>
            <View style={styles.totalLabelRow}>
              <Text style={styles.totalLabel}>Total Portfolio Value</Text>
              {referralEarningsTotal > 0 && (
                <TouchableOpacity
                  style={styles.totalLabelInfoHit}
                  onPress={() => setReferralInfoVisible(true)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityLabel="Referral rewards info"
                >
                  <Ionicons name="information-circle-outline" size={15} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.totalValue}>{formatCurrency(totalValue)}</Text>
            <Text style={[styles.dayChange, { color: todayPnL >= 0 ? Colors.success : Colors.error }]}>
              {todayPnL >= 0 ? '+' : ''}{formatCurrency(todayPnL)} ({formatPercentage(totalValue > 0 ? (todayPnL / (totalValue - todayPnL)) * 100 : 0, true)})
            </Text>
          </View>
          <TouchableOpacity
            style={styles.tradeButton}
            onPress={() => setTradeModal({ visible: true, action: 'buy', symbol: '' })}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color={Colors.white} />
            <Text style={styles.tradeButtonText}>Trade</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Cash</Text>
            <Text style={styles.statBoxValue}>{formatCurrency(cash)}</Text>
          </View>
          <View style={styles.statBoxDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Invested</Text>
            <Text style={styles.statBoxValue}>{formatCurrency(marketValue)}</Text>
          </View>
          <View style={styles.statBoxDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>All-time P/L</Text>
            <Text style={[styles.statBoxValue, { color: allTimeReturn >= 0 ? Colors.success : Colors.error }]}>
              {allTimeReturn >= 0 ? '+' : ''}{formatCurrency(allTimeReturn)}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.aiButton} onPress={handleAIExplain} activeOpacity={0.8}>
          <Ionicons name="sparkles" size={18} color={Colors.primary} />
          <Text style={styles.aiButtonText}>Explain my portfolio (AI)</Text>
        </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar - outside the card */}
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Scrollable tab content ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchPortfolio(true)} tintColor={Colors.primary} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard label="Unrealized P/L" value={formatCurrency(unrealizedPnL)} color={unrealizedPnL >= 0 ? Colors.success : Colors.error} icon="trending-up" />
              <MetricCard label="Realized P/L" value={formatCurrency(realizedPnL)} color={realizedPnL >= 0 ? Colors.success : Colors.error} icon="cash" />
              <MetricCard label="Today P/L" value={formatCurrency(todayPnL)} color={todayPnL >= 0 ? Colors.success : Colors.error} icon="wallet" />
              <MetricCard label="All-Time Return" value={formatCurrency(allTimeReturn)} color={allTimeReturn >= 0 ? Colors.success : Colors.error} icon="stats-chart" />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Period returns</Text>
                <TouchableOpacity onPress={() => setPeriodInfoVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <View style={styles.periodRow}>
                {[
                  { label: 'YTD', r: periodReturns.ytd },
                  { label: '1W', r: periodReturns.oneWeek },
                  { label: '1M', r: periodReturns.oneMonth },
                  { label: '1Y', r: periodReturns.oneYear },
                ].map(({ label, r }) => (
                  <View key={label} style={styles.periodCard}>
                    <Text style={styles.periodLabel}>{label}</Text>
                    <Text style={[styles.periodDollar, { color: r.changeDollars >= 0 ? Colors.success : Colors.error }]}>
                      {r.changeDollars >= 0 ? '+' : ''}{formatCurrency(r.changeDollars)}
                    </Text>
                    <Text style={[styles.periodPct, { color: r.changePercent >= 0 ? Colors.success : Colors.error }]}>
                      {r.changePercent >= 0 ? '+' : ''}{r.changePercent.toFixed(2)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {positions.length > 0 && (
              <View style={[styles.section, { marginTop: 28 }]}>
                <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>Top Positions</Text>
                {[...positions].sort((a, b) => b.totalValue - a.totalValue).slice(0, 5).map((pos) => {
                  const dayPct = pos.previousClose != null && pos.previousClose > 0
                    ? ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100 : 0;
                  const dayChange = pos.previousClose != null && pos.previousClose > 0
                    ? pos.currentPrice - pos.previousClose : 0;
                  return (
                    <TouchableOpacity
                      key={pos.symbol}
                      style={styles.topPositionCard}
                      onPress={() => onNavigateToStock?.(pos.symbol)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.topPositionLeft}>
                        <Text style={styles.topPositionSymbol}>{pos.symbol}</Text>
                        <Text style={styles.topPositionShares}>{pos.shares} shares</Text>
                      </View>
                      <View style={styles.topPositionRight}>
                        <Text style={styles.topPositionValue}>{formatCurrency(pos.currentPrice)}</Text>
                        <Text style={[styles.topPositionDay, { color: dayPct >= 0 ? Colors.success : Colors.error }]}>
                          {dayChange >= 0 ? '+' : ''}{formatCurrency(dayChange)} ({dayPct >= 0 ? '+' : ''}{dayPct.toFixed(2)}%)
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── HOLDINGS ── */}
        {activeTab === 'holdings' && (
          <>
            <View style={styles.holdingsControls}>
              <View style={styles.filterChips}>
                {(['all', 'gainers', 'losers'] as HoldingsFilter[]).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, holdingsFilter === f && styles.chipActive]}
                    onPress={() => setHoldingsFilter(f)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, holdingsFilter === f && styles.chipTextActive]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.sortButton} onPress={() => setSortModalVisible(true)} activeOpacity={0.8}>
                <Ionicons name="swap-vertical-outline" size={15} color="#9AA4B2" />
                <Text style={styles.sortButtonText}>Sort</Text>
              </TouchableOpacity>
            </View>

            {filteredHoldings.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No holdings match this filter.</Text>
              </View>
            ) : (
              filteredHoldings.map(pos => {
                const dayPnL = pos.previousClose != null && pos.previousClose > 0
                  ? (pos.currentPrice - pos.previousClose) * pos.shares
                  : 0;
                const dayPct = pos.previousClose != null && pos.previousClose > 0
                  ? ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100
                  : 0;
                return (
                  <View key={pos.symbol} style={styles.holdingCard}>
                    <TouchableOpacity onPress={() => onNavigateToStock?.(pos.symbol)} activeOpacity={0.85}>
                      {/* Symbol + value row */}
                      <View style={styles.holdingCardTop}>
                        <Text style={styles.holdingCardSymbol}>{pos.symbol}</Text>
                        <Text style={styles.holdingCardValue}>{formatCurrency(pos.totalValue)}</Text>
                      </View>
                      {/* Shares + day change row */}
                      <View style={styles.holdingCardSubRow}>
                        <Text style={styles.holdingCardShares}>{pos.shares} shares</Text>
                        <Text style={[styles.holdingCardDay, { color: dayPnL >= 0 ? Colors.success : Colors.error }]}>
                          {dayPnL >= 0 ? '+' : ''}{formatCurrency(dayPnL)} ({formatPercentage(dayPct, true)})
                        </Text>
                      </View>
                      {/* Meta rows */}
                      <View style={styles.holdingCardMeta}>
                        <HoldingMetaRow label="Avg Price" value={formatCurrency(pos.avgPrice)} />
                        <HoldingMetaRow label="Current Price" value={formatCurrency(pos.currentPrice)} />
                        <HoldingMetaRow
                          label="Total P/L"
                          value={`${pos.totalReturn >= 0 ? '+' : ''}${formatCurrency(pos.totalReturn)}`}
                          color={pos.totalReturn >= 0 ? Colors.success : Colors.error}
                        />
                        <HoldingMetaRow
                          label="Total Return %"
                          value={`${pos.returnPercentage >= 0 ? '+' : ''}${pos.returnPercentage.toFixed(2)}%`}
                          color={pos.returnPercentage >= 0 ? Colors.success : Colors.error}
                        />
                      </View>
                    </TouchableOpacity>
                    {/* Buy More / Sell pill buttons */}
                    <View style={styles.holdingCardButtons}>
                      <TouchableOpacity
                        style={[styles.holdingActionBtn, styles.buyMoreBtn]}
                        onPress={() => openTradeModal('buy', pos)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.holdingActionBtnText}>Buy More</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.holdingActionBtn, styles.sellBtn]}
                        onPress={() => openTradeModal('sell', pos)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.holdingActionBtnText}>Sell</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ── HISTORY ── */}
        {activeTab === 'history' && (
          <>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={Colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by symbol..."
                placeholderTextColor={Colors.textTertiary}
                value={historySearch}
                onChangeText={setHistorySearch}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.periodFilters}>
              {([['all', 'All Time'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']] as [HistoryPeriod, string][]).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.periodChip, historyPeriod === key && styles.periodChipActive]}
                  onPress={() => setHistoryPeriod(key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.periodChipText, historyPeriod === key && styles.periodChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredHistory.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No trades found.</Text>
              </View>
            ) : (
              filteredHistory.map(trade => (
                <TouchableOpacity
                  key={trade.id}
                  style={styles.tradeCard}
                  onPress={() => onNavigateToStock?.(trade.symbol)}
                  activeOpacity={0.75}
                >
                  <View style={styles.tradeCardTop}>
                    <View style={styles.tradeCardLeft}>
                      <View style={[styles.tradeBadge, trade.action === 'buy' ? styles.buyBadge : styles.sellBadge]}>
                        <Text style={styles.tradeBadgeText}>{trade.action.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.tradeCardSymbol}>{trade.symbol}</Text>
                    </View>
                    <Text style={styles.tradeCardTime}>{timeAgo(trade.timestamp)}</Text>
                  </View>
                  <View style={styles.tradeCardDivider} />
                  <TradeDetailRow label="Shares" value={String(trade.shares)} />
                  <TradeDetailRow label="Price" value={formatCurrency(trade.price)} />
                  <TradeDetailRow label="Total" value={formatCurrency(trade.totalAmount)} />
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* ── PERFORMANCE ── */}
        {activeTab === 'performance' && (
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Total Trades"
              value={String(history.length)}
              color={Colors.primary}
              icon="bar-chart"
            />
            <MetricCard
              label="Win Rate"
              value={winRate != null ? `${winRate.toFixed(1)}%` : '0.0%'}
              color={winRate != null && winRate >= 50 ? Colors.success : Colors.error}
              icon="trophy"
              subLabel={winRate == null ? 'No trades yet' : undefined}
            />
            <MetricCard
              label="Positions"
              value={String(positions.length)}
              color={Colors.info}
              icon="layers"
            />
            <MetricCard
              label="Best Return"
              value={bestPosition ? `+${bestPosition.returnPercentage.toFixed(1)}%` : 'N/A'}
              color={bestPosition && bestPosition.returnPercentage >= 0 ? Colors.success : Colors.error}
              icon="trending-up"
              subLabel={bestPosition?.symbol}
            />
          </View>
        )}
      </ScrollView>

      {/* ── Period returns info popup ── */}
      <Modal visible={periodInfoVisible} transparent animationType="fade" onRequestClose={() => setPeriodInfoVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPeriodInfoVisible(false)}>
          <View style={styles.infoPopup}>
            <View style={styles.infoPopupHeader}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
              <Text style={styles.infoPopupTitle}>Period Returns</Text>
            </View>
            <Text style={styles.infoPopupBody}>
              Shows how your portfolio has changed over each time window compared to today's value.{'\n\n'}
              Returns are calculated from saved daily snapshots when available. If no snapshot exists for the start of a period yet, we estimate using your trade history.{'\n\n'}
              Accuracy improves over time as daily snapshots build up - just keep using the app and the numbers will get more precise.
            </Text>
            <TouchableOpacity style={styles.infoPopupClose} onPress={() => setPeriodInfoVisible(false)}>
              <Text style={styles.infoPopupCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Referral rewards info (total value) ── */}
      <Modal visible={referralInfoVisible} transparent animationType="fade" onRequestClose={() => setReferralInfoVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReferralInfoVisible(false)}>
          <View style={styles.infoPopup}>
            <View style={styles.infoPopupHeader}>
              <Ionicons name="gift" size={20} color={Colors.primary} />
              <Text style={styles.infoPopupTitle}>Referral rewards</Text>
            </View>
            <Text style={styles.infoPopupBody}>
              Your total portfolio value includes {formatCurrency(referralEarningsTotal)} earned from referrals. That amount is already part of your cash and total value (not added on top).
            </Text>
            <TouchableOpacity style={styles.infoPopupClose} onPress={() => setReferralInfoVisible(false)}>
              <Text style={styles.infoPopupCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Sort modal ── */}
      <Modal visible={sortModalVisible} transparent animationType="fade" onRequestClose={() => setSortModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSortModalVisible(false)}>
          <View style={styles.sortModal}>
            <Text style={styles.sortModalTitle}>Sort by</Text>
            {([
              ['value_desc', 'Value: High to Low'],
              ['value_asc', 'Value: Low to High'],
              ['return_desc', 'Return: Best First'],
              ['return_asc', 'Return: Worst First'],
            ] as [SortOrder, string][]).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.sortOption, sortOrder === key && styles.sortOptionActive]}
                onPress={() => { setSortOrder(key); setSortModalVisible(false); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.sortOptionText, sortOrder === key && styles.sortOptionTextActive]}>{label}</Text>
                {sortOrder === key && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Trade modal (shared component) ── */}
      <TradeModal
        visible={tradeModal.visible}
        symbol={tradeModal.symbol}
        action={tradeModal.action}
        onClose={() => setTradeModal(m => ({ ...m, visible: false }))}
        onTradeComplete={() => fetchPortfolio(true)}
      />

      {/* ── AI explain modal ── */}
      <AIExplainModal
        visible={aiModalVisible}
        title="Portfolio Analysis"
        status={aiStatus}
        explanation={aiExplanation}
        errorCode={aiErrorCode}
        onClose={() => setAiModalVisible(false)}
      />
    </View>
  );
};

// ── Small helper components ──

type MetricCardProps = { label: string; value: string; color: string; icon: any; subLabel?: string };
const MetricCard: React.FC<MetricCardProps> = ({ label, value, color, icon, subLabel }) => (
  <View style={styles.metricCard}>
    <View style={[styles.metricIconBg, { backgroundColor: color + '22' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, { color }]}>{value}</Text>
    {subLabel != null && <Text style={styles.metricSubLabel}>{subLabel}</Text>}
  </View>
);

type HoldingMetaRowProps = { label: string; value: string; color?: string };
const HoldingMetaRow: React.FC<HoldingMetaRowProps> = ({ label, value, color }) => (
  <View style={styles.holdingMetaRow}>
    <Text style={styles.holdingMetaLabel}>{label}</Text>
    <Text style={[styles.holdingMetaValue, color ? { color } : {}]}>{value}</Text>
  </View>
);

type TradeDetailRowProps = { label: string; value: string };
const TradeDetailRow: React.FC<TradeDetailRowProps> = ({ label, value }) => (
  <View style={styles.tradeDetailRow}>
    <Text style={styles.tradeDetailLabel}>{label}</Text>
    <Text style={styles.tradeDetailValue}>{value}</Text>
  </View>
);

export default PortfolioScreen;

// ─── Design tokens used throughout ───────────────────────────────────────────
// Body text:   fontSize.md  (14px) - all labels, values, names
// Meta/sub:    fontSize.sm  (12px) - secondary info, badges, time-ago
// Section hdr: fontSize.lg  (16px) - section titles
// Hero only:   custom 28px  - total portfolio value
// Consistent card padding: Spacing.md (12px) everywhere
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Fixed header ──────────────────────────────────────────────────────────
  headerGlowBottom: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
    backgroundColor: '#0D1117',
  },
  headerContainer: {
    backgroundColor: '#0D1117',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  totalLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  totalLabel: {
    color: '#9AA4B2',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    paddingTop: 0,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  /** Centers the (i) with the label cap height (avoids text font metrics pushing the icon off). */
  totalLabelInfoHit: {
    width: 20,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -3,
    marginTop: 1,
  },
  totalValue: {
    color: '#E2E8F0',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  dayChange: {
    fontSize: 15,
    fontWeight: '600',
  },
  tradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#8B5CF6',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  tradeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Stats row - no card, just three columns with dividers ──────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 14,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statBoxDivider: { width: 1, height: 28, backgroundColor: '#1C2430' },
  statBoxLabel: {
    color: '#9AA4B2',
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 3,
  },
  statBoxValue: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  // ── AI button ─────────────────────────────────────────────────────────────
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#141825',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8B5CF680',
    paddingVertical: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  aiButtonText: {
    color: '#8B5CF6',
    fontWeight: '600',
    fontSize: 13,
  },

  // ── Tab bar - sits on app background, below card ─────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: '#1C2430',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#8B5CF6' },
  tabText: {
    color: '#9AA4B2',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: { color: '#8B5CF6' },

  // ── Scroll area ───────────────────────────────────────────────────────────
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 110 },

  // ── Metric cards (Overview + Performance) ─────────────────────────────────
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Glass.fillSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.postBorder,
    padding: Spacing.md,
    ...Shadows.small,
  },
  metricIconBg: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  metricLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  metricSubLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },

  // ── Section titles ────────────────────────────────────────────────────────
  section: { marginTop: Spacing.xl },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },

  // ── Period returns ────────────────────────────────────────────────────────
  periodRow: { flexDirection: 'row', gap: Spacing.sm },
  periodCard: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  periodLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: 4,
  },
  periodDollar: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  periodPct: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.normal,
    marginTop: 2,
  },

  // ── Top positions list ────────────────────────────────────────────────────
  listCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  topPositionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  topPositionLeft: {},
  topPositionRight: { alignItems: 'flex-end' },
  holdingSymbol: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  holdingShares: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  holdingValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  holdingReturn: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: 2,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },

  // ── Top positions cards ───────────────────────────────────────────────────
  topPositionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#090D12',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  topPositionSymbol: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  topPositionShares: {
    color: '#9AA4B2',
    fontSize: 13,
  },
  topPositionValue: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 4,
  },
  topPositionDay: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
  },

  // ── Holdings tab ──────────────────────────────────────────────────────────
  holdingsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterChips: { flexDirection: 'row', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2A3347',
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'transparent',
  },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: {
    color: '#9AA4B2',
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#2A3347',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  sortButtonText: {
    color: '#9AA4B2',
    fontSize: 14,
    fontWeight: '500',
  },

  holdingCard: {
    backgroundColor: Glass.fillSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.postBorder,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  holdingCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  holdingCardSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  holdingCardSymbol: {
    color: '#E2E8F0',
    fontSize: 20,
    fontWeight: '800',
  },
  holdingCardShares: {
    color: '#9AA4B2',
    fontSize: 13,
  },
  holdingCardValue: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  holdingCardDay: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
  },
  holdingCardMeta: {
    borderTopWidth: 1,
    borderTopColor: '#1C2430',
    paddingTop: 12,
    marginBottom: 14,
  },
  holdingMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  holdingMetaLabel: {
    color: '#9AA4B2',
    fontSize: 14,
  },
  holdingMetaValue: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  holdingCardButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  holdingActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 999,
  },
  holdingActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  buyMoreBtn: { backgroundColor: '#10B981' },
  sellBtn: { backgroundColor: '#EF4444' },

  // ── History tab ───────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0D1219',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2A38',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 15,
    paddingVertical: 0,
  },
  periodFilters: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  periodChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2A3347',
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'transparent',
  },
  periodChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  periodChipText: {
    color: '#9AA4B2',
    fontSize: 14,
    fontWeight: '500',
  },
  periodChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  tradeCard: {
    backgroundColor: '#090D12',
    borderRadius: 14,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginBottom: 12,
  },
  tradeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tradeCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tradeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  buyBadge: { backgroundColor: '#10B981' },
  sellBadge: { backgroundColor: '#EF4444' },
  tradeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  tradeCardSymbol: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '800',
  },
  tradeCardTime: {
    color: '#9AA4B2',
    fontSize: 13,
  },
  tradeCardDivider: {
    height: 1,
    backgroundColor: '#1C2430',
    marginBottom: 10,
  },
  tradeDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  tradeDetailLabel: {
    color: '#9AA4B2',
    fontSize: 14,
  },
  tradeDetailValue: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
  },

  // ── Period info popup ─────────────────────────────────────────────────────
  infoPopup: {
    backgroundColor: '#161B22',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#8B5CF640',
  },
  infoPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoPopupTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
  },
  infoPopupBody: {
    color: '#9AA4B2',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoPopupClose: {
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  infoPopupCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Sort bottom sheet ─────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sortModal: {
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: 44,
  },
  sortModalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sortOptionActive: {},
  sortOptionText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
  },
  sortOptionTextActive: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },

});
