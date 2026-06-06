import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { referralService, REFERRAL_BONUS_REFERRER, REFERRAL_BONUS_NEW_USER } from '../services/referralService';
import { APP_STORE_URL } from '../constants/urls';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';

function buildReferralInviteMessage(code: string): string {
  return `Join me on Pulse! Use my referral code ${code} - we each get ${formatCurrency(REFERRAL_BONUS_NEW_USER)} bonus cash when you sign up. Get the app: ${APP_STORE_URL} 🚀`;
}

type ReferModalProps = {
  visible: boolean;
  onClose: () => void;
};

const ReferModal: React.FC<ReferModalProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalReferrals: number; totalEarned: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && user?.uid) {
      loadReferralData();
    }
  }, [visible, user]);

  const loadReferralData = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      await referralService.processPendingReferralClaims(user.uid);
      const [code, referralStats] = await Promise.all([
        referralService.getReferralCode(user.uid),
        referralService.getReferralStats(user.uid),
      ]);
      setReferralCode(code);
      setStats(referralStats);
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!referralCode) return;

    try {
      await Share.share({
        message: buildReferralInviteMessage(referralCode),
        title: 'Join Pulse',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyCode = () => {
    if (!referralCode) return;
    Clipboard.setString(buildReferralInviteMessage(referralCode));
    Alert.alert('Copied!', 'Invite message copied - paste it into a text or DM.');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Refer Friends</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.content}>
              {/* Info Section */}
              <View style={styles.infoCard}>
                <Ionicons name="gift" size={32} color={Colors.primary} />
                <Text style={styles.infoTitle}>Earn {formatCurrency(REFERRAL_BONUS_REFERRER)} per referral!</Text>
                <Text style={styles.infoText}>
                  Share your code. New signups get {formatCurrency(REFERRAL_BONUS_NEW_USER)} bonus cash on top of their $10,000 starter balance.
                  You earn {formatCurrency(REFERRAL_BONUS_REFERRER)} for each friend who signs up with your code - credited automatically.
                </Text>
              </View>

              {/* Referral Code */}
              <View style={styles.codeSection}>
                <Text style={styles.codeLabel}>Your Referral Code</Text>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeText}>{referralCode || 'Loading...'}</Text>
                  <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
                    <Ionicons name="copy-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Stats */}
              {stats && (
                <View style={styles.statsCard}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.totalReferrals}</Text>
                    <Text style={styles.statLabel}>Total Referrals</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{formatCurrency(stats.totalEarned)}</Text>
                    <Text style={styles.statLabel}>Total Earned</Text>
                  </View>
                </View>
              )}

              {/* Share Button */}
              <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Ionicons name="share-social" size={20} color={Colors.white} />
                <Text style={styles.shareButtonText}>Share Referral Code</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default ReferModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    ...Shadows.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
  },
  loadingContainer: {
    padding: Spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.lg,
  },
  infoCard: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  infoText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  codeSection: {
    marginBottom: Spacing.lg,
  },
  codeLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  codeText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    letterSpacing: 2,
  },
  copyButton: {
    padding: Spacing.xs,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    ...Shadows.primary,
  },
  shareButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },
});






