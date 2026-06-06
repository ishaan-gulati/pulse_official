import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userService, UserProfile, PortfolioPosition } from '../services/userService';
import { Colors, Spacing, BorderRadius, Typography, Shadows, Glass } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';
import LevelProgressCard from '../components/LevelProgressCard';
import UserBadges from '../components/UserBadges';
import UserAvatar from '../components/UserAvatar';
import { useAuth } from '../contexts/AuthContext';
import { followService } from '../services/followService';
import { friendService } from '../services/friendService';
import type { FriendStatus } from '../types';

type UserProfileScreenProps = {
  userId: string;
  onBack: () => void;
};

const UserProfileScreen: React.FC<UserProfileScreenProps> = ({ userId, onBack }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  /** When set, portfolio header matches live holdings (cash + quotes); else fall back to stored profile fields. */
  const [viewerTotals, setViewerTotals] = useState<{ value: number; allTimeReturn: number } | null>(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followsYou, setFollowsYou] = useState(false);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [socialLoading, setSocialLoading] = useState(false);

  const loadSocialStatus = useCallback(async () => {
    if (!user?.uid || user.uid === userId) return;
    const [following, followsMe, friendStat] = await Promise.all([
      followService.isFollowing(user.uid, userId),
      followService.isFollowedBy(user.uid, userId),
      friendService.getFriendStatus(user.uid, userId),
    ]);
    setIsFollowing(following);
    setFollowsYou(followsMe);
    setFriendStatus(friendStat);
  }, [user?.uid, userId]);

  useEffect(() => {
    loadSocialStatus();
  }, [loadSocialStatus]);

  const handleFollow = async () => {
    if (!user?.uid) return;
    setSocialLoading(true);
    try {
      if (isFollowing) {
        await followService.unfollow(user.uid, userId);
        setIsFollowing(false);
      } else {
        await followService.follow(user.uid, userId);
        setIsFollowing(true);
      }
    } finally {
      setSocialLoading(false);
    }
  };

  const handleFriend = async () => {
    if (!user?.uid) return;
    setSocialLoading(true);
    try {
      if (friendStatus === 'none') {
        const myProfile = await userService.getUserProfile(user.uid);
        await friendService.sendRequest(
          user.uid,
          userId,
          myProfile?.displayName,
          myProfile?.username,
          myProfile?.photoURL
        );
        setFriendStatus('pending_sent');
      } else if (friendStatus === 'pending_received') {
        // Accept request
        const pending = await friendService.getPendingRequests(user.uid);
        const req = pending.find((r) => r.fromUid === userId);
        if (req) {
          await friendService.acceptRequest(req.id, user.uid);
          setFriendStatus('friends');
        }
      } else if (friendStatus === 'friends') {
        await friendService.removeFriend(user.uid, userId);
        setFriendStatus('none');
      }
    } finally {
      setSocialLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setProfile(null);
    setPositions([]);
    setViewerTotals(null);
    (async () => {
      try {
        const p = await userService.getUserProfile(userId);
        if (cancelled) return;
        setProfile(p || null);
        if (!p) return;

        // Only the *viewed* user's Firestore flag matters (e.g. Nikki's doc when viewing Nikki).
        // Your Settings toggle only updates your uid - you cannot change what others hide.
        const isOwnProfile = user?.uid === userId;
        const ownerShowsHoldingsToOthers = p.showPortfolioToOthers !== false;
        const canSeeHoldings = isOwnProfile || ownerShowsHoldingsToOthers;

        if (canSeeHoldings) {
          const viewer = await userService.getUserPortfolioForViewer(userId).catch(() => null);
          if (cancelled) return;
          if (viewer) {
            setPositions(viewer.positions);
            setViewerTotals({ value: viewer.displayTotalValue, allTimeReturn: viewer.displayTotalReturn });
          } else {
            setPositions([]);
            setViewerTotals(null);
          }
        } else {
          setPositions([]);
          setViewerTotals({
            value: p.totalPortfolioValue ?? 0,
            allTimeReturn: p.totalReturn ?? 0,
          });
        }
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, user?.uid]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.errorText}>Could not load profile</Text>
      </View>
    );
  }

  const isOwnProfile = user?.uid === userId;
  const ownerShowsHoldingsToOthers = profile.showPortfolioToOthers !== false;
  const canSeeHoldings = isOwnProfile || ownerShowsHoldingsToOthers;

  const topPositions = [...positions].sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);
  const portfolioValueDisplay = viewerTotals?.value ?? profile.totalPortfolioValue ?? 0;
  const portfolioReturnDisplay = viewerTotals?.allTimeReturn ?? profile.totalReturn ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarRow}>
          <UserAvatar
            photoURL={profile.photoURL}
            displayName={profile.displayName}
            username={profile.username}
            size={72}
            style={styles.avatarSpacing}
          />
          <View style={styles.nameBlock}>
            <Text style={styles.displayName} numberOfLines={1}>{profile.displayName || profile.username}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.tags && profile.tags.length > 0 && (
              <View style={styles.badgesWrap}>
                <UserBadges tags={profile.tags} size="small" maxBadges={3} />
              </View>
            )}
          </View>
        </View>

        {profile.bio && profile.bio.trim() !== '' && (
          <View style={styles.bioSection}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {!isOwnProfile && (
          <View style={styles.socialButtons}>
            <TouchableOpacity
              style={[styles.socialBtn, isFollowing && styles.socialBtnActive]}
              onPress={handleFollow}
              disabled={socialLoading}
            >
              <Ionicons
                name={isFollowing ? 'checkmark' : 'person-add-outline'}
                size={15}
                color={isFollowing ? Colors.primary : Colors.textPrimary}
              />
              <Text style={[styles.socialBtnText, isFollowing && styles.socialBtnTextActive]}>
                {followService.getFollowButtonLabel(isFollowing, followsYou)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialBtn, friendStatus === 'friends' && styles.socialBtnActive]}
              onPress={handleFriend}
              disabled={socialLoading || friendStatus === 'pending_sent'}
            >
              <Ionicons
                name={
                  friendStatus === 'friends'
                    ? 'people'
                    : friendStatus === 'pending_sent'
                    ? 'time-outline'
                    : friendStatus === 'pending_received'
                    ? 'checkmark-circle-outline'
                    : 'person-add-outline'
                }
                size={15}
                color={
                  friendStatus === 'friends'
                    ? Colors.primary
                    : friendStatus === 'pending_sent'
                    ? Colors.textSecondary
                    : Colors.textPrimary
                }
              />
              <Text
                style={[
                  styles.socialBtnText,
                  friendStatus === 'friends' && styles.socialBtnTextActive,
                  friendStatus === 'pending_sent' && styles.socialBtnTextMuted,
                ]}
              >
                {friendStatus === 'friends'
                  ? 'Friends'
                  : friendStatus === 'pending_sent'
                  ? 'Request Sent'
                  : friendStatus === 'pending_received'
                  ? 'Accept Request'
                  : 'Add Friend'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <LevelProgressCard
          xp={profile.xp || 0}
          level={profile.level || 1}
          streak={profile.dailyStreak || 0}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio</Text>
          <View style={styles.portfolioCard}>
            <View style={styles.portfolioRow}>
              <Text style={styles.portfolioLabel}>Total value</Text>
              <Text style={styles.portfolioValue}>{formatCurrency(portfolioValueDisplay)}</Text>
            </View>
            <View style={styles.portfolioRow}>
              <Text style={styles.portfolioLabel}>All-time return</Text>
              <Text style={[styles.portfolioReturn, { color: portfolioReturnDisplay >= 0 ? Colors.success : Colors.error }]}>
                {portfolioReturnDisplay >= 0 ? '+' : ''}{formatCurrency(portfolioReturnDisplay)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top holdings</Text>
          {!canSeeHoldings ? (
            <View style={styles.holdingsEmpty}>
              <Text style={styles.holdingsPrivateText}>
                This user has chosen to hide their holdings. Their total portfolio value is still shown above.
              </Text>
            </View>
          ) : topPositions.length > 0 ? (
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
          ) : (
            <View style={styles.holdingsEmpty}>
              <Text style={styles.holdingsEmptyText}>
                No open stock positions - portfolio may be all cash.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  headerRight: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarSpacing: {
    marginRight: Spacing.md,
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
    marginBottom: Spacing.lg,
    padding: Spacing.md,
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
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
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
    padding: Spacing.md,
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
  holdingsEmpty: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  holdingsEmptyText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  holdingsPrivateText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  socialBtnActive: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: Colors.primary,
  },
  socialBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  socialBtnTextActive: {
    color: Colors.primary,
  },
  socialBtnTextMuted: {
    color: Colors.textSecondary,
  },
  errorText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
});

export default UserProfileScreen;
