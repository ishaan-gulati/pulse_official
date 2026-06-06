import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LeaderboardEntry } from '../services/userService';
import { Colors, Spacing, BorderRadius, Typography, Shadows, Glass } from '../constants/theme';
import { formatCurrency, formatPercentage } from '../utils/formatters';

type LeaderboardListProps = {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  onViewUser?: (uid: string) => void;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  listRef?: React.RefObject<FlatList<LeaderboardEntry> | null>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  emptyTitle?: string;
  emptySubtitle?: string;
  getIsDisabled?: (item: LeaderboardEntry) => boolean;
};

const getReturnPercent = (item: LeaderboardEntry) => {
  const prev = item.totalPortfolioValue - item.totalReturn;
  if (prev <= 0) return 0;
  return (item.totalReturn / prev) * 100;
};

const renderRank = (rank: number) => {
  if (rank === 1) {
    return (
      <View style={[styles.medal, styles.medalGold]}>
        <Ionicons name="trophy" size={24} color="#FFD700" />
      </View>
    );
  }
  if (rank === 2) {
    return (
      <View style={[styles.medal, styles.medalSilver]}>
        <Ionicons name="medal" size={22} color="#C0C0C0" />
      </View>
    );
  }
  if (rank === 3) {
    return (
      <View style={[styles.medal, styles.medalBronze]}>
        <Ionicons name="medal" size={22} color="#CD7F32" />
      </View>
    );
  }
  return (
    <View style={styles.rankPill}>
      <Text style={styles.rankPillText}>{rank}</Text>
    </View>
  );
};

type LeaderboardRowProps = {
  item: LeaderboardEntry;
  rank: number;
  currentUserId?: string;
  onViewUser?: (uid: string) => void;
  disabled?: boolean;
};

export const LeaderboardRow: React.FC<LeaderboardRowProps> = ({
  item,
  rank,
  currentUserId,
  onViewUser,
  disabled,
}) => {
  const isCurrentUser = currentUserId === item.uid;
  const isTopThree = rank <= 3;
  const returnPct = getReturnPercent(item);

  return (
    <TouchableOpacity
      style={[
        styles.row,
        isTopThree && styles.rowTopThree,
        isCurrentUser && styles.rowYou,
      ]}
      onPress={() => onViewUser?.(item.uid)}
      activeOpacity={disabled ? 1 : 0.7}
      disabled={disabled || !onViewUser}
    >
      <View style={styles.rankCol}>{renderRank(rank)}</View>
      <View style={styles.avatarCol}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.displayName || item.username || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.infoCol}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.displayName || item.username}
          </Text>
          {isCurrentUser && (
            <View style={styles.youPill}>
              <Text style={styles.youPillText}>You</Text>
            </View>
          )}
        </View>
        <View style={styles.statsCol}>
          <Text style={styles.value}>{formatCurrency(item.totalPortfolioValue)}</Text>
          <Text
            style={[
              styles.returnText,
              { color: item.totalReturn >= 0 ? Colors.success : Colors.error },
            ]}
            numberOfLines={1}
          >
            {item.totalReturn >= 0 ? '+' : ''}{formatCurrency(item.totalReturn)}
            {' '}
            ({item.totalReturn >= 0 ? '+' : ''}{formatPercentage(returnPct, false)})
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const LeaderboardList: React.FC<LeaderboardListProps> = ({
  entries,
  currentUserId,
  onViewUser,
  loading = false,
  refreshing = false,
  onRefresh,
  listRef,
  contentContainerStyle,
  emptyTitle = 'No rankings yet',
  emptySubtitle = 'Trade to climb the leaderboard',
  getIsDisabled,
}) => {
  if (loading && entries.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingLabel}>Loading rankings...</Text>
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="podium-outline" size={64} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={entries}
      keyExtractor={(item) => item.uid}
      renderItem={({ item, index }) => {
        const disabled = getIsDisabled?.(item) ?? false;
        return (
          <LeaderboardRow
            item={item}
            rank={index + 1}
            currentUserId={currentUserId}
            onViewUser={onViewUser}
            disabled={disabled}
          />
        );
      }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        ) : undefined
      }
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      ListFooterComponent={<View style={styles.listFooter} />}
    />
  );
};

export default LeaderboardList;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  loadingLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  listFooter: {
    height: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Glass.fillSubtle,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.postBorder,
    ...Shadows.small,
  },
  rowTopThree: {
    borderColor: Glass.postBorderBright,
    ...Shadows.medium,
  },
  rowYou: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.primary + '0C',
  },
  rankCol: {
    marginRight: Spacing.sm,
  },
  medal: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalGold: {
    backgroundColor: '#FFD700' + '30',
  },
  medalSilver: {
    backgroundColor: '#C0C0C0' + '30',
  },
  medalBronze: {
    backgroundColor: '#CD7F32' + '30',
  },
  rankPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rankPillText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  avatarCol: {
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  infoCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
    gap: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  youPill: {
    backgroundColor: Colors.primary + '40',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  youPillText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  statsCol: {
    alignItems: 'flex-end',
  },
  value: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing.xs,
  },
  returnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
});
