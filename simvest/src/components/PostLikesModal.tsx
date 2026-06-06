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
import { postsService } from '../services/postsService';
import { UserProfile } from '../services/userService';
import { Colors, Spacing, Typography, Glass } from '../constants/theme';
import UserAvatar from './UserAvatar';

type PostLikesModalProps = {
  visible: boolean;
  postId: string;
  onClose: () => void;
  onViewUser?: (uid: string) => void;
};

const PostLikesModal: React.FC<PostLikesModalProps> = ({ visible, postId, onClose, onViewUser }) => {
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<(UserProfile & { uid: string })[]>([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setProfiles([]);
    postsService.getPostLikers(postId)
      .then((results) => {
        if (!cancelled) setProfiles(results);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [visible, postId]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Likes</Text>
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
            <Text style={styles.emptyText}>No likes yet</Text>
          </View>
        ) : (
          <FlatList
            data={profiles}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  onClose();
                  onViewUser?.(item.uid);
                }}
                activeOpacity={0.75}
              >
                <UserAvatar
                  photoURL={item.photoURL}
                  displayName={item.displayName}
                  username={item.username}
                  size={44}
                />
                <View style={styles.nameBlock}>
                  <Text style={styles.displayName} numberOfLines={1}>
                    {item.displayName || item.username}
                  </Text>
                  <Text style={styles.username}>@{item.username}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
};

export default PostLikesModal;

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
});
