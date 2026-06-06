import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography, Shadows, Glass } from '../constants/theme';
import { userService } from '../services/userService';
import { getCurrentAppVersion } from '../services/appVersionService';
import { PRIVACY_POLICY_URL, SUPPORT_URL, SUPPORT_EMAIL, TERMS_OF_SERVICE_URL } from '../constants/urls';

type SettingsScreenProps = {
  onBack: () => void;
};

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const { user, logout, deleteAccount } = useAuth();
  const insets = useSafeAreaInsets();
  const [resetting, setResetting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showPortfolioToOthers, setShowPortfolioToOthers] = useState(true);
  const [portfolioPrivacyLoading, setPortfolioPrivacyLoading] = useState(true);
  const [savingPortfolioPrivacy, setSavingPortfolioPrivacy] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setPortfolioPrivacyLoading(false);
      return;
    }
    let cancelled = false;
    setPortfolioPrivacyLoading(true);
    userService
      .getUserProfile(user.uid)
      .then((p) => {
        if (!cancelled && p) setShowPortfolioToOthers(p.showPortfolioToOthers !== false);
      })
      .finally(() => {
        if (!cancelled) setPortfolioPrivacyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleShowPortfolioToggle = async (value: boolean) => {
    if (!user?.uid) return;
    const previous = showPortfolioToOthers;
    setShowPortfolioToOthers(value);
    setSavingPortfolioPrivacy(true);
    try {
      await userService.updateUserProfile(user.uid, { showPortfolioToOthers: value });
    } catch {
      setShowPortfolioToOthers(previous);
      Alert.alert('Error', 'Could not update this setting. Please try again.');
    } finally {
      setSavingPortfolioPrivacy(false);
    }
  };

  useEffect(() => {
    if (user?.uid && deleteModalVisible) {
      const email = user.email ?? null;
      if (email) setDeleteEmail(email);
      else userService.getUserProfile(user.uid).then((p) => p && setDeleteEmail(p.email || ''));
    }
  }, [user?.uid, user?.email, deleteModalVisible]);

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const runReset = async (alsoResetAchievements: boolean) => {
    if (!user?.uid) return;
    setResetting(true);
    try {
      await userService.resetPortfolio(user.uid, 10000, alsoResetAchievements);
      Alert.alert(
        'Done',
        alsoResetAchievements
          ? 'Portfolio reset to $10,000 and achievements/level cleared. Go to Portfolio to see the update.'
          : 'Portfolio reset to $10,000. Go to Portfolio to see the update.'
      );
      onBack();
    } catch (error) {
      console.error('Reset error:', error);
      Alert.alert('Error', 'Failed to reset. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const openURL = async (url: string, label: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(label, 'Unable to open link. Please check the URL.');
      }
    } catch (_) {
      Alert.alert(label, 'Unable to open link.');
    }
  };

  const handlePrivacyPolicy = () => openURL(PRIVACY_POLICY_URL, 'Privacy Policy');
  const handleTerms = () => openURL(TERMS_OF_SERVICE_URL, 'Terms of Service');
  const handleSupport = () => openURL(SUPPORT_URL, 'Help & Support');
  const handleSupportEmail = () => openURL(`mailto:${SUPPORT_EMAIL}`, 'Contact');

  const handleDeleteAccountPress = () => {
    Alert.alert(
      'Delete account',
      'All your data (profile, portfolio, posts, and activity) will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => setDeleteModalVisible(true) },
      ]
    );
  };

  const handleDeleteAccountSubmit = async () => {
    const email = deleteEmail.trim();
    const password = deletePassword.trim();
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(email, password);
      setDeleteModalVisible(false);
      setDeletePassword('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to delete account. Make sure your password is correct.');
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPortfolio = () => {
    Alert.alert(
      'Reset portfolio',
      'This will remove all positions and trading history, clear period-return history, and set your account to $10,000 cash with 0% returns. Leaderboard will update. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset to $10k',
          style: 'destructive',
          onPress: () => runReset(false),
        },
        {
          text: 'Reset + clear achievements',
          style: 'destructive',
          onPress: () => runReset(true),
        },
      ]
    );
  };

  const SettingsRow: React.FC<{
    icon: string;
    label: string;
    onPress?: () => void;
    destructive?: boolean;
    rightElement?: React.ReactNode;
  }> = ({ icon, label, onPress, destructive, rightElement }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={styles.rowLeft}>
        <Ionicons
          name={icon}
          size={22}
          color={destructive ? Colors.error : Colors.textSecondary}
        />
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
          {label}
        </Text>
      </View>
      {rightElement ?? (onPress && !destructive ? <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} /> : null)}
    </TouchableOpacity>
  );

  const scrollContentStyle = [
    styles.content,
    { paddingLeft: Spacing.lg + insets.left, paddingRight: Spacing.lg + insets.right },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
      >
        {/* Account section */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon="log-out-outline"
            label="Log out"
            onPress={handleLogout}
            destructive
          />
          <View style={styles.rowDivider} />
          <TouchableOpacity
            style={styles.row}
            onPress={handleResetPortfolio}
            disabled={resetting}
            activeOpacity={0.6}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="refresh-outline" size={22} color={Colors.error} />
              <Text style={[styles.rowLabel, styles.rowLabelDestructive]}>
                Reset portfolio to $10k
              </Text>
            </View>
            {resetting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            )}
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="trash-outline"
            label="Delete account"
            onPress={handleDeleteAccountPress}
            destructive
          />
        </View>

        <Modal visible={deleteModalVisible} transparent animationType="fade">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.deleteModalOverlay}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => !deleting && setDeleteModalVisible(false)}
            />
            <View style={styles.deleteModalCard}>
              <Text style={styles.deleteModalTitle}>Delete account</Text>
              <Text style={styles.deleteModalText}>
                Enter your password to confirm. All data will be permanently deleted.
              </Text>
              {deleteEmail ? (
                <Text style={styles.deleteModalEmail} numberOfLines={1}>{deleteEmail}</Text>
              ) : null}
              <TextInput
                style={styles.deleteModalInput}
                placeholder="Password"
                placeholderTextColor={Colors.textTertiary}
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!deleting}
              />
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                  onPress={() => !deleting && setDeleteModalVisible(false)}
                  disabled={deleting}
                >
                  <Text style={styles.deleteModalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteModalButtonConfirm]}
                  onPress={handleDeleteAccountSubmit}
                  disabled={deleting || !deletePassword.trim()}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.deleteModalButtonConfirmText}>Delete account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Preferences section (placeholders for later) */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.sectionCard}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="eye-outline" size={22} color={Colors.textSecondary} />
              <View style={styles.privacyLabelBlock}>
                <Text style={styles.rowLabel}>Let others see my holdings</Text>
                <Text style={styles.rowSubtext}>
                  Controls only your account: when off, other people see your total value but not your positions. You always see your own holdings on the Profile tab. Everyone else’s visibility is their own choice.
                </Text>
              </View>
            </View>
            {portfolioPrivacyLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Switch
                value={showPortfolioToOthers}
                onValueChange={handleShowPortfolioToggle}
                disabled={savingPortfolioPrivacy}
                trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                thumbColor={showPortfolioToOthers ? Colors.primary : Colors.textTertiary}
              />
            )}
          </View>
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => Alert.alert('Coming soon', 'Notification preferences will be available in a future update.')}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="moon-outline"
            label="Appearance"
            onPress={() => Alert.alert('Coming soon', 'Dark/light theme options will be available in a future update.')}
          />
        </View>

        {/* About / Legal */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon="document-text-outline"
            label="Privacy Policy"
            onPress={handlePrivacyPolicy}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="reader-outline"
            label="Terms of Service"
            onPress={handleTerms}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="help-buoy-outline"
            label="Help & Support"
            onPress={handleSupport}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="mail-outline"
            label="Contact us"
            onPress={handleSupportEmail}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="information-circle-outline"
            label="App version"
            rightElement={<Text style={styles.versionText}>{getCurrentAppVersion()}</Text>}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;

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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  sectionTitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  sectionCard: {
    backgroundColor: Glass.fillSubtle,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.postBorder,
    overflow: 'hidden',
    ...Shadows.small,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  rowLeft: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowLabel: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  privacyLabelBlock: {
    flex: 1,
    minWidth: 0,
  },
  rowSubtext: {
    marginTop: Spacing.xs,
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
  },
  rowLabelDestructive: {
    color: Colors.error,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.lg + 22 + Spacing.md,
  },
  versionText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  deleteModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  deleteModalCard: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Shadows.medium,
  },
  deleteModalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  deleteModalText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.md,
  },
  deleteModalEmail: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.sm,
  },
  deleteModalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    marginBottom: Spacing.lg,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  deleteModalButtonCancel: {
    backgroundColor: Colors.backgroundTertiary,
  },
  deleteModalButtonCancelText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  deleteModalButtonConfirm: {
    backgroundColor: Colors.error,
  },
  deleteModalButtonConfirmText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
});
