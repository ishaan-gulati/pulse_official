import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { AI_EXPLAIN_ERRORS } from '../services/aiExplainService';

export type AIExplainStatus = 'idle' | 'loading' | 'success' | 'error';

type AIExplainModalProps = {
  visible: boolean;
  title: string;
  status: AIExplainStatus;
  explanation: string | null;
  errorCode?: string | null;
  onClose: () => void;
};

const AIExplainModal: React.FC<AIExplainModalProps> = ({
  visible,
  title,
  status,
  explanation,
  errorCode,
  onClose,
}) => {
  const errorMessage =
    errorCode === AI_EXPLAIN_ERRORS.NO_API_KEY
      ? 'AI is not configured. Add your Groq API key in the app config.'
      : errorCode === AI_EXPLAIN_ERRORS.LIMIT_REACHED
        ? "You've used your daily limit for portfolio explanations. Try again tomorrow."
        : errorCode === AI_EXPLAIN_ERRORS.RATE_LIMIT
          ? 'Too many requests right now. Wait a minute and try again.'
          : errorCode === AI_EXPLAIN_ERRORS.NETWORK_ERROR || errorCode === AI_EXPLAIN_ERRORS.UNKNOWN
            ? 'Something went wrong. Please try again later.'
            : status === 'error'
              ? 'Something went wrong. Please try again later.'
              : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <View style={styles.closeButton} />
        </View>

        {status === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Getting AI explanation...</Text>
          </View>
        )}

        {status === 'error' && errorMessage && (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={Colors.warning} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {status === 'success' && explanation && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={16} color={Colors.primary} />
              <Text style={styles.badgeText}>AI summary</Text>
            </View>
            <Text style={styles.body}>{explanation}</Text>
          </ScrollView>
        )}

        {status === 'idle' && (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={Colors.textTertiary} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

export default AIExplainModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  errorText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  body: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    lineHeight: 24,
  },
});
