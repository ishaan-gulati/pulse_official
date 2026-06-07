import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { userService, LeaderboardEntry, LEADERBOARD_LIMIT } from '../services/userService';
import { Colors, Spacing, Typography } from '../constants/theme';
import LeaderboardList from '../components/LeaderboardList';

// Mock entries for empty leaderboard (e.g. screenshots). No backend; UI only.
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { uid: 'mock-1', username: 'alex_trades', displayName: 'Alex Chen', totalPortfolioValue: 124750, totalReturn: 24750, rank: 1, lastUpdated: null, tags: [] },
  { uid: 'mock-2', username: 'sam_invests', displayName: 'Sam Rivera', totalPortfolioValue: 118200, totalReturn: 18200, rank: 2, lastUpdated: null, tags: [] },
  { uid: 'mock-3', username: 'jordan_finance', displayName: 'Jordan Kim', totalPortfolioValue: 109800, totalReturn: 9800, rank: 3, lastUpdated: null, tags: [] },
  { uid: 'mock-4', username: 'casey_stocks', displayName: 'Casey Moore', totalPortfolioValue: 105100, totalReturn: 5100, rank: 4, lastUpdated: null, tags: [] },
  { uid: 'mock-5', username: 'riley_market', displayName: 'Riley Jones', totalPortfolioValue: 102300, totalReturn: 2300, rank: 5, lastUpdated: null, tags: [] },
  { uid: 'mock-6', username: 'morgan_bull', displayName: 'Morgan Lee', totalPortfolioValue: 98750, totalReturn: -1250, rank: 6, lastUpdated: null, tags: [] },
];

type LeaderboardScreenProps = {
  onViewUser?: (uid: string) => void;
  listRef?: React.RefObject<import('react-native').FlatList<LeaderboardEntry> | null>;
  onAppRefresh?: () => Promise<void>;
};

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ onViewUser, listRef, onAppRefresh }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rankingsInfoVisible, setRankingsInfoVisible] = useState(false);

  const fetchLeaderboard = async () => {
    try {
      const data = await userService.getLeaderboard(LEADERBOARD_LIMIT);
      setEntries(data);
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await onAppRefresh?.();
      const data = await userService.getLeaderboard(LEADERBOARD_LIMIT);
      setEntries(data);
    } catch (err) {
      console.error('Leaderboard refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const displayList = entries.length > 0 ? entries : MOCK_LEADERBOARD;

  if (loading && entries.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingLabel}>Loading rankings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="trophy" size={32} color={Colors.trophy} />
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Leaderboard</Text>
          <TouchableOpacity
            onPress={() => setRankingsInfoVisible(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="How leaderboard values work"
          >
            <Ionicons name="information-circle-outline" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Top traders by portfolio value</Text>
        <Text style={styles.tapHint}>Tap to view profile</Text>
      </View>

      <Modal
        visible={rankingsInfoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRankingsInfoVisible(false)}
      >
        <TouchableOpacity
          style={styles.infoModalOverlay}
          activeOpacity={1}
          onPress={() => setRankingsInfoVisible(false)}
        >
          <View style={styles.infoPopup}>
            <View style={styles.infoPopupHeader}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
              <Text style={styles.infoPopupTitle}>Rankings</Text>
            </View>
            <Text style={styles.infoPopupBody}>
              Rankings use each player’s saved total (updates when they trade or refresh their portfolio in the app). A
              profile can show a different amount because it uses live market prices for that moment.
            </Text>
            <TouchableOpacity style={styles.infoPopupClose} onPress={() => setRankingsInfoVisible(false)}>
              <Text style={styles.infoPopupCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {displayList.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="podium-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No rankings yet</Text>
          <Text style={styles.emptySubtitle}>
            Trade to climb the leaderboard
          </Text>
        </View>
      ) : (
        <LeaderboardList
          listRef={listRef}
          entries={displayList}
          currentUserId={user?.uid}
          onViewUser={onViewUser}
          refreshing={refreshing}
          onRefresh={onRefresh}
          getIsDisabled={(item) => item.uid.startsWith('mock-')}
        />
      )}
    </View>
  );
};

export default LeaderboardScreen;

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
    gap: Spacing.md,
  },
  loadingLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.trophy + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.extrabold,
  },
  subtitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.xs,
  },
  tapHint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSize.xs,
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
