import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import type { ForceUpdateConfig } from '../services/appVersionService';
import { getStoreUrlForPlatform } from '../services/appVersionService';

type Props = {
  visible: boolean;
  config: ForceUpdateConfig;
  currentVersion: string;
  onDismiss: () => void;
};

const ForceUpdateModal: React.FC<Props> = ({ visible, config, currentVersion, onDismiss }) => {
  const url = getStoreUrlForPlatform(config);

  const openStore = () => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} hitSlop={12} accessibilityLabel="Dismiss">
            <Ionicons name="close" size={22} color={Colors.textTertiary} />
          </TouchableOpacity>
          <Ionicons name="cloud-download-outline" size={44} color={Colors.primary} />
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.meta}>
            You are on v{currentVersion}. Required: v{config.minimumVersion} or newer.
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnSecondary} onPress={onDismiss} activeOpacity={0.85}>
              <Text style={styles.btnSecondaryText}>Later</Text>
            </TouchableOpacity>
            {url ? (
              <TouchableOpacity style={styles.btnPrimary} onPress={openStore} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>Open App Store</Text>
                <Ionicons name="open-outline" size={18} color={Colors.white} />
              </TouchableOpacity>
            ) : (
              <Text style={styles.hint}>Add your App Store URL in constants/urls.ts (APP_STORE_URL).</Text>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    maxWidth: 400,
    width: '100%',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 1,
    padding: Spacing.xs,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  meta: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  actions: {
    width: '100%',
    gap: Spacing.sm,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  btnPrimaryText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  btnSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  btnSecondaryText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  hint: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});

export default ForceUpdateModal;
