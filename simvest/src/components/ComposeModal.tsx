import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { postsService } from '../services/postsService';

type ComposeModalProps = {
  visible: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
};

const ComposeModal: React.FC<ComposeModalProps> = ({ visible, onClose, onPostCreated }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [showTopicInput, setShowTopicInput] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setContent('');
      setTopic('');
      setShowTopicInput(false);
      setTopicInput('');
    }
  }, [visible]);

  const submit = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to post');
      return;
    }

    if (!content.trim()) {
      Alert.alert('Error', 'Please enter some content');
      return;
    }

    if (content.trim().length > 280) {
      Alert.alert('Error', 'Post must be 280 characters or less');
      return;
    }

    setSubmitting(true);
    try {
      const postId = await postsService.createPost(
        user.uid,
        content.trim(),
        undefined, // No body
        topic.trim() || undefined
      );
      
      // Success - clear form and close
      setContent('');
      setTopic('');
      
      // Trigger refresh callback
      onPostCreated?.();
      
      // Close modal after a brief delay to show success
      setTimeout(() => {
    onClose();
      }, 300);
    } catch (error: any) {
      console.error('Error creating post:', error);
      let errorMessage = 'Failed to create post';
      
      if (error?.code === 'permission-denied') {
        errorMessage = 'You do not have permission to create posts. Please check your account.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
        <View style={styles.header}> 
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Create Post</Text>
            </View>
            <TouchableOpacity 
              style={[
                styles.postBtn, 
                submitting && styles.postBtnDisabled, 
                !content.trim() && styles.postBtnDisabled,
                content.trim() && !submitting && styles.postBtnActive
              ]} 
              onPress={submit}
              disabled={submitting || !content.trim()}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={content.trim() ? Colors.white : Colors.textSecondary} />
              ) : (
                <Text style={[styles.postText, content.trim() && styles.postTextActive]}>Post</Text>
              )}
            </TouchableOpacity>
        </View>

          <View style={styles.contentWrapper}>
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
            {topic.length > 0 && (
              <View style={styles.topicContainer}>
                <View style={styles.topicPill}>
                  <Text style={styles.topicText}>{topic}</Text>
                  <TouchableOpacity onPress={() => setTopic('')} style={styles.topicRemove}>
                    <Ionicons name="close" size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
        </View>
            )}

            <View style={styles.contentContainer}>
        <TextInput
                value={content}
                onChangeText={setContent}
                style={styles.contentInput}
                placeholder="What's on your mind?"
                placeholderTextColor={Colors.textDisabled}
                maxLength={280}
                editable={!submitting}
                multiline
                autoFocus
              />
              <View style={styles.charCountRow}>
                <Text style={[styles.charCount, content.length > 250 && styles.charCountWarning]}>
                  {content.length}/280
                </Text>
              </View>
            </View>

            {!topic && !showTopicInput && (
              <TouchableOpacity 
                style={styles.addTopicBtn}
                onPress={() => setShowTopicInput(true)}
              >
                <Text style={styles.addTopicText}>+ Add topic</Text>
              </TouchableOpacity>
            )}

            {showTopicInput && (
              <View style={styles.topicInputContainer}>
        <TextInput
                  value={topicInput}
                  onChangeText={setTopicInput}
                  style={styles.topicInputField}
                  placeholder="Enter topic"
                  placeholderTextColor={Colors.textTertiary}
                  autoFocus
                  maxLength={30}
                  onSubmitEditing={() => {
                    if (topicInput.trim()) {
                      setTopic(topicInput.trim());
                      setTopicInput('');
                      setShowTopicInput(false);
                    }
                  }}
                />
                <View style={styles.topicInputActions}>
                  <TouchableOpacity 
                    onPress={() => {
                      setShowTopicInput(false);
                      setTopicInput('');
                    }}
                    style={styles.topicCancelBtn}
                  >
                    <Text style={styles.topicCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      if (topicInput.trim()) {
                        setTopic(topicInput.trim());
                        setTopicInput('');
                        setShowTopicInput(false);
                      }
                    }}
                    style={[styles.topicAddBtn, !topicInput.trim() && styles.topicAddBtnDisabled]}
                    disabled={!topicInput.trim()}
                  >
                    <Text style={styles.topicAddText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {submitting && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Posting...</Text>
      </View>
            )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

export default ComposeModal;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  cancelBtn: {
    minWidth: 70,
    paddingVertical: Spacing.xs,
  },
  cancelText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  postBtn: {
    backgroundColor: Colors.backgroundTertiary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  postBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadows.small,
  },
  postText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  postTextActive: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.extrabold,
  },
  postBtnDisabled: {
    opacity: 0.4,
  },
  topicContainer: {
    marginBottom: Spacing.lg,
  },
  topicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    borderWidth: 2,
    borderColor: Colors.primary + '70',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignSelf: 'flex-start',
    gap: Spacing.md,
    ...Shadows.medium,
  },
  topicText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.extrabold,
    letterSpacing: 0.3,
  },
  topicRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTopicBtn: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.primary + '80',
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadows.medium,
  },
  addTopicText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.extrabold,
    letterSpacing: 0.3,
  },
  topicInputContainer: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  topicInputField: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: Colors.primary + '50',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.normal,
    minHeight: 56,
    marginBottom: Spacing.md,
    textAlignVertical: 'center',
    includeFontPadding: false,
    ...Shadows.medium,
  },
  topicInputActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  topicCancelBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  topicCancelText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  topicAddBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.medium,
  },
  topicAddBtnDisabled: {
    opacity: 0.4,
    backgroundColor: Colors.backgroundTertiary,
  },
  topicAddText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.extrabold,
  },
  contentContainer: {
    marginBottom: Spacing.xl,
  },
  contentInput: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.normal,
    minHeight: 150,
    textAlignVertical: 'top',
    lineHeight: 32,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: Colors.primary + '40',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.small,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.sm,
    paddingRight: Spacing.xs,
  },
  charCount: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    letterSpacing: 0.5,
  },
  charCountWarning: {
    color: Colors.warning,
    fontWeight: Typography.fontWeight.bold,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
  },
});


