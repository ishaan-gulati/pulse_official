import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Glass, Shadows } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { postsService } from '../services/postsService';
import { userService, UserProfile } from '../services/userService';
import { extractStockSymbols } from '../utils/stockParser';
import UserAvatar from './UserAvatar';

const POST_MAX = 500;

const TOPIC_PRESETS = ['Trading', 'Analysis', 'Earnings', 'Watchlist', 'Question', 'Hot Take'] as const;

const QUICK_TICKERS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META'] as const;

type ComposeModalProps = {
  visible: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
};

const ComposeModal: React.FC<ComposeModalProps> = ({ visible, onClose, onPostCreated }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [showCustomTopic, setShowCustomTopic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setContent('');
      setTopic('');
      setCustomTopic('');
      setShowCustomTopic(false);
      return;
    }
    if (!user?.uid) return;
    userService.getUserProfile(user.uid).then(setProfile).catch(() => {});
  }, [visible, user?.uid]);

  const detectedSymbols = useMemo(() => extractStockSymbols(content), [content]);
  const selectedTopicLabel = showCustomTopic ? customTopic.trim() : topic.trim();

  const canPost = content.trim().length > 0 && !submitting;

  const insertTicker = (symbol: string) => {
    const tag = `$${symbol}`;
    setContent((prev) => {
      if (new RegExp(`\\$${symbol}\\b`, 'i').test(prev)) return prev;
      const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
      return `${prev}${spacer}${tag} `;
    });
  };

  const submit = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to post');
      return;
    }

    const trimmed = content.trim();

    if (!trimmed) {
      Alert.alert('Write something', 'Add a message before posting.');
      return;
    }

    if (trimmed.length > POST_MAX) {
      Alert.alert('Too long', `Keep your post under ${POST_MAX} characters.`);
      return;
    }

    const finalTopic = selectedTopicLabel || undefined;

    setSubmitting(true);
    try {
      await postsService.createPost(user.uid, trimmed, undefined, finalTopic);
      onPostCreated?.();
      setTimeout(onClose, 200);
    } catch (error: unknown) {
      console.error('Error creating post:', error);
      const err = error as { code?: string; message?: string };
      let errorMessage = 'Failed to create post';
      if (err?.code === 'permission-denied') {
        errorMessage = 'You do not have permission to create posts.';
      } else if (err?.message) {
        errorMessage = err.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.root, { paddingTop: Math.max(insets.top * 0.25, 4) }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.iconBtn}
              disabled={submitting}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create post</Text>
            <TouchableOpacity
              style={[styles.postBtn, canPost && styles.postBtnActive]}
              onPress={submit}
              disabled={!canPost}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={[styles.postBtnText, canPost && styles.postBtnTextActive]}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Main write area */}
            <View style={styles.composeBlock}>
              <View style={styles.composeRow}>
                <UserAvatar
                  photoURL={profile?.photoURL}
                  displayName={profile?.displayName}
                  username={profile?.username}
                  size={44}
                />
                <View style={styles.composeMain}>
                  <Text style={styles.authorName} numberOfLines={1}>
                    {profile?.displayName || profile?.username || 'You'}
                  </Text>
                  <TextInput
                    value={content}
                    onChangeText={setContent}
                    style={styles.contentInput}
                    placeholder="Share your take… use $ before a ticker to tag it"
                    placeholderTextColor={Colors.textTertiary}
                    maxLength={POST_MAX}
                    editable={!submitting}
                    multiline
                    textAlignVertical="top"
                    autoFocus
                  />
                </View>
              </View>

              <View style={styles.composeMeta}>
                <Text style={[styles.charCount, content.length > POST_MAX - 40 && styles.charCountWarn]}>
                  {content.length}/{POST_MAX}
                </Text>
                {detectedSymbols.length > 0 ? (
                  <View style={styles.linkedRow}>
                    {detectedSymbols.map((sym) => (
                      <View key={sym} style={styles.linkedPill}>
                        <Text style={styles.linkedPillText}>${sym}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>

            {/* Topics */}
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Topic</Text>
              <View style={styles.topicWrap}>
                {TOPIC_PRESETS.map((t) => {
                  const selected = !showCustomTopic && topic === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.topicChip, selected && styles.topicChipActive]}
                      onPress={() => {
                        setShowCustomTopic(false);
                        setCustomTopic('');
                        setTopic((prev) => (prev === t ? '' : t));
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.topicChipText, selected && styles.topicChipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.topicChip, showCustomTopic && styles.topicChipActive]}
                  onPress={() => {
                    if (showCustomTopic) {
                      setShowCustomTopic(false);
                      setCustomTopic('');
                    } else {
                      setShowCustomTopic(true);
                      setTopic('');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="create-outline"
                    size={13}
                    color={showCustomTopic ? Colors.white : Colors.primary}
                  />
                  <Text style={[styles.topicChipText, showCustomTopic && styles.topicChipTextActive]}>Custom</Text>
                </TouchableOpacity>
              </View>
              {showCustomTopic ? (
                <TextInput
                  value={customTopic}
                  onChangeText={setCustomTopic}
                  style={styles.customTopicInput}
                  placeholder="Name your topic…"
                  placeholderTextColor={Colors.textTertiary}
                  maxLength={30}
                />
              ) : null}
            </View>

            {/* Quick tickers */}
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Tag a stock</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tickerScroll}
              >
                {QUICK_TICKERS.map((symbol) => {
                  const linked = detectedSymbols.includes(symbol);
                  return (
                    <TouchableOpacity
                      key={symbol}
                      style={[styles.tickerChip, linked && styles.tickerChipLinked]}
                      onPress={() => insertTicker(symbol)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.tickerChipText, linked && styles.tickerChipTextLinked]}>${symbol}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default ComposeModal;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Glass.postBorder,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  postBtn: {
    minWidth: 68,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: Glass.postBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnActive: {
    backgroundColor: '#A78BFA',
    borderColor: '#A78BFA',
    ...Shadows.small,
  },
  postBtnText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  postBtnTextActive: {
    color: Colors.white,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  composeBlock: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Glass.postBorder,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  composeMain: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  contentInput: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    lineHeight: 26,
    minHeight: 140,
    padding: 0,
  },
  composeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginLeft: 44 + Spacing.md,
    gap: Spacing.sm,
  },
  charCount: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  charCountWarn: {
    color: Colors.warning,
  },
  linkedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    flex: 1,
  },
  linkedPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  linkedPillText: {
    color: Colors.success,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  block: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  blockLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  topicWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  topicChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  topicChipText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  topicChipTextActive: {
    color: Colors.white,
  },
  customTopicInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Glass.postBorder,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
  },
  tickerScroll: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  tickerChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Glass.postBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tickerChipLinked: {
    borderColor: Colors.success,
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  tickerChipText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  tickerChipTextLinked: {
    color: Colors.success,
  },
});
