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
import { followService } from '../services/followService';
import { Colors, Spacing, BorderRadius, Typography, Glass } from '../constants/theme';
import FollowListModal from './FollowListModal';
import UserSearchSection from './UserSearchSection';
import FriendsSection from './FriendsSection';
import GroupsSection from './GroupsSection';
import GroupDetailScreen from '../screens/GroupDetailScreen';

type SocialTabProps = {
  uid: string;
  onViewUser?: (uid: string) => void;
  activeGroupId?: string | null;
  onActiveGroupChange?: (groupId: string | null) => void;
};

/** Consistent collapsible section card wrapper */
const SectionCard: React.FC<{
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <View style={cardStyles.card}>
    <View style={cardStyles.header}>
      <View style={cardStyles.iconWrap}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
      </View>
      <Text style={cardStyles.title}>{title}</Text>
    </View>
    <View style={cardStyles.body}>{children}</View>
  </View>
);

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(139,92,246,0.05)',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(109,40,217,0.1)',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Glass.primaryTint,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  body: {
    padding: Spacing.md,
    minWidth: 0,
  },
});

const SocialTab: React.FC<SocialTabProps> = ({
  uid,
  onViewUser,
  activeGroupId: controlledGroupId,
  onActiveGroupChange,
}) => {
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [countsLoading, setCountsLoading] = useState(true);
  const [followListMode, setFollowListMode] = useState<'followers' | 'following' | null>(null);
  const [internalGroupId, setInternalGroupId] = useState<string | null>(null);

  const activeGroupId = controlledGroupId !== undefined ? controlledGroupId : internalGroupId;
  const setActiveGroupId = (groupId: string | null) => {
    if (onActiveGroupChange) {
      onActiveGroupChange(groupId);
    } else {
      setInternalGroupId(groupId);
    }
  };

  const loadCounts = useCallback(async () => {
    setCountsLoading(true);
    try {
      const [fc, fwc] = await Promise.all([
        followService.getFollowerCount(uid),
        followService.getFollowingCount(uid),
      ]);
      setFollowerCount(fc);
      setFollowingCount(fwc);
    } finally {
      setCountsLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  if (activeGroupId) {
    return (
      <GroupDetailScreen
        groupId={activeGroupId}
        onBack={() => setActiveGroupId(null)}
        onViewUser={onViewUser}
      />
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Followers / Following stat bar */}
      <View style={styles.statsBar}>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => setFollowListMode('followers')}
          activeOpacity={0.75}
        >
          {countsLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.statValue}>{followerCount}</Text>
          )}
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>

        <View style={styles.statDivider} />

        <TouchableOpacity
          style={styles.statItem}
          onPress={() => setFollowListMode('following')}
          activeOpacity={0.75}
        >
          {countsLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.statValue}>{followingCount}</Text>
          )}
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
      </View>

      {/* Find People */}
      <SectionCard icon="search-outline" title="Find People">
        <UserSearchSection onViewUser={onViewUser} />
      </SectionCard>

      {/* Friends */}
      <SectionCard icon="people-outline" title="Friends">
        <FriendsSection onViewUser={onViewUser} />
      </SectionCard>

      {/* Groups */}
      <SectionCard icon="chatbubbles-outline" title="Groups">
        <GroupsSection onViewGroup={(id) => setActiveGroupId(id)} />
      </SectionCard>

      {/* Follow list modals */}
      {followListMode && (
        <FollowListModal
          visible={!!followListMode}
          uid={uid}
          mode={followListMode}
          onClose={() => { setFollowListMode(null); loadCounts(); }}
          onViewUser={onViewUser}
        />
      )}
    </ScrollView>
  );
};

export default SocialTab;

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  statsBar: {
    flexDirection: 'row',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(139,92,246,0.07)',
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: Glass.postBorder,
    marginVertical: Spacing.md,
  },
  statValue: {
    fontSize: 26,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
});
