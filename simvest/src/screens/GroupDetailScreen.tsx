import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { groupService } from '../services/groupService';
import { friendService } from '../services/friendService';
import { userService, UserProfile } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography, Glass } from '../constants/theme';
import UserAvatar from '../components/UserAvatar';
import type { GroupMessage, Group } from '../types';
import type { LeaderboardEntry } from '../services/userService';
import LeaderboardList from '../components/LeaderboardList';

type Tab = 'chat' | 'members' | 'leaderboard';

type GroupDetailScreenProps = {
  groupId: string;
  onBack: () => void;
  onViewUser?: (uid: string) => void;
};

const GroupDetailScreen: React.FC<GroupDetailScreenProps> = ({ groupId, onBack, onViewUser }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('chat');
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<{ uid: string; displayName: string; username: string; photoURL?: string }[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [myFriends, setMyFriends] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const messagesUnsubRef = useRef<(() => void) | null>(null);

  const stopMessagesListener = useCallback(() => {
    messagesUnsubRef.current?.();
    messagesUnsubRef.current = null;
  }, []);

  const loadGroup = useCallback(async () => {
    if (!user?.uid) return;
    const [myGroups, membersData, friendUids] = await Promise.all([
      groupService.getMyGroups(user.uid),
      groupService.getGroupMembers(groupId),
      friendService.getFriends(user.uid),
    ]);
    const g = myGroups.find((x) => x.id === groupId) ?? null;
    setGroup(g);
    setMembers(membersData);
    setMyFriends(friendUids);
    setLoading(false);
  }, [groupId, user?.uid]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  // Real-time messages
  useEffect(() => {
    const unsub = groupService.subscribeToMessages(groupId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    });
    messagesUnsubRef.current = unsub;
    return () => {
      messagesUnsubRef.current = null;
      unsub();
    };
  }, [groupId]);

  useEffect(() => {
    setLeaderboard([]);
    setLeaderboardLoading(false);
  }, [groupId]);

  // Prefetch group leaderboard as soon as members are known (not only when tab opens)
  useEffect(() => {
    if (!group?.members?.length) return;
    let cancelled = false;
    setLeaderboardLoading(true);
    groupService.getGroupLeaderboard(groupId, group.members)
      .then((data) => {
        if (!cancelled) setLeaderboard(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLeaderboardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, group?.members]);

  const handleSend = async () => {
    if (!user?.uid || !inputText.trim()) return;
    setSending(true);
    const text = inputText.trim();
    setInputText('');
    try {
      const profile = await userService.getUserProfile(user.uid);
      await groupService.sendMessage(
        groupId,
        user.uid,
        text,
        profile?.displayName,
        profile?.username,
        profile?.photoURL
      );
    } finally {
      setSending(false);
    }
  };

  const handleInviteFriend = async (friendUid: string) => {
    try {
      await groupService.inviteFriend(groupId, friendUid);
      Alert.alert('Invited!', 'Your friend has been added to the group.');
      loadGroup();
    } catch {
      Alert.alert('Error', 'Could not invite friend.');
    }
  };

  const isOwner = group?.createdBy === user?.uid;

  const handleLeaveGroup = async () => {
    if (!user?.uid || actionLoading) return;
    setActionLoading(true);
    stopMessagesListener();
    try {
      await groupService.leaveGroup(groupId, user.uid);
      onBack();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not leave group.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!user?.uid || actionLoading) return;
    setActionLoading(true);
    stopMessagesListener();
    try {
      await groupService.deleteGroup(groupId, user.uid);
      onBack();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not delete group.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmLeaveGroup = () => {
    const onlyMember = isOwner && members.length <= 1;
    const transferOwnership = isOwner && members.length > 1;
    Alert.alert(
      'Leave Group',
      onlyMember
        ? 'You are the only member. Leaving will delete this group.'
        : transferOwnership
          ? 'You will leave and ownership will transfer to another member.'
          : 'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: handleLeaveGroup },
      ]
    );
  };

  const confirmDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'This permanently deletes the group and all messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDeleteGroup },
      ]
    );
  };

  const confirmRemoveMember = (memberUid: string, displayName: string) => {
    Alert.alert(
      'Remove Member',
      `Remove ${displayName} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!user?.uid) return;
            try {
              await groupService.removeMember(groupId, user.uid, memberUid);
              loadGroup();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not remove member.');
            }
          },
        },
      ]
    );
  };

  const showGroupOptions = () => {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Leave Group', style: 'destructive', onPress: confirmLeaveGroup },
    ];
    if (isOwner) {
      options.unshift({ text: 'Delete Group', style: 'destructive', onPress: confirmDeleteGroup });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Group Options', undefined, options);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const memberUidSet = new Set(group?.members ?? []);
  const invitableFriends = myFriends.filter((f) => !memberUidSet.has(f));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{group?.name ?? 'Group'}</Text>
        <View style={styles.headerRight}>
          {group?.joinCode ? (
            <TouchableOpacity
              onPress={() => {
                Clipboard.setString(group.joinCode);
                Alert.alert('Copied!', `Join code ${group.joinCode} copied to clipboard.`);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.joinCodeBadge}>{group.joinCode}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={showGroupOptions}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={actionLoading}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['chat', 'members', 'leaderboard'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'chat' && (
        <>
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            renderItem={({ item }) => {
              const isMe = item.userId === user?.uid;
              const memberPhoto = members.find((m) => m.uid === item.userId)?.photoURL;
              const photoURL = item.photoURL || memberPhoto;

              if (isMe) {
                return (
                  <View style={[styles.bubble, styles.bubbleMe]}>
                    <Text style={[styles.bubbleText, styles.bubbleTextMe]}>{item.text}</Text>
                  </View>
                );
              }

              return (
                <View style={styles.incomingRow}>
                  <UserAvatar
                    photoURL={photoURL}
                    displayName={item.displayName}
                    username={item.username}
                    size={28}
                    style={styles.chatAvatar}
                  />
                  <View style={styles.bubble}>
                    <Text style={styles.bubbleSender}>{item.displayName || item.username || 'User'}</Text>
                    <Text style={styles.bubbleText}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No messages yet — say hello!</Text>
              </View>
            }
          />
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Message…"
              placeholderTextColor={Colors.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                if (inputText.trim() && !sending) void handleSend();
              }}
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || sending) && { opacity: 0.5 }]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              <Ionicons name="send" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </>
      )}

      {tab === 'members' && (
        <FlatList
          data={members}
          keyExtractor={(m) => m.uid}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>Members ({members.length})</Text>
          }
          renderItem={({ item }) => (
            <PersonRow
              displayName={item.displayName || item.username}
              username={item.username}
              photoURL={item.photoURL}
              onPress={item.uid !== user?.uid ? () => onViewUser?.(item.uid) : undefined}
              trailing={
                item.uid === user?.uid ? (
                  <View style={styles.youPill}>
                    <Text style={styles.youPillText}>You</Text>
                  </View>
                ) : isOwner ? (
                  <TouchableOpacity
                    style={styles.removePill}
                    onPress={() => confirmRemoveMember(item.uid, item.displayName || item.username)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.removePillText}>Remove</Text>
                  </TouchableOpacity>
                ) : item.uid === group?.createdBy ? (
                  <View style={styles.ownerPill}>
                    <Text style={styles.ownerPillText}>Owner</Text>
                  </View>
                ) : null
              }
            />
          )}
          ListFooterComponent={
            <>
              <View style={styles.groupActions}>
                <TouchableOpacity
                  style={styles.leaveBtn}
                  onPress={confirmLeaveGroup}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.leaveBtnText}>Leave Group</Text>
                </TouchableOpacity>
                {isOwner ? (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={confirmDeleteGroup}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.deleteBtnText}>Delete Group</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {invitableFriends.length > 0 ? (
                <View style={styles.inviteSection}>
                  <Text style={styles.sectionLabel}>Invite Friends</Text>
                  {invitableFriends.map((fUid) => (
                    <InviteFriendRow
                      key={fUid}
                      uid={fUid}
                      onInvite={() => handleInviteFriend(fUid)}
                    />
                  ))}
                </View>
              ) : null}
            </>
          }
        />
      )}

      {tab === 'leaderboard' && (
        <LeaderboardList
          entries={leaderboard}
          currentUserId={user?.uid}
          onViewUser={onViewUser}
          loading={leaderboardLoading}
          emptyTitle="No group rankings yet"
          emptySubtitle="Group members will appear here once they start trading"
        />
      )}
    </KeyboardAvoidingView>
  );
};

type PersonRowProps = {
  displayName: string;
  username?: string;
  photoURL?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
};

const PersonRow: React.FC<PersonRowProps> = ({ displayName, username, photoURL, onPress, trailing }) => {
  const content = (
    <>
      <UserAvatar
        photoURL={photoURL}
        displayName={displayName}
        username={username}
        size={40}
      />
      <View style={styles.personInfo}>
        <Text style={styles.personName} numberOfLines={1}>{displayName}</Text>
        {username ? (
          <Text style={styles.personHandle} numberOfLines={1}>@{username}</Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.personTrailing}>{trailing}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.personRow} onPress={onPress} activeOpacity={0.75}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.personRow}>{content}</View>;
};

type InviteFriendRowProps = { uid: string; onInvite: () => void };
const InviteFriendRow: React.FC<InviteFriendRowProps> = ({ uid, onInvite }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    userService.getUserProfile(uid).then(setProfile).catch(() => {});
  }, [uid]);

  return (
    <PersonRow
      displayName={profile?.displayName || profile?.username || '…'}
      username={profile?.username}
      photoURL={profile?.photoURL}
      trailing={
        <TouchableOpacity style={styles.actionPill} onPress={onInvite} activeOpacity={0.8}>
          <Text style={styles.actionPillText}>Invite</Text>
        </TouchableOpacity>
      }
    />
  );
};

export default GroupDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
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
  headerTitle: {
    flex: 1,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  joinCodeBadge: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontFamily: 'monospace',
    letterSpacing: 1,
    backgroundColor: Glass.primaryTint,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
  },
  tabBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginRight: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textTertiary,
    fontWeight: Typography.fontWeight.semibold,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  messageList: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  incomingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    maxWidth: '85%',
  },
  chatAvatar: {
    marginBottom: 2,
  },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '75%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: Glass.postBorder,
    borderRadius: BorderRadius.lg,
    borderTopLeftRadius: 4,
    padding: Spacing.sm,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: Colors.primary,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: 4,
  },
  bubbleSender: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: Colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Glass.postBorder,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(139,92,246,0.05)',
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Glass.primaryTint,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  personInfo: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  personHandle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    lineHeight: 18,
    marginTop: 1,
  },
  personTrailing: {
    flexShrink: 0,
    marginLeft: Spacing.xs,
  },
  youPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'rgba(139,92,246,0.12)',
    minWidth: 52,
    alignItems: 'center',
  },
  youPillText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
  },
  inviteSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(109,40,217,0.15)',
  },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'rgba(139,92,246,0.1)',
    minWidth: 52,
    alignItems: 'center',
  },
  actionPillText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
  },
  removePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.error,
    backgroundColor: 'rgba(239,68,68,0.1)',
    minWidth: 68,
    alignItems: 'center',
  },
  removePillText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.error,
  },
  ownerPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.textTertiary,
    backgroundColor: 'rgba(255,255,255,0.05)',
    minWidth: 52,
    alignItems: 'center',
  },
  ownerPillText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textSecondary,
  },
  groupActions: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(109,40,217,0.15)',
    gap: Spacing.sm,
  },
  leaveBtn: {
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  leaveBtnText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  deleteBtn: {
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.error,
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  deleteBtnText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.error,
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
  },
});
