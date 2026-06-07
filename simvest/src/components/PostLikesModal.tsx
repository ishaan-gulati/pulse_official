import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { postsService } from '../services/postsService';
import { UserProfile } from '../services/userService';
import { Colors, Spacing, BorderRadius, Typography, Glass } from '../constants/theme';
import UserAvatar from './UserAvatar';

const SHEET_MAX_HEIGHT = Math.min(Dimensions.get('window').height * 0.52, 420);

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Likes</Text>
            {!loading && profiles.length > 0 ? (
              <Text style={styles.count}>{profiles.length}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : profiles.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No likes yet</Text>
            </View>
          ) : (
            <FlatList
              data={profiles}
              keyExtractor={(item) => item.uid}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
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
                    size={40}
                  />
                  <View style={styles.nameBlock}>
                    <Text style={styles.displayName} numberOfLines={1}>
                      {item.displayName || item.username}
                    </Text>
                    <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

export default PostLikesModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: '#161B22',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Glass.postBorder,
    paddingBottom: Spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,92,246,0.12)',
  },
  title: {
    flex: 1,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  count: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textTertiary,
    marginRight: Spacing.sm,
  },
  closeBtn: {
    padding: 4,
  },
  center: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(139,92,246,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.postBorder,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  username: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
