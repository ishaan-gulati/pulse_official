import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  userService,
  UserProfile,
  TradingHistory,
  PortfolioPosition,
  computeWinRateFromTradingHistory,
} from '../services/userService';
import { referralService } from '../services/referralService';
import { Colors, Spacing, BorderRadius, Typography, Shadows, Glass } from '../constants/theme';
import { formatCurrency, formatPercentage, formatNumber } from '../utils/formatters';
import LevelProgressCard from '../components/LevelProgressCard';
import { AchievementCard } from '../components/AchievementBadge';
import UserBadges from '../components/UserBadges';
import UserAvatar from '../components/UserAvatar';
import SocialTab from '../components/SocialTab';
import {
  gamificationService,
  XP_HELP_ALERT_TITLE,
  getXPHelpMessage,
} from '../services/gamificationService';

export type ProfileSubTab = 'profile' | 'stats' | 'social';

type ProfileScreenProps = {
  onAppRefresh?: () => Promise<void>;
  onOpenSettings?: () => void;
  onViewUser?: (uid: string) => void;
  pendingFriendRequests?: number;
  activeTab: ProfileSubTab;
  onTabChange: (tab: ProfileSubTab) => void;
  socialGroupId?: string | null;
  onSocialGroupChange?: (groupId: string | null) => void;
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onAppRefresh,
  onOpenSettings,
  onViewUser,
  pendingFriendRequests = 0,
  activeTab,
  onTabChange,
  socialGroupId = null,
  onSocialGroupChange,
}) => {
  const { user } = useAuth();
  const isMountedRef = useRef(true);
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tradingHistory, setTradingHistory] = useState<TradingHistory[]>([]);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [referralEarningsTotal, setReferralEarningsTotal] = useState<number>(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fetchProfileData = async () => {
    if (!user?.uid) return;
    const uid = user.uid;

    try {
      setLoading(true);

      // Keep reconcile off the critical path: it runs transactions + extra reads and was dominating load time.
      const [referralStats, profile, history, portfolio] = await Promise.all([
        referralService.getReferralStats(uid, { skipReconcile: true }),
        userService.getUserProfile(uid),
        userService.getUserTradingHistory(uid, 100),
        userService.getUserPortfolio(uid, false),
      ]);

      if (!isMountedRef.current) return;
      setReferralEarningsTotal(referralStats?.totalEarned ?? 0);
      setUserProfile(profile);
      setTradingHistory(history);
      setPositions(portfolio);

      const sellTrades = history.filter((t) => t.action === 'sell');
      const totalRealizedTrades = sellTrades.length;
      const winRate = computeWinRateFromTradingHistory(history) ?? 0;

      const allAchievements = gamificationService.getAchievements();
      const unlockedIds = profile?.achievements || [];
      setAchievements(
        allAchievements.map(a => ({
          ...a,
          unlocked: unlockedIds.includes(a.id),
        }))
      );

      setLoading(false);
      setRefreshing(false);

      void (async () => {
        try {
          await referralService.reconcileReferralBonusCash(uid);
          if (!isMountedRef.current) return;
          const [afterReconcileProfile, afterStats] = await Promise.all([
            userService.getUserProfile(uid),
            referralService.getReferralStats(uid, { skipReconcile: true }),
          ]);
          if (!isMountedRef.current) return;
          if (afterReconcileProfile) setUserProfile(afterReconcileProfile);
          setReferralEarningsTotal(afterStats?.totalEarned ?? 0);

          await gamificationService.checkAchievements(uid, {
            winRate,
            totalRealizedTrades,
          });
          const updatedProfile = await userService.getUserProfile(uid);
          if (!isMountedRef.current) return;
          if (updatedProfile) setUserProfile(updatedProfile);
          const ids =
            updatedProfile?.achievements ||
            afterReconcileProfile?.achievements ||
            profile?.achievements ||
            [];
          setAchievements(
            gamificationService.getAchievements().map(a => ({
              ...a,
              unlocked: ids.includes(a.id),
            }))
          );
        } catch (e) {
          console.error('Referral reconcile / achievement sync after profile load:', e);
        }
      })();
    } catch (error) {
      console.error('Error fetching profile data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    fetchProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch when account changes, not when auth object identity changes
  }, [user?.uid]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await onAppRefresh?.();
    fetchProfileData();
  };

  const handleChangePhoto = async () => {
    if (!user?.uid || uploadingPhoto) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setUploadingPhoto(true);
    try {
      const url = await userService.uploadProfilePhoto(user.uid, result.assets[0].uri);
      setUserProfile((prev) => (prev ? { ...prev, photoURL: url } : prev));
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update profile picture. Try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user?.uid || uploadingPhoto) return;
    setUploadingPhoto(true);
    try {
      await userService.updateUserProfile(user.uid, { photoURL: '' });
      setUserProfile((prev) => (prev ? { ...prev, photoURL: undefined } : prev));
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not remove profile picture.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const showPhotoOptions = () => {
    if (uploadingPhoto) return;
    const hasPhoto = Boolean(userProfile?.photoURL && userProfile.photoURL.trim() !== '');
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Change Photo', onPress: () => void handleChangePhoto() },
    ];
    if (hasPhoto) {
      options.push({
        text: 'Remove Photo',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Remove Photo',
            'Your profile picture will be removed and your initial will show instead.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => void handleRemovePhoto() },
            ]
          );
        },
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile Photo', undefined, options);
  };

  // Calculate XP breakdown
  const xpBreakdown = useMemo(() => {
    if (!userProfile) return null;
    const xp = userProfile.xp || 0;
    const level = userProfile.level || 1;
    const progress = gamificationService.getXPProgress(xp, level);
    const levelTitle = gamificationService.getLevelTitle(level);

    // Estimate XP sources
    const tradeXP = (userProfile.totalTrades || 0) * 10;
    const winXP = (userProfile.totalWins || 0) * 25;
    const achievementXP = achievements
      .filter(a => a.unlocked)
      .reduce((sum, a) => sum + a.xpReward, 0);
    const streakXP = Math.min((userProfile.dailyStreak || 0) * 5, 50); // Max 50 per day

    return {
      total: xp,
      level,
      levelTitle,
      progress,
      tradeXP,
      winXP,
      achievementXP,
      streakXP,
    };
  }, [userProfile, achievements]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!userProfile) return null;

    const totalTrades = userProfile.totalTrades || 0;
    const totalWins = userProfile.totalWins || 0;
    const winRate = computeWinRateFromTradingHistory(tradingHistory) ?? 0;

    return {
      totalTrades,
      totalWins,
      winRate,
      streak: userProfile.dailyStreak || 0,
      portfolioValue: userProfile.totalPortfolioValue || 0,
      totalReturn: userProfile.totalReturn || 0,
      positions: positions.length,
    };
  }, [userProfile, tradingHistory, positions]);

  const topPositions = useMemo(
    () => [...positions].sort((a, b) => b.totalValue - a.totalValue),
    [positions]
  );

  /** Profile card only: all-time return from portfolio activity, not referral bonuses (UI only). */
  const allTimeReturnExReferral = useMemo(() => {
    const tr = userProfile?.totalReturn ?? 0;
    return tr - referralEarningsTotal;
  }, [userProfile?.totalReturn, referralEarningsTotal]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Unable to load profile</Text>
      </View>
    );
  }

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={Colors.primary}
      colors={[Colors.primary]}
    />
  );

  return (
    <View style={styles.container}>
      {/* Top bar: settings only */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }} />
        {onOpenSettings && (
          <TouchableOpacity
            onPress={onOpenSettings}
            style={styles.settingsButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="settings-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => onTabChange('profile')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
          onPress={() => onTabChange('stats')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>Stats</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'social' && styles.tabActive]}
          onPress={() => onTabChange('social')}
          activeOpacity={0.7}
        >
          <View style={styles.tabLabelRow}>
            <Text style={[styles.tabText, activeTab === 'social' && styles.tabTextActive]}>Social</Text>
            {pendingFriendRequests > 0 && (
              <View style={[styles.tabBadge, pendingFriendRequests > 1 && styles.tabBadgeMulti]}>
                {pendingFriendRequests > 1 ? (
                  <Text style={styles.tabBadgeText}>
                    {pendingFriendRequests > 9 ? '9+' : pendingFriendRequests}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {activeTab === 'profile' ? (
        <ScrollView
          ref={scrollRef}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabContent}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarRow}>
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={showPhotoOptions}
              activeOpacity={0.8}
              disabled={uploadingPhoto}
            >
              <UserAvatar
                photoURL={userProfile.photoURL}
                displayName={userProfile.displayName}
                username={userProfile.username}
                size={72}
              />
              <View style={styles.avatarEditBadge}>
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons name="camera" size={14} color={Colors.white} />
                )}
              </View>
            </TouchableOpacity>
            <View style={styles.nameBlock}>
              <Text style={styles.displayName} numberOfLines={1}>{userProfile.displayName || userProfile.username}</Text>
              <Text style={styles.username}>@{userProfile.username}</Text>
              {userProfile.tags && userProfile.tags.length > 0 && (
                <View style={styles.badgesWrap}>
                  <UserBadges tags={userProfile.tags} size="small" maxBadges={3} />
                </View>
              )}
            </View>
          </View>

          {userProfile.bio && userProfile.bio.trim() !== '' && (
            <View style={styles.bioSection}>
              <Text style={styles.bioText} numberOfLines={3}>{userProfile.bio}</Text>
            </View>
          )}

          <LevelProgressCard
            xp={userProfile.xp || 0}
            level={userProfile.level || 1}
            streak={userProfile.dailyStreak || 0}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <View style={styles.portfolioCard}>
              <View style={styles.portfolioRow}>
                <Text style={styles.portfolioLabel}>Total value</Text>
                <Text style={styles.portfolioValue}>{formatCurrency(userProfile.totalPortfolioValue || 0)}</Text>
              </View>
              <View style={styles.portfolioRow}>
                <Text style={styles.portfolioLabel}>All-time return</Text>
                <Text style={[styles.portfolioReturn, { color: allTimeReturnExReferral >= 0 ? Colors.success : Colors.error }]}>
                  {allTimeReturnExReferral >= 0 ? '+' : ''}{formatCurrency(allTimeReturnExReferral)}
                </Text>
              </View>
              {referralEarningsTotal > 0 && (
                <View style={styles.portfolioRow}>
                  <Text style={styles.portfolioLabel}>Referral rewards (in total)</Text>
                  <Text style={styles.portfolioReferral}>{formatCurrency(referralEarningsTotal)}</Text>
                </View>
              )}
            </View>
          </View>

          {topPositions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top holdings</Text>
              <View style={styles.holdingsList}>
                {topPositions.map((pos) => (
                  <View key={pos.symbol} style={styles.holdingRow}>
                    <Text style={styles.holdingSymbol}>{pos.symbol}</Text>
                    <Text style={styles.holdingShares}>{pos.shares} shares</Text>
                    <Text style={styles.holdingValue}>{formatCurrency(pos.totalValue)}</Text>
                    <Text style={[styles.holdingReturn, { color: pos.totalReturn >= 0 ? Colors.success : Colors.error }]}>
                      {pos.totalReturn >= 0 ? '+' : ''}{formatCurrency(pos.totalReturn)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      ) : activeTab === 'stats' ? (
        <ScrollView
          ref={scrollRef}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabContent}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          {stats && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trading</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Ionicons name="stats-chart" size={22} color={Colors.primary} />
                  <Text style={styles.statValue}>{formatNumber(stats.totalTrades)}</Text>
                  <Text style={styles.statLabel}>Trades</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="trophy" size={22} color={Colors.success} />
                  <Text style={styles.statValue}>{formatNumber(stats.totalWins)}</Text>
                  <Text style={styles.statLabel}>Wins</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="trending-up" size={22} color={Colors.warning} />
                  <Text style={styles.statValue}>{stats.winRate.toFixed(1)}%</Text>
                  <Text style={styles.statLabel}>Win rate</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="flame" size={22} color={Colors.error} />
                  <Text style={styles.statValue}>{stats.streak}</Text>
                  <Text style={styles.statLabel}>Streak</Text>
                </View>
              </View>
            </View>
          )}

          {xpBreakdown && (
            <View style={styles.section}>
              <View style={styles.sectionTitleWithInfo}>
                <Text style={[styles.sectionTitle, styles.sectionTitleNoMargin]}>XP</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert(XP_HELP_ALERT_TITLE, getXPHelpMessage())}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="How XP works"
                  accessibilityRole="button"
                >
                  <Ionicons name="information-circle-outline" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <View style={styles.xpBreakdownCard}>
                <View style={styles.xpBreakdownRow}>
                  <View style={styles.xpBreakdownItem}>
                    <Text style={styles.xpBreakdownLabel}>Trades</Text>
                    <Text style={styles.xpBreakdownValue}>+{xpBreakdown.tradeXP}</Text>
                  </View>
                  <View style={styles.xpBreakdownItem}>
                    <Text style={styles.xpBreakdownLabel}>Wins</Text>
                    <Text style={styles.xpBreakdownValue}>+{xpBreakdown.winXP}</Text>
                  </View>
                  <View style={styles.xpBreakdownItem}>
                    <Text style={styles.xpBreakdownLabel}>Achieve</Text>
                    <Text style={styles.xpBreakdownValue}>+{xpBreakdown.achievementXP}</Text>
                  </View>
                  <View style={styles.xpBreakdownItem}>
                    <Text style={styles.xpBreakdownLabel}>Streak</Text>
                    <Text style={styles.xpBreakdownValue}>+{xpBreakdown.streakXP}</Text>
                  </View>
                </View>
                <View style={styles.xpTotalRow}>
                  <Text style={styles.xpTotalLabel}>Total XP</Text>
                  <Text style={styles.xpTotalValue}>{xpBreakdown.total.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <Text style={styles.sectionSubtitle}>
              {achievements.filter(a => a.unlocked).length}/{achievements.length}
            </Text>
            {achievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                unlocked={achievement.unlocked}
              />
            ))}
          </View>
        </ScrollView>
      ) : activeTab === 'social' && user ? (
        <SocialTab
          uid={user.uid}
          onViewUser={onViewUser}
          activeGroupId={socialGroupId}
          onActiveGroupChange={onSocialGroupChange}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textTertiary,
    fontWeight: Typography.fontWeight.semibold,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  tabBadgeMulti: {
    width: undefined,
    minWidth: 16,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: Typography.fontWeight.bold,
    lineHeight: 12,
  },
  tabScroll: {
    flex: 1,
  },
  tabContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  topBarTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  settingsButton: {
    padding: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarWrap: {
    marginRight: Spacing.md,
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameBlock: {
    flex: 1,
  },
  displayName: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  username: {
    fontSize: Typography.fontSize.md,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
  },
  badgesWrap: {
    marginTop: Spacing.xs,
  },
  bioSection: {
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bioText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  portfolioCard: {
    backgroundColor: Glass.fillSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.postBorder,
    ...Shadows.small,
  },
  portfolioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  portfolioLabel: {
    fontSize: Typography.fontSize.md,
    color: Colors.textTertiary,
  },
  portfolioValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  portfolioReturn: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  portfolioReferral: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  holdingsList: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  holdingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  holdingSymbol: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  holdingShares: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginRight: Spacing.md,
  },
  holdingValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  holdingReturn: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  section: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  sectionTitleWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionTitleNoMargin: {
    marginBottom: 0,
  },
  sectionSubtitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
  xpBreakdownCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.small,
  },
  xpBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.md,
  },
  xpBreakdownItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  xpBreakdownLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
  xpBreakdownValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  xpTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  xpTotalLabel: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  xpTotalValue: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
});

export default ProfileScreen;
