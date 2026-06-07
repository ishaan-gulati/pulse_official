import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FeedCard from '../components/FeedCard';
import GlassSurface from '../components/GlassSurface';
import { useAuth } from '../contexts/AuthContext';
import { userService, UserProfile } from '../services/userService';
import { postsService } from '../services/postsService';
import { blockService } from '../services/blockService';
import { stockPriceService } from '../services/stockPriceService';
import { Ionicons } from '@expo/vector-icons';
import UserBadges from '../components/UserBadges';
import ReferModal from '../components/ReferModal';
import { referralService } from '../services/referralService';
import { FeedPost } from '../types';
import { Colors, Spacing, BorderRadius, Typography, Shadows, Glass } from '../constants/theme';
import { formatCurrency, formatPercentage } from '../utils/formatters';

type HomeScreenProps = {
  refreshKey?: number;
  onAppRefresh?: () => Promise<void>;
  onCompose?: () => void;
  onNavigateToAlerts?: () => void;
  onNavigateToPost?: (post: FeedPost) => void;
  onNavigateToStock?: (symbol: string) => void;
  onViewUser?: (uid: string) => void;
  /** Unacknowledged executed price alerts (bell badge) */
  priceAlertsUnreadCount?: number;
};

const MARKET_INDEXES = [
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'NASDAQ' },
  { symbol: 'DIA', name: 'Dow Jones' },
  { symbol: 'IWM', name: 'Russell 2000' },
  { symbol: 'BTC-USD', name: 'Bitcoin' },
  { symbol: 'GC=F', name: 'Gold' },
  { symbol: 'SI=F', name: 'Silver' },
] as const;

type MarketIndexRow = { symbol: string; name: string; price: number; change: number; changePercent: number };
const MARKET_INDEXES_CACHE_KEY = '@pulse/market_indexes_v1';
const MARKET_INDEXES_CACHE_TTL_MS = 120_000;

const HomeScreen: React.FC<HomeScreenProps> = ({
  refreshKey = 0,
  onAppRefresh,
  onCompose,
  onNavigateToAlerts,
  onNavigateToPost,
  onNavigateToStock,
  onViewUser,
  priceAlertsUnreadCount = 0,
}) => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [followingPosts, setFollowingPosts] = useState<FeedPost[]>([]);
  const [feedTab, setFeedTab] = useState<'foryou' | 'following'>('foryou');
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [referModalVisible, setReferModalVisible] = useState(false);
  const [todayPL, setTodayPL] = useState<number>(0);
  const [marketIndexes, setMarketIndexes] = useState<Array<{symbol: string; name: string; price: number; change: number; changePercent: number}>>([]);
  const [loadingIndexes, setLoadingIndexes] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastPostId, setLastPostId] = useState<string | null>(null);
  const hasIndexesRef = useRef(false);

  const fetchMarketIndexes = useCallback(async (refresh = false) => {
    if (refresh) {
      MARKET_INDEXES.forEach(({ symbol }) => stockPriceService.clearCacheForSymbol(symbol));
    }
    if (!hasIndexesRef.current) setLoadingIndexes(true);
    try {
      const quotesMap = await stockPriceService.getQuotes(MARKET_INDEXES.map(({ symbol }) => symbol));
      const indexesData = MARKET_INDEXES
        .map(({ symbol, name }) => {
          const quote = quotesMap.get(symbol.toUpperCase());
          if (!quote) return null;
          const change = quote.currentPrice - (quote.previousClose || quote.currentPrice);
          const changePercent = quote.previousClose && quote.previousClose > 0
            ? ((change / quote.previousClose) * 100)
            : quote.changePercent;
          return { symbol, name, price: quote.currentPrice, change, changePercent };
        })
        .filter(Boolean) as MarketIndexRow[];
      if (indexesData.length > 0) {
        hasIndexesRef.current = true;
        setMarketIndexes(indexesData);
        AsyncStorage.setItem(
          MARKET_INDEXES_CACHE_KEY,
          JSON.stringify({ data: indexesData, ts: Date.now() })
        ).catch(() => {});
      }
    } catch (error) {
      console.error('Error fetching market indexes:', error);
    } finally {
      setLoadingIndexes(false);
    }
  }, []);

  // Hydrate cached indexes instantly, then refresh via chart API in parallel with feed
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(MARKET_INDEXES_CACHE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as { data: MarketIndexRow[]; ts: number };
          if (
            Date.now() - parsed.ts < MARKET_INDEXES_CACHE_TTL_MS &&
            Array.isArray(parsed.data) &&
            parsed.data.length > 0
          ) {
            hasIndexesRef.current = true;
            setMarketIndexes(parsed.data);
            setLoadingIndexes(false);
          }
        }
      } catch {
        // ignore corrupt cache
      }
      if (!cancelled) fetchMarketIndexes();
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, refreshKey, fetchMarketIndexes]);

  // Fetch user data and posts
  const fetchData = async (isRefresh: boolean = false) => {
    if (!user?.uid) return;

    referralService.processPendingReferralClaims(user.uid).catch(() => {});

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Phase 1: profile + posts (batched author lookups + like/save from post doc) + blocked IDs
      const [profile, postsData, blockedIds] = await Promise.all([
        userService.getUserProfile(user.uid),
        postsService.getPosts(20, user.uid),
        blockService.getBlockedUserIds(user.uid).catch(() => [] as string[]),
      ]);

      setUserProfile(profile);

      const postsFiltered = postsData.filter((p) => !p.userId || !blockedIds.includes(p.userId));

      setPosts(postsFiltered);
      setHasMore(postsData.length === 20);
      if (postsFiltered.length > 0) setLastPostId(postsFiltered[postsFiltered.length - 1].id);

      setLoading(false);
      if (isRefresh) setRefreshing(false);

      // Portfolio day P/L (indexes load separately)
      const [positions, trades] = await Promise.all([
        userService.getUserPortfolio(user.uid, true).catch(() => []),
        userService.getUserTradingHistory(user.uid, 50).catch(() => []),
      ]);

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startMs = startOfToday.getTime();
      const boughtSymbolToday = new Set(
        (trades || [])
          .filter((t: any) => t.action === 'buy' && (t.timestamp?.toMillis ? t.timestamp.toMillis() : typeof t.timestamp === 'number' ? t.timestamp : 0) >= startMs)
          .map((t: any) => t.symbol)
      );
      const positionsArray = Array.isArray(positions) ? positions : [];
      const todayPLValue = positionsArray.reduce((sum: number, position: any) => {
        if (!position || position.shares == null) return sum;
        if (boughtSymbolToday.has(position.symbol)) {
          return sum + (position.currentPrice - position.avgPrice) * position.shares;
        }
        if (position.previousClose != null && position.previousClose > 0) {
          return sum + (position.currentPrice - position.previousClose) * position.shares;
        }
        return sum;
      }, 0);
      setTodayPL(todayPLValue);

    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load more posts (infinite scroll) - simplified for now
  const loadMorePosts = useCallback(async () => {
    if (!user?.uid || loadingMore || !hasMore) return;
    
    try {
      setLoadingMore(true);
      const [postsData, blockedIds] = await Promise.all([
        postsService.getPosts(50, user.uid),
        blockService.getBlockedUserIds(user.uid),
      ]);
      const postsFiltered = postsData.filter((p) => !p.userId || !blockedIds.includes(p.userId));

      if (postsFiltered.length <= posts.length) {
        setHasMore(false);
        return;
      }

      setPosts(postsFiltered);
      setHasMore(false); // Disable infinite scroll until pagination is implemented
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [user, loadingMore, hasMore, posts.length]);

  useEffect(() => {
    setLastPostId(null);
    setHasMore(true);
    fetchData(false);
  }, [user?.uid, user?.displayName, user?.username, refreshKey]);

  // Set up real-time listener for posts
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = postsService.subscribeToPosts(
      50,
      async (newPosts) => {
        const blockedIds = await blockService.getBlockedUserIds(user.uid);
        const filtered = newPosts.filter((p) => !p.userId || !blockedIds.includes(p.userId));
        setPosts(filtered);
      },
      user.uid
    );

    return () => unsubscribe();
  }, [user]);

  const loadFollowingPosts = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingFollowing(true);
    try {
      const data = await postsService.getFollowingPosts(user.uid, 50);
      setFollowingPosts(data);
    } catch {
      setFollowingPosts([]);
    } finally {
      setLoadingFollowing(false);
    }
  }, [user?.uid]);

  const handleFeedTabSwitch = (tab: 'foryou' | 'following') => {
    setFeedTab(tab);
    if (tab === 'following' && followingPosts.length === 0) {
      loadFollowingPosts();
    }
  };

  const onRefresh = async () => {
    await onAppRefresh?.();
    setLastPostId(null);
    setHasMore(true);
    fetchMarketIndexes(true);
    await fetchData(true);
    if (feedTab === 'following') loadFollowingPosts();
  };

  // Prefer Firestore display name; no email prefix, no "Welcome" - stay blank until a real name is available.
  const headerDisplayName =
    userProfile?.displayName?.trim() ||
    user?.displayName?.trim() ||
    user?.username?.trim() ||
    userProfile?.username?.trim() ||
    '';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            // Near bottom, load more
            if (!loadingMore && hasMore) {
              loadMorePosts();
            }
          }
        }}
        scrollEventThrottle={400}
      >
        {/* Header: show name, badges, bell, and Refer together after phase-1 load (no icons before name data) */}
        {user && !loading && (
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.welcomeSection}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName} numberOfLines={1}>{headerDisplayName}</Text>
                  {userProfile?.tags && userProfile.tags.length > 0 && (
                    <UserBadges tags={userProfile.tags} size="small" maxBadges={1} />
                  )}
                </View>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => onNavigateToAlerts?.()}
                  activeOpacity={0.75}
                >
                  <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
                  {priceAlertsUnreadCount > 0 && (
                    <View
                      style={[
                        styles.bellBadge,
                        priceAlertsUnreadCount > 1 && styles.bellBadgeMulti,
                      ]}
                    >
                      {priceAlertsUnreadCount > 1 ? (
                        <Text style={styles.bellBadgeText}>
                          {priceAlertsUnreadCount > 9 ? '9+' : priceAlertsUnreadCount}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.referButton}
                  onPress={() => setReferModalVisible(true)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="gift" size={20} color={Colors.primary} />
                  <Text style={styles.referButtonText}>Refer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {(loadingIndexes || marketIndexes.length > 0) && (
          <View style={styles.trendingSection}>
            <GlassSurface
              style={styles.indexesCard}
              borderRadius={BorderRadius.xl}
              variant="subtle"
              glow="purple"
            >
              <View style={styles.trendingHeader}>
                <Ionicons name="trending-up" size={18} color={Colors.primary} />
                <Text style={styles.trendingTitle}>Market Indexes</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trendingScroll}
                scrollEnabled={!loadingIndexes}
              >
                {loadingIndexes ? (
                  [1, 2, 3, 4].map((i) => (
                    <View key={i} style={[styles.trendingCard, styles.skeletonCard]}>
                      <View style={[styles.skeletonLine, { width: 44, marginBottom: 6 }]} />
                      <View style={[styles.skeletonLine, { width: 60, height: 9, marginBottom: 8 }]} />
                      <View style={[styles.skeletonLine, { width: 52, marginBottom: 4 }]} />
                      <View style={[styles.skeletonLine, { width: 36, height: 9 }]} />
                    </View>
                  ))
                ) : (
                  marketIndexes.map((index) => (
                    <TouchableOpacity
                      key={index.symbol}
                      style={styles.trendingCard}
                      onPress={() => onNavigateToStock?.(index.symbol)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.trendingSymbol}>{index.symbol}</Text>
                      <Text style={styles.trendingName} numberOfLines={1}>{index.name}</Text>
                      <Text style={styles.trendingPrice}>{formatCurrency(index.price)}</Text>
                      <Text style={[styles.trendingChange, { color: index.changePercent >= 0 ? Colors.success : Colors.error }]}>
                        {index.changePercent >= 0 ? '+' : ''}{formatPercentage(index.changePercent, false)}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </GlassSurface>
          </View>
        )}

        {/* Feed tab switcher */}
        <View style={styles.feedTabRow}>
          <TouchableOpacity
            style={[styles.feedTabBtn, feedTab === 'foryou' && styles.feedTabBtnActive]}
            onPress={() => handleFeedTabSwitch('foryou')}
            activeOpacity={0.8}
          >
            <Text style={[styles.feedTabText, feedTab === 'foryou' && styles.feedTabTextActive]}>For You</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.feedTabBtn, feedTab === 'following' && styles.feedTabBtnActive]}
            onPress={() => handleFeedTabSwitch('following')}
            activeOpacity={0.8}
          >
            <Text style={[styles.feedTabText, feedTab === 'following' && styles.feedTabTextActive]}>Following</Text>
          </TouchableOpacity>
        </View>

        {loading || (feedTab === 'following' && loadingFollowing) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : feedTab === 'following' && followingPosts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <GlassSurface style={styles.emptyCard} borderRadius={BorderRadius.xxxl} variant="elevated" glow="mixed">
              <View style={styles.emptyIconContainer}>
                <Ionicons name="people-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>
                Follow traders to see their posts here!
              </Text>
            </GlassSurface>
          </View>
        ) : feedTab === 'following' ? (
          <View style={styles.feedContent}>
            {followingPosts.map((post, index) => (
              <View key={post.id}>
                {index > 0 && <View style={styles.feedSeparator} />}
                <FeedCard
                  post={post}
                  onUpdate={loadFollowingPosts}
                  onPress={() => onNavigateToPost?.(post)}
                  onStockPress={(symbol) => onNavigateToStock?.(symbol)}
                  onViewUser={onViewUser}
                />
              </View>
            ))}
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <GlassSurface style={styles.emptyCard} borderRadius={BorderRadius.xxxl} variant="elevated" glow="mixed">
              <View style={styles.emptyIconContainer}>
                <Ionicons name="sparkles" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyText}>Your feed is empty</Text>
              <Text style={styles.emptySubtext}>
                Start sharing your trading insights and connect with the community!
              </Text>
              {onCompose && (
                <TouchableOpacity onPress={onCompose} activeOpacity={0.8}>
                  <GlassSurface
                    style={styles.emptyCTA}
                    borderRadius={BorderRadius.full}
                    glow="purple"
                    tintColor={Glass.primaryTint}
                  >
                    <View style={styles.emptyCTAInner}>
                      <Ionicons name="add-circle" size={20} color={Colors.white} />
                      <Text style={styles.emptyCTAText}>Create Your First Post</Text>
                    </View>
                  </GlassSurface>
                </TouchableOpacity>
              )}
            </GlassSurface>
          </View>
        ) : (
          <View style={styles.feedContent}>
            {posts.map((post, index) => (
              <View key={post.id}>
                {index > 0 && <View style={styles.feedSeparator} />}
                <FeedCard 
                  post={post} 
                  onUpdate={fetchData}
                  onPress={() => onNavigateToPost?.(post)}
                  onStockPress={(symbol) => onNavigateToStock?.(symbol)}
                  onViewUser={onViewUser}
                />
              </View>
            ))}
            {loadingMore && (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            )}
          </View>
        )}
      </ScrollView>
      
      {/* Floating Compose Button */}
      {onCompose && (
        <TouchableOpacity onPress={onCompose} activeOpacity={0.85} style={styles.composeFABWrap}>
          <View style={styles.composeFAB}>
            <Ionicons name="add" size={30} color={Colors.white} />
          </View>
        </TouchableOpacity>
      )}
      
      {/* Refer Modal */}
      <ReferModal
        visible={referModalVisible}
        onClose={() => setReferModalVisible(false)}
      />
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeSection: {
    flex: 1,
    paddingRight: Spacing.sm,
    justifyContent: 'center',
    minWidth: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  iconButton: {
    padding: Spacing.xs,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeMulti: {
    width: undefined,
    minWidth: 18,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 4,
    top: 0,
    right: 0,
  },
  bellBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: Typography.fontWeight.bold,
    lineHeight: 12,
  },
  referButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: Glass.postBorder,
  },
  referButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
    minWidth: 0,
  },
  userName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.extrabold,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.medium,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  statCardSuccess: {
    borderColor: Colors.success + '60',
    backgroundColor: Colors.success + '12',
  },
  statCardError: {
    borderColor: Colors.error + '60',
    backgroundColor: Colors.error + '12',
  },
  statLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.extrabold,
    letterSpacing: -0.5,
    marginTop: Spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyCard: {
    padding: Spacing.xxl,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Glass.primaryTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.borderBright,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  composeFABWrap: {
    position: 'absolute',
    bottom: 24,
    right: Spacing.lg,
    ...Shadows.primary,
  },
  composeFAB: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#A78BFA',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 10,
  },
  trendingSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  indexesCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  trendingTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  trendingScroll: {
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  trendingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.postBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minWidth: 112,
    minHeight: 92,
    justifyContent: 'center',
  },
  trendingSymbol: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    lineHeight: 22,
    marginBottom: 2,
  },
  trendingName: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.normal,
    lineHeight: 14,
    marginBottom: Spacing.xs,
  },
  trendingPrice: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    lineHeight: 18,
    marginBottom: 2,
  },
  trendingChange: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    lineHeight: 14,
  },
  skeletonCard: {
    opacity: 0.6,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Glass.border,
  },
  feedContent: {
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  feedSeparator: {
    height: Spacing.sm,
  },
  loadMoreContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyCTA: {
    marginTop: Spacing.lg,
  },
  emptyCTAInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  emptyCTAText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  feedTabRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  feedTabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  feedTabBtnActive: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderColor: Colors.primary,
  },
  feedTabText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textSecondary,
  },
  feedTabTextActive: {
    color: Colors.primary,
  },
});


