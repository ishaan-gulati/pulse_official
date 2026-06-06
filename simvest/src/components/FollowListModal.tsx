import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { followService } from '../services/followService';
import { userService, UserProfile } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography, Glass } from '../constants/theme';
import UserAvatar from './UserAvatar';

type FollowListModalProps = {
  visible: boolean;
  uid: string;
  mode: 'followers' | 'following';
  onClose: () => void;
  onViewUser?: (uid: string) => void;
};

const FollowListModal: React.FC<FollowListModalProps> = ({ visible, uid, mode, onClose, onViewUser }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<(UserProfile & { uid: string })[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [followsMeSet, setFollowsMeSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setProfiles([]);
    (async () => {
      try {
        const uids = mode === 'followers'
          ? await followService.getFollowers(uid)
          : await followService.getFollowing(uid);

        const profs = await Promise.all(uids.map((u) => userService.getUserProfile(u)));
        const valid = profs
          .map((p, i) => (p ? { ...p, uid: uids[i] } : null))
          .filter(Boolean) as (UserProfile & { uid: string })[];

        if (cancelled) return;
        setProfiles(valid);

        if (user?.uid) {
          const [myFollowing, myFollowers] = await Promise.all([
            followService.getFollowing(user.uid),
            followService.getFollowers(user.uid),
          ]);
          if (!cancelled) {
            setFollowingSet(new Set(myFollowing));
            setFollowsMeSet(new Set(myFollowers));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, uid, mode, user?.uid]);

  const handleFollowToggle = async (targetUid: string) => {
    if (!user?.uid) return;
    if (followingSet.has(targetUid)) {
      await followService.unfollow(user.uid, targetUid);
      setFollowingSet((prev) => { const s = new Set(prev); s.delete(targetUid); return s; });
    } else {
      await followService.follow(user.uid, targetUid);
      setFollowingSet((prev) => new Set([...prev, targetUid]));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{mode === 'followers' ? 'Followers' : 'Following'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Nobody here yet</Text>
          </View>
        ) : (
          <FlatList
            data={profiles}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isMe = item.uid === user?.uid;
              const following = followingSet.has(item.uid);
              const followsYou = followsMeSet.has(item.uid);
              const followLabel = followService.getFollowButtonLabel(following, followsYou);
              return (
                <View style={styles.row}>
                  <UserAvatar
                    photoURL={item.photoURL}
                    displayName={item.displayName}
                    username={item.username}
                    size={44}
                    onPress={() => { onClose(); onViewUser?.(item.uid); }}
                  />
                  <TouchableOpacity
                    style={styles.nameBlock}
                    onPress={() => { onClose(); onViewUser?.(item.uid); }}
                  >
                    <Text style={styles.displayName} numberOfLines={1}>{item.displayName || item.username}</Text>
                    <Text style={styles.username}>@{item.username}</Text>
                  </TouchableOpacity>
                  {!isMe && (
                    <TouchableOpacity
                      style={[styles.followBtn, following && styles.followBtnActive]}
                      onPress={() => handleFollowToggle(item.uid)}
                    >
                      <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                        {followLabel}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
};

export default FollowListModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Glass.primaryTint,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameBlock: {
    flex: 1,
  },
  displayName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  username: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  followBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  followBtnActive: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: Colors.primary,
  },
  followBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  followBtnTextActive: {
    color: Colors.primary,
  },
});
