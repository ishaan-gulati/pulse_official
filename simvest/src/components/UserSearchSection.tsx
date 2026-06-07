import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../config/firebase';
import {
  collection,
  query,
  orderBy,
  startAt,
  endAt,
  limit,
  getDocs,
} from 'firebase/firestore';
import { userService, UserProfile } from '../services/userService';
import { followService } from '../services/followService';
import { friendService } from '../services/friendService';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography, Glass } from '../constants/theme';
import UserAvatar from './UserAvatar';
import FlexTextInput from './FlexTextInput';
import type { FriendStatus } from '../types';

type UserSearchSectionProps = {
  onViewUser?: (uid: string) => void;
};

type SearchResult = UserProfile & {
  uid: string;
  _isFollowing?: boolean;
  _followsMe?: boolean;
  _friendStatus?: FriendStatus;
};

const UserSearchSection: React.FC<UserSearchSectionProps> = ({ onViewUser }) => {
  const { user } = useAuth();
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track per-row loading to avoid blocking the whole list
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const search = useCallback(async (text: string) => {
    const q = text.trim().toLowerCase();
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const cap = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

      const [byUsername, byDisplayName] = await Promise.all([
        getDocs(query(usersRef, orderBy('username'), startAt(q), endAt(q + '\uf8ff'), limit(10))),
        getDocs(query(usersRef, orderBy('displayName'), startAt(cap), endAt(cap + '\uf8ff'), limit(10))),
      ]);

      const seen = new Set<string>();
      const merged: SearchResult[] = [];
      for (const snap of [byUsername, byDisplayName]) {
        for (const d of snap.docs) {
          if (!seen.has(d.id) && d.id !== user?.uid) {
            seen.add(d.id);
            merged.push({ ...(d.data() as UserProfile), uid: d.id });
          }
        }
      }

      // Fetch social status for all results in parallel
      if (user?.uid && merged.length > 0) {
        const myFollowers = await followService.getFollowers(user.uid).catch(() => [] as string[]);
        const followersMeSet = new Set(myFollowers);
        const statuses = await Promise.all(
          merged.map(async (m) => {
            const [isFollowing, friendStatus] = await Promise.all([
              followService.isFollowing(user.uid, m.uid).catch(() => false),
              friendService.getFriendStatus(user.uid, m.uid).catch(() => 'none' as FriendStatus),
            ]);
            return { uid: m.uid, isFollowing, friendStatus, followsMe: followersMeSet.has(m.uid) };
          })
        );
        const statusMap = new Map(statuses.map((s) => [s.uid, s]));
        setResults(
          merged.slice(0, 12).map((m) => ({
            ...m,
            _isFollowing: statusMap.get(m.uid)?.isFollowing ?? false,
            _friendStatus: statusMap.get(m.uid)?.friendStatus ?? 'none',
            _followsMe: statusMap.get(m.uid)?.followsMe ?? false,
          }))
        );
      } else {
        setResults(merged.slice(0, 12));
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const handleChange = (text: string) => {
    setQueryText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 350);
  };

  const handleFollow = async (targetUid: string, currentlyFollowing: boolean) => {
    if (!user?.uid) return;
    setActionLoading((prev) => ({ ...prev, [`follow_${targetUid}`]: true }));
    try {
      if (currentlyFollowing) {
        await followService.unfollow(user.uid, targetUid);
      } else {
        await followService.follow(user.uid, targetUid);
      }
      setResults((prev) =>
        prev.map((r) => r.uid === targetUid ? { ...r, _isFollowing: !currentlyFollowing } : r)
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [`follow_${targetUid}`]: false }));
    }
  };

  const handleFriend = async (targetUid: string, currentStatus: FriendStatus) => {
    if (!user?.uid || currentStatus === 'pending_sent') return;
    setActionLoading((prev) => ({ ...prev, [`friend_${targetUid}`]: true }));
    try {
      if (currentStatus === 'none') {
        const myProfile = await userService.getUserProfile(user.uid);
        await friendService.sendRequest(
          user.uid,
          targetUid,
          myProfile?.displayName,
          myProfile?.username,
          myProfile?.photoURL
        );
        setResults((prev) =>
          prev.map((r) => r.uid === targetUid ? { ...r, _friendStatus: 'pending_sent' } : r)
        );
      } else if (currentStatus === 'pending_received') {
        const pending = await friendService.getPendingRequests(user.uid);
        const req = pending.find((r) => r.fromUid === targetUid);
        if (req) {
          await friendService.acceptRequest(req.id, user.uid);
          setResults((prev) =>
            prev.map((r) => r.uid === targetUid ? { ...r, _friendStatus: 'friends' } : r)
          );
        }
      } else if (currentStatus === 'friends') {
        await friendService.removeFriend(user.uid, targetUid);
        setResults((prev) =>
          prev.map((r) => r.uid === targetUid ? { ...r, _friendStatus: 'none' } : r)
        );
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [`friend_${targetUid}`]: false }));
    }
  };

  const friendLabel = (status: FriendStatus) => {
    switch (status) {
      case 'friends': return 'Friends';
      case 'pending_sent': return 'Sent';
      case 'pending_received': return 'Accept';
      default: return 'Add Friend';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={16} color={Colors.textTertiary} style={styles.searchIcon} />
        <FlexTextInput
          style={styles.input}
          placeholder="Search people…"
          placeholderTextColor={Colors.textTertiary}
          value={queryText}
          onChangeText={handleChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading ? (
          <View style={styles.trailingIcon}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : queryText.length > 0 ? (
          <TouchableOpacity
            style={styles.trailingIcon}
            onPress={() => { setQueryText(''); setResults([]); }}
          >
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {results.length > 0 && (
        <View style={styles.results}>
          {results.map((item, idx) => {
            const isFollowing = item._isFollowing ?? false;
            const followsMe = item._followsMe ?? false;
            const followLabel = followService.getFollowButtonLabel(isFollowing, followsMe);
            const friendStatus = item._friendStatus ?? 'none';
            const followLoading = actionLoading[`follow_${item.uid}`];
            const friendLoading = actionLoading[`friend_${item.uid}`];

            return (
              <TouchableOpacity
                key={item.uid}
                style={[styles.resultRow, idx < results.length - 1 && styles.resultRowBorder]}
                onPress={() => onViewUser?.(item.uid)}
                activeOpacity={0.75}
              >
                <UserAvatar
                  photoURL={item.photoURL}
                  displayName={item.displayName}
                  username={item.username}
                  size={40}
                />

                <View style={styles.nameBlock}>
                  <Text style={styles.displayName} numberOfLines={1}>
                    {item.displayName || item.username}
                  </Text>
                  <Text style={styles.username}>@{item.username}</Text>
                </View>

                {/* Follow pill */}
                <TouchableOpacity
                  style={[styles.pill, isFollowing && styles.pillActive]}
                  onPress={(e) => { e.stopPropagation(); handleFollow(item.uid, isFollowing); }}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary} style={{ width: 36 }} />
                  ) : (
                    <Text style={[styles.pillText, isFollowing && styles.pillTextActive]}>
                      {followLabel}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Friend pill */}
                <TouchableOpacity
                  style={[
                    styles.pill,
                    friendStatus === 'friends' && styles.pillActive,
                    friendStatus === 'pending_sent' && styles.pillMuted,
                  ]}
                  onPress={(e) => { e.stopPropagation(); handleFriend(item.uid, friendStatus); }}
                  disabled={friendLoading || friendStatus === 'pending_sent'}
                >
                  {friendLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary} style={{ width: 40 }} />
                  ) : (
                    <Text style={[
                      styles.pillText,
                      friendStatus === 'friends' && styles.pillTextActive,
                      friendStatus === 'pending_sent' && styles.pillTextMuted,
                    ]}>
                      {friendLabel(friendStatus)}
                    </Text>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {queryText.length >= 2 && !loading && results.length === 0 && (
        <Text style={styles.emptyText}>No users found</Text>
      )}
    </View>
  );
};

export default UserSearchSection;

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xs,
    minWidth: 0,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Glass.postBorder,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: Spacing.xs,
    overflow: 'hidden',
    minWidth: 0,
    width: '100%',
  },
  searchIcon: {
    flexShrink: 0,
  },
  trailingIcon: {
    flexShrink: 0,
  },
  input: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  results: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(10,10,10,0.9)',
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  resultRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(109,40,217,0.12)',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Glass.primaryTint,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  username: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(139,92,246,0.06)',
    flexShrink: 0,
  },
  pillActive: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: Colors.primary,
  },
  pillMuted: {
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'transparent',
  },
  pillText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  pillTextActive: {
    color: Colors.primary,
  },
  pillTextMuted: {
    color: Colors.textTertiary,
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});
