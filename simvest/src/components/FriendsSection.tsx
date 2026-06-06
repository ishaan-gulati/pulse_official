import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { friendService } from '../services/friendService';
import { userService, UserProfile } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography, Glass, Shadows } from '../constants/theme';
import UserAvatar from './UserAvatar';
import type { FriendRequest } from '../types';

type FriendsSectionProps = {
  onViewUser?: (uid: string) => void;
};

type RequestWithSender = FriendRequest & {
  sender?: UserProfile | null;
};

type PersonListRowProps = {
  photoURL?: string;
  displayName: string;
  username?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
};

const PersonListRow: React.FC<PersonListRowProps> = ({
  photoURL,
  displayName,
  username,
  onPress,
  trailing,
}) => (
  <TouchableOpacity
    style={styles.listRow}
    onPress={onPress}
    activeOpacity={0.75}
    disabled={!onPress}
  >
    <UserAvatar
      photoURL={photoURL}
      displayName={displayName}
      username={username}
      size={44}
    />
    <View style={styles.nameBlock}>
      <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
      {username ? (
        <Text style={styles.username} numberOfLines={1}>@{username}</Text>
      ) : null}
    </View>
    {trailing ?? (
      onPress ? <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} /> : null
    )}
  </TouchableOpacity>
);

const FriendsSection: React.FC<FriendsSectionProps> = ({ onViewUser }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<(UserProfile & { uid: string })[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestWithSender[]>([]);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const [friendUids, requests] = await Promise.all([
        friendService.getFriends(user.uid),
        friendService.getPendingRequests(user.uid),
      ]);
      const profs = await Promise.all(friendUids.map((u) => userService.getUserProfile(u)));
      const valid = profs
        .map((p, i) => (p ? { ...p, uid: friendUids[i] } : null))
        .filter(Boolean) as (UserProfile & { uid: string })[];
      setFriends(valid);

      const withSenders = await Promise.all(
        requests.map(async (req) => {
          const sender = await userService.getUserProfile(req.fromUid);
          return { ...req, sender };
        })
      );
      setPendingRequests(withSenders);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (requestId: string) => {
    if (!user?.uid) return;
    await friendService.acceptRequest(requestId, user.uid);
    load();
  };

  const handleDecline = async (requestId: string) => {
    await friendService.declineRequest(requestId);
    setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View>
      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Friend Requests</Text>
          <View style={styles.list}>
            {pendingRequests.map((req) => {
              const displayName = req.sender?.displayName || req.fromDisplayName || 'Unknown';
              const username = req.sender?.username || req.fromUsername;

              return (
                <PersonListRow
                  key={req.id}
                  photoURL={req.sender?.photoURL}
                  displayName={displayName}
                  username={username}
                  onPress={() => onViewUser?.(req.fromUid)}
                  trailing={
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAccept(req.id)}
                      >
                        <Ionicons name="checkmark" size={16} color={Colors.success} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={() => handleDecline(req.id)}
                      >
                        <Ionicons name="close" size={16} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  }
                />
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Friends ({friends.length})</Text>
        {friends.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={28} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No friends yet — send a request from someone's profile!</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {friends.map((f) => (
              <PersonListRow
                key={f.uid}
                photoURL={f.photoURL}
                displayName={f.displayName || f.username}
                username={f.username}
                onPress={() => onViewUser?.(f.uid)}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

export default FriendsSection;

const styles = StyleSheet.create({
  center: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  list: {
    gap: Spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.postBorder,
    backgroundColor: Glass.fillSubtle,
    ...Shadows.small,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  username: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    lineHeight: 18,
    marginTop: 1,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(139,92,246,0.05)',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
});
