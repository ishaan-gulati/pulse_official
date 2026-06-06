import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { groupService } from '../services/groupService';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography, Glass } from '../constants/theme';
import type { Group } from '../types';

type GroupsSectionProps = {
  onViewGroup?: (groupId: string) => void;
};

const GroupsSection: React.FC<GroupsSectionProps> = ({ onViewGroup }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const myGroups = await groupService.getMyGroups(user.uid);
      setGroups(myGroups);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!user?.uid || !newGroupName.trim()) return;
    setCreating(true);
    try {
      const { joinCode } = await groupService.createGroup(user.uid, newGroupName.trim());
      setNewGroupName('');
      setCreateModalVisible(false);
      Alert.alert(
        'Group Created! 🎉',
        `Share this invite code with friends:\n\n${joinCode}`,
        [{ text: 'Done' }]
      );
      load();
    } catch (e: any) {
      const msg = e?.code === 'permission-denied'
        ? 'Permission denied. Please try again.'
        : e?.message ?? 'Could not create group. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!user?.uid || !joinCodeInput.trim()) return;
    setJoining(true);
    try {
      await groupService.joinGroupByCode(user.uid, joinCodeInput.trim());
      setJoinCodeInput('');
      setJoinModalVisible(false);
      Alert.alert('Joined!', 'You have been added to the group.');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not join group. Check the code and try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <View>
      {/* Two action buttons side-by-side */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color={Colors.primary} />
          <Text style={styles.actionBtnText}>Create</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => setJoinModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="enter-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.actionBtnTextSecondary}>Join by Code</Text>
        </TouchableOpacity>
      </View>

      {/* Group list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptyHint}>Create one or join with a code</Text>
        </View>
      ) : (
        <View style={styles.groupList}>
          {groups.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={styles.groupCard}
              onPress={() => onViewGroup?.(g.id)}
              activeOpacity={0.75}
            >
              <View style={styles.groupIcon}>
                <Text style={styles.groupInitial}>{g.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName} numberOfLines={1}>{g.name}</Text>
                <Text style={styles.groupMeta}>
                  {g.members.length} member{g.members.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Create Group Modal ── */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => { setCreateModalVisible(false); setNewGroupName(''); }}
      >
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Group</Text>
            <TouchableOpacity
              onPress={() => { setCreateModalVisible(false); setNewGroupName(''); }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Group name</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Group name"
            placeholderTextColor={Colors.textTertiary}
            value={newGroupName}
            onChangeText={setNewGroupName}
            maxLength={40}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, (!newGroupName.trim() || creating) && styles.primaryBtnDisabled]}
            onPress={handleCreate}
            disabled={!newGroupName.trim() || creating}
            activeOpacity={0.85}
          >
            {creating ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="add-circle" size={18} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Create Group</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Join by Code Modal ── */}
      <Modal
        visible={joinModalVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => { setJoinModalVisible(false); setJoinCodeInput(''); }}
      >
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Join a Group</Text>
            <TouchableOpacity
              onPress={() => { setJoinModalVisible(false); setJoinCodeInput(''); }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Invite code</Text>
          <TextInput
            style={[styles.modalInput, styles.codeInput]}
            placeholder="ABC123"
            placeholderTextColor={Colors.textTertiary}
            value={joinCodeInput}
            onChangeText={setJoinCodeInput}
            autoCapitalize="characters"
            maxLength={8}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleJoin}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, (!joinCodeInput.trim() || joining) && styles.primaryBtnDisabled]}
            onPress={handleJoin}
            disabled={!joinCodeInput.trim() || joining}
            activeOpacity={0.85}
          >
            {joining ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="enter-outline" size={18} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Join Group</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

export default GroupsSection;

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'rgba(139,92,246,0.14)',
  },
  actionBtnSecondary: {
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  actionBtnTextSecondary: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textSecondary,
  },
  center: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: Spacing.xs,
  },
  emptyHint: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  groupList: {
    gap: Spacing.sm,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(139,92,246,0.06)',
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: Glass.postBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInitial: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.primary,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  groupMeta: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  // Modal
  modal: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Glass.postBorder,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.xxl,
  },
  codeInput: {
    letterSpacing: 4,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
    fontSize: Typography.fontSize.xl,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: 14,
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
    fontSize: Typography.fontSize.md,
  },
});
