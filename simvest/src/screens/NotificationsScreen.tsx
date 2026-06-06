import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Pressable,
  InputAccessoryView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { priceAlertsService } from '../services/priceAlertsService';
import { PriceAlert } from '../types';

type NotificationsScreenProps = {
  onBack?: () => void;
  /** Incremented in App after a price-alert poll so this screen refreshes while open */
  alertSyncKey?: number;
  /** Refresh home bell badge after user acknowledges an executed alert */
  onAcknowledgedExecutedAlert?: () => void;
};

function formatExecutedAt(ts: any): string {
  if (!ts) return '';
  const ms = ts?.toMillis ? ts.toMillis() : typeof ts === 'number' ? ts : 0;
  const d = new Date(ms);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function isUnreadExecuted(a: PriceAlert): boolean {
  return !!(a.executedAt && a.executedPrice != null && !a.seenAt);
}

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
  alertSyncKey = 0,
  onAcknowledgedExecutedAlert,
}) => {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const insets = useSafeAreaInsets();

  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Add alert form
  const [symbol, setSymbol] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [adding, setAdding] = useState(false);
  const priceInputRef = useRef<TextInput>(null);
  const PRICE_INPUT_ACCESSORY_ID = 'priceAlertTargetIOS';

  useEffect(() => {
    if (!addModalVisible) Keyboard.dismiss();
  }, [addModalVisible]);

  const loadAlerts = useCallback(async () => {
    if (!uid) return;
    try {
      const data = await priceAlertsService.getPriceAlerts(uid);
      setAlerts(data);
    } catch (e) {
      console.error('Load price alerts error:', e);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    if (alertSyncKey > 0 && uid) loadAlerts();
  }, [alertSyncKey, uid, loadAlerts]);

  const activeAlerts = alerts.filter((a) => !a.executedAt);
  const executedAlerts = alerts.filter((a) => a.executedAt && a.executedPrice != null).reverse();

  const handleExecutedRowPress = (alert: PriceAlert) => {
    if (!uid || !isUnreadExecuted(alert)) return;
    Alert.alert(
      'Price alert executed',
      `${alert.symbol} hit $${alert.executedPrice!.toFixed(2)} (your target was ${alert.condition === 'above' ? '≥' : '≤'} $${alert.targetPrice.toFixed(2)}).`,
      [
        {
          text: 'OK',
          onPress: async () => {
            try {
              await priceAlertsService.markAlertSeen(uid, alert.id);
              loadAlerts();
              onAcknowledgedExecutedAlert?.();
            } catch (e) {
              console.error('markAlertSeen', e);
            }
          },
        },
      ]
    );
  };

  const handleAddAlert = async () => {
    const sym = symbol.trim().toUpperCase();
    const price = parseFloat(targetPrice);
    if (!sym) {
      Alert.alert('Missing symbol', 'Enter a stock symbol (e.g. AAPL).');
      return;
    }
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid price', 'Enter a valid target price.');
      return;
    }
    if (!uid) return;
    setAdding(true);
    try {
      await priceAlertsService.addPriceAlert(uid, {
        symbol: sym,
        targetPrice: price,
        condition,
      });
      setSymbol('');
      setTargetPrice('');
      setCondition('above');
      setAddModalVisible(false);
      await loadAlerts();
    } catch (e) {
      console.error('Add price alert error:', e);
      Alert.alert('Error', 'Could not add alert. Try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteAlert = (alert: PriceAlert) => {
    Alert.alert('Remove alert', `Remove ${alert.symbol} ${alert.condition} $${alert.targetPrice}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (!uid) return;
          await priceAlertsService.deletePriceAlert(uid, alert.id);
          loadAlerts();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={styles.headerTitle}>Alerts</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Price alerts */}
        <Text style={styles.sectionTitle}>Price alerts</Text>
        <View style={styles.sectionCard}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : activeAlerts.length === 0 && executedAlerts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="pricetag-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No price alerts yet</Text>
              <Text style={styles.emptySubtext}>
                Get notified when a stock hits your target. Add your first alert below.
              </Text>
              <TouchableOpacity
                style={styles.addButtonPrimary}
                onPress={() => setAddModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={20} color={Colors.white} />
                <Text style={styles.addButtonPrimaryText}>Add price alert</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Active alerts */}
              {activeAlerts.length > 0 && (
                <>
                  <Text style={styles.subsectionLabel}>Active</Text>
                  {activeAlerts.map((alert) => (
                    <View key={alert.id} style={styles.alertCard}>
                      <View style={styles.alertCardIcon}>
                        <Ionicons name="trending-up" size={20} color={Colors.primary} />
                      </View>
                      <View style={styles.alertCardContent}>
                        <Text style={styles.alertSymbol}>{alert.symbol}</Text>
                        <Text style={styles.alertTarget}>
                          Notify when {alert.condition === 'above' ? '≥' : '≤'} ${alert.targetPrice.toFixed(2)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteAlert(alert)}
                        hitSlop={12}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={20} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* Executed alerts */}
              {executedAlerts.length > 0 && (
                <>
                  <Text style={[styles.subsectionLabel, styles.subsectionLabelExecuted]}>Alerts executed</Text>
                  {executedAlerts.map((alert) => {
                    const unread = isUnreadExecuted(alert);
                    return (
                      <TouchableOpacity
                        key={alert.id}
                        style={[styles.executedCard, unread && styles.executedCardUnread]}
                        onPress={() => handleExecutedRowPress(alert)}
                        activeOpacity={unread ? 0.7 : 1}
                        disabled={!unread}
                      >
                        <View style={styles.executedIconWrap}>
                          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                        </View>
                        <View style={styles.executedContent}>
                          <View style={styles.executedTitleRow}>
                            <Text style={styles.executedSymbol}>{alert.symbol}</Text>
                            {unread ? (
                              <View style={styles.unreadDot} />
                            ) : (
                              <Text style={styles.executedAckLabel}>Seen</Text>
                            )}
                          </View>
                          <Text style={styles.executedDetail}>
                            Hit ${alert.executedPrice!.toFixed(2)} (target {alert.condition === 'above' ? '≥' : '≤'} ${alert.targetPrice.toFixed(2)})
                          </Text>
                          <Text style={styles.executedTime}>{formatExecutedAt(alert.executedAt)}</Text>
                          {unread && (
                            <Text style={styles.tapToDismissHint}>Tap to acknowledge</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setAddModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                <Text style={styles.addButtonText}>Add price alert</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Push notifications</Text>
        <View style={styles.sectionCard}>
          <View style={styles.pushComingSoonBlock}>
            <Ionicons name="notifications-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.pushComingSoonTitle}>Coming soon</Text>
            <Text style={styles.pushComingSoonSubtext}>
              Push alerts and other notification types will show up here. Price alerts above work in the app today.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Add alert modal - KeyboardAvoidingView + Done bar so decimal keyboard can’t trap users */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!adding) {
            Keyboard.dismiss();
            setAddModalVisible(false);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardRoot}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : Math.max(insets.bottom, 12)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                Keyboard.dismiss();
                if (!adding) setAddModalVisible(false);
              }}
              accessibilityLabel="Close"
            />
            <View style={styles.modalCard}>
              {Platform.OS === 'ios' && (
                <InputAccessoryView nativeID={PRICE_INPUT_ACCESSORY_ID}>
                  <View style={styles.inputAccessory}>
                    <TouchableOpacity onPress={Keyboard.dismiss} hitSlop={12}>
                      <Text style={styles.inputAccessoryDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </InputAccessoryView>
              )}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Text style={styles.modalTitle}>Add price alert</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Symbol (e.g. AAPL)"
                  placeholderTextColor={Colors.textTertiary}
                  value={symbol}
                  onChangeText={setSymbol}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => priceInputRef.current?.focus()}
                />
                <TextInput
                  ref={priceInputRef}
                  style={styles.input}
                  placeholder="Target price"
                  placeholderTextColor={Colors.textTertiary}
                  value={targetPrice}
                  onChangeText={setTargetPrice}
                  keyboardType="decimal-pad"
                  inputAccessoryViewID={Platform.OS === 'ios' ? PRICE_INPUT_ACCESSORY_ID : undefined}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                    handleAddAlert();
                  }}
                />
                <TouchableOpacity
                  style={styles.keyboardDismissRow}
                  onPress={() => Keyboard.dismiss()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.keyboardDismissText}>Done typing - hide keyboard</Text>
                </TouchableOpacity>
                <View style={styles.conditionRow}>
                  <TouchableOpacity
                    style={[styles.conditionBtn, condition === 'above' && styles.conditionBtnActive]}
                    onPress={() => setCondition('above')}
                  >
                    <Text style={[styles.conditionBtnText, condition === 'above' && styles.conditionBtnTextActive]}>
                      When above
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.conditionBtn, condition === 'below' && styles.conditionBtnActive]}
                    onPress={() => setCondition('below')}
                  >
                    <Text style={[styles.conditionBtnText, condition === 'below' && styles.conditionBtnTextActive]}>
                      When below
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancel}
                    onPress={() => {
                      Keyboard.dismiss();
                      setAddModalVisible(false);
                    }}
                    disabled={adding}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalAdd}
                    onPress={() => {
                      Keyboard.dismiss();
                      handleAddAlert();
                    }}
                    disabled={adding}
                  >
                    {adding ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={styles.modalAddText}>Add alert</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
  },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  sectionTitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  sectionCard: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  subsectionLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  subsectionLabelExecuted: { marginTop: Spacing.lg },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alertCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  alertCardContent: { flex: 1 },
  alertSymbol: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  alertTarget: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  deleteBtn: { padding: Spacing.sm },
  executedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.9,
  },
  executedCardUnread: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  executedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  executedAckLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  tapToDismissHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    marginTop: 6,
  },
  executedIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.success + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  executedContent: { flex: 1 },
  executedSymbol: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  executedDetail: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  executedTime: {
    color: Colors.textDisabled,
    fontSize: Typography.fontSize.xs,
    marginTop: 4,
  },
  loadingWrap: { paddingVertical: Spacing.xl, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyIconWrap: { marginBottom: Spacing.md },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  addButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    ...Shadows.small,
  },
  addButtonPrimaryText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  addButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  pushComingSoonBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  pushComingSoonTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  pushComingSoonSubtext: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.sm,
  },
  modalKeyboardRoot: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    flexGrow: 0,
    backgroundColor: Colors.backgroundTertiary,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '88%',
  },
  keyboardDismissRow: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  keyboardDismissText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  inputAccessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  inputAccessoryDone: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  conditionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  conditionBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  conditionBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '20' },
  conditionBtnText: { color: Colors.textTertiary, fontSize: Typography.fontSize.sm },
  conditionBtnTextActive: { color: Colors.primary, fontWeight: Typography.fontWeight.semibold },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
  modalCancel: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  modalCancelText: { color: Colors.textPrimary },
  modalAdd: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  modalAddText: { color: Colors.white, fontWeight: Typography.fontWeight.semibold },
});
