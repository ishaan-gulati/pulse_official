import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  Platform,
  Keyboard,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { tradingService } from '../services/tradingService';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';

type TradeModalProps = {
  visible: boolean;
  onClose: () => void;
  onTradeComplete?: () => void;
  symbol?: string; // Pre-fill symbol if provided
  action?: 'buy' | 'sell'; // Pre-fill action if provided
};

/** Pulls the sheet slightly closer to the keyboard (inset from OS is often a bit generous). */
const KEYBOARD_GAP_TRIM = Spacing.lg + Spacing.xs;

const TradeModal: React.FC<TradeModalProps> = ({
  visible,
  onClose,
  onTradeComplete,
  symbol: initialSymbol,
  action: initialAction,
}) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [action, setAction] = useState<'buy' | 'sell'>(initialAction || 'buy');
  const [symbol, setSymbol] = useState(initialSymbol || '');
  const [shares, setShares] = useState('');
  const [dollarAmount, setDollarAmount] = useState('');
  const [inputMode, setInputMode] = useState<'shares' | 'dollar'>('shares');
  const [availableCash, setAvailableCash] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [popularStocks, setPopularStocks] = useState<Array<{ symbol: string; name: string; price: number }>>([]);
  /** Lifts the whole column above the keyboard; KAV inside Modal is unreliable on iOS. */
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);

  // Update symbol and action when modal opens or props change
  useEffect(() => {
    if (visible) {
      if (initialSymbol) {
        setSymbol(initialSymbol);
      } else {
        setSymbol(''); // Clear symbol if no initialSymbol
      }
      if (initialAction) {
        setAction(initialAction);
      }
    } else {
      // Reset when modal closes
      setSymbol('');
      setCurrentPosition(null);
      setCurrentPrice(0);
    }
  }, [visible, initialSymbol, initialAction]);

  // Fetch base data when modal opens (cash, popular stocks)
  useEffect(() => {
    if (visible && user?.uid) {
      const loadBaseData = async () => {
        try {
          const [cash, stocks] = await Promise.all([
            tradingService.getAvailableCash(user.uid),
            tradingService.getPopularStocks(),
          ]);
          setAvailableCash(cash);
          setPopularStocks(stocks);
        } catch (error) {
          console.error('Error loading base trade data:', error);
        }
      };
      loadBaseData();
    }
  }, [visible, user?.uid]);

  // Load price and position when symbol or action changes (but modal is already open)
  // Debounce to avoid loading on every keystroke
  useEffect(() => {
    if (!visible || !user?.uid) return;
    
    // Only load if symbol is at least 1 character (avoid loading on empty/partial symbols)
    if (!symbol || symbol.length < 1) {
      setCurrentPosition(null);
      setCurrentPrice(0);
      return;
    }

    // Debounce: wait 300ms after user stops typing
    const timeoutId = setTimeout(async () => {
      try {
        const price = await tradingService.getCurrentPrice(symbol);
        setCurrentPrice(price ?? 0);

        if (action === 'sell') {
          const position = await tradingService.getPosition(user.uid, symbol);
          console.log(`Loading position for ${symbol}:`, position);
          // Only set position if we got a valid result (not null)
          if (position) {
            setCurrentPosition(position.shares);
          } else {
            setCurrentPosition(0);
          }
        } else {
          setCurrentPosition(null);
        }
      } catch (error) {
        console.error('Error loading symbol data:', error);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [visible, symbol, action, user?.uid]);

  useEffect(() => {
    if (!visible) {
      Keyboard.dismiss();
      setKeyboardBottomInset(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => {
      setKeyboardBottomInset(e.endCoordinates?.height ?? 0);
    };
    const onHide = () => setKeyboardBottomInset(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [visible]);

  // loadData is no longer needed - split into separate useEffects above

  const handleSymbolSelect = async (selectedSymbol: string) => {
    setSymbol(selectedSymbol);
    const price = await tradingService.getCurrentPrice(selectedSymbol);
    setCurrentPrice(price ?? 0);

    if (action === 'sell' && user?.uid) {
      const position = await tradingService.getPosition(user.uid, selectedSymbol);
      setCurrentPosition(position?.shares || 0);
    }
  };

  const handleActionChange = async (newAction: 'buy' | 'sell') => {
    setAction(newAction);
    setShares('');
    setDollarAmount('');
    if (symbol && user?.uid) {
      const price = await tradingService.getCurrentPrice(symbol);
      setCurrentPrice(price ?? 0);

      if (newAction === 'sell') {
        const position = await tradingService.getPosition(user.uid, symbol);
        setCurrentPosition(position?.shares || 0);
      } else {
        setCurrentPosition(null);
      }
    }
  };

  const handleSharesChange = (value: string) => {
    // Allow numbers and decimal point (for fractional shares)
    const numericValue = value.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = numericValue.split('.');
    const formattedValue = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : numericValue;
    setShares(formattedValue);
    // Clear dollar amount when shares change
    setDollarAmount('');
  };

  const handleDollarAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = numericValue.split('.');
    const formattedValue = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : numericValue;
    setDollarAmount(formattedValue);
    // Calculate exact fractional shares from dollar amount
    if (currentPrice > 0 && formattedValue) {
      const dollarNum = parseFloat(formattedValue) || 0;
      if (dollarNum > 0) {
        // Exact calculation: shares = dollarAmount / price (fractional shares allowed)
        const calculatedShares = dollarNum / currentPrice;
        setShares(calculatedShares.toString());
      } else {
        setShares('');
      }
    } else {
      setShares('');
    }
  };

  const calculateTotal = (): number => {
    if (inputMode === 'dollar' && dollarAmount) {
      // For dollar mode, the dollarAmount is what you want to spend on stock
      const dollarNum = parseFloat(dollarAmount) || 0;
      return dollarNum;
    }
    const sharesNum = parseFloat(shares) || 0;
    return sharesNum * currentPrice; // No trading fee
  };

  const handleSubmit = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to trade');
      return;
    }

    if (!symbol.trim()) {
      Alert.alert('Error', 'Please enter a stock symbol');
      return;
    }

    const sharesNum = parseFloat(shares);
    if (!sharesNum || sharesNum <= 0 || isNaN(sharesNum)) {
      Alert.alert('Error', 'Please enter a valid number of shares');
      return;
    }

    if (action === 'sell' && currentPosition !== null && sharesNum > currentPosition) {
      Alert.alert('Error', `You only own ${currentPosition} shares`);
      return;
    }

    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const result = action === 'buy'
        ? await tradingService.buyStock(user.uid, symbol, sharesNum)
        : await tradingService.sellStock(user.uid, symbol, sharesNum);

      if (result.success) {
        handleClose();
        setTimeout(() => {
          onTradeComplete?.();
        }, 100);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to execute trade');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSymbol(initialSymbol || '');
    setShares('');
    setDollarAmount('');
    setInputMode('shares');
    setAction(initialAction || 'buy');
    setCurrentPrice(0);
    setCurrentPosition(null);
    onClose();
  };

  const sharesNum = parseFloat(shares) || 0;
  const total = calculateTotal();
  const canAfford = action === 'buy' ? total <= availableCash : true;
  const canSell = action === 'sell' ? (currentPosition !== null && sharesNum <= currentPosition) : true;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View
          style={[
            styles.keyboardView,
            {
              paddingBottom: Math.max(0, keyboardBottomInset - KEYBOARD_GAP_TRIM),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Place Trade</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Action Toggle */}
            <View style={styles.actionToggle}>
              <TouchableOpacity
                style={[styles.actionBtn, action === 'buy' && styles.actionBtnActive]}
                onPress={() => handleActionChange('buy')}
              >
                <Text style={[styles.actionBtnText, action === 'buy' && styles.actionBtnTextActive]}>
                  Buy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, action === 'sell' && styles.actionBtnActive]}
                onPress={() => handleActionChange('sell')}
              >
                <Text style={[styles.actionBtnText, action === 'sell' && styles.actionBtnTextActive]}>
                  Sell
                </Text>
              </TouchableOpacity>
            </View>

            {/* Symbol Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Stock Symbol</Text>
              <TextInput
                style={[styles.input, initialSymbol && styles.inputDisabled]}
                placeholder="e.g., AAPL, MSFT, TSLA"
                placeholderTextColor={Colors.textDisabled}
                value={symbol}
                onChangeText={async (text) => {
                  setSymbol(text.toUpperCase());
                  if (text) {
                    const price = await tradingService.getCurrentPrice(text);
                    setCurrentPrice(price ?? 0);
                    if (action === 'sell' && user?.uid) {
                      const position = await tradingService.getPosition(user.uid, text);
                      setCurrentPosition(position?.shares || 0);
                    }
                  }
                }}
                autoCapitalize="characters"
                editable={!submitting && !initialSymbol}
              />
              {symbol && currentPrice > 0 && (
                <Text style={styles.priceText}>
                  Current Price: {formatCurrency(currentPrice)}
                </Text>
              )}
            </View>

            {/* Popular Stocks */}
            {!symbol && (
              <View style={styles.popularSection}>
                <Text style={styles.sectionTitle}>Popular Stocks</Text>
                <View style={styles.popularGrid}>
                  {popularStocks.slice(0, 6).map((stock) => (
                    <TouchableOpacity
                      key={stock.symbol}
                      style={styles.popularStock}
                      onPress={() => handleSymbolSelect(stock.symbol)}
                    >
                      <Text style={styles.popularSymbol}>{stock.symbol}</Text>
                      <Text style={styles.popularName} numberOfLines={1}>{stock.name}</Text>
                      <Text style={styles.popularPrice}>{formatCurrency(stock.price)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Shares/Dollar Amount Input */}
            <View style={styles.inputSection}>
              <View style={styles.sharesHeader}>
                <Text style={styles.inputLabel}>
                  {inputMode === 'shares' ? 'Shares' : 'Dollar Amount'}
                </Text>
                <View style={styles.inputModeToggle}>
                  <TouchableOpacity
                    style={[styles.inputModeBtn, inputMode === 'shares' && styles.inputModeBtnActive]}
                    onPress={() => {
                      setInputMode('shares');
                      setDollarAmount('');
                    }}
                  >
                    <Text style={[styles.inputModeBtnText, inputMode === 'shares' && styles.inputModeBtnTextActive]}>
                      Shares
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.inputModeBtn, inputMode === 'dollar' && styles.inputModeBtnActive]}
                    onPress={() => {
                      setInputMode('dollar');
                      setShares('');
                    }}
                  >
                    <Text style={[styles.inputModeBtnText, inputMode === 'dollar' && styles.inputModeBtnTextActive]}>
                      $
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {inputMode === 'shares' ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter number of shares"
                    placeholderTextColor={Colors.textDisabled}
                    value={shares}
                    onChangeText={handleSharesChange}
                    keyboardType="decimal-pad"
                    editable={!submitting}
                  />
                  {action === 'sell' && currentPosition !== null && (
                    <Text style={styles.availableText}>
                      Available: {currentPosition} shares
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter dollar amount"
                    placeholderTextColor={Colors.textDisabled}
                    value={dollarAmount}
                    onChangeText={handleDollarAmountChange}
                    keyboardType="decimal-pad"
                    editable={!submitting}
                  />
                  {shares && currentPrice > 0 && (
                    <Text style={styles.availableText}>
                      {parseFloat(shares).toFixed(4)} shares at {formatCurrency(currentPrice)}
                    </Text>
                  )}
                </>
              )}
            </View>

            {/* Trade Summary */}
            {sharesNum > 0 && symbol && currentPrice > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Trade Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Shares</Text>
                  <Text style={styles.summaryValue}>{sharesNum.toFixed(4)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Price per Share</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(currentPrice)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>Total</Text>
                  <Text style={styles.summaryTotalValue}>{formatCurrency(total)}</Text>
                </View>
                {action === 'buy' && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Available Cash</Text>
                    <Text style={[styles.summaryValue, !canAfford && { color: Colors.error }]}>
                      {formatCurrency(availableCash)}
                    </Text>
                  </View>
                )}
                {!canAfford && (
                  <Text style={styles.errorText}>Insufficient funds</Text>
                )}
                {action === 'sell' && !canSell && (
                  <Text style={styles.errorText}>Not enough shares</Text>
                )}
              </View>
            )}
          </ScrollView>

          <View
            style={[
              styles.submitFooter,
              {
                paddingBottom:
                  keyboardBottomInset > 0
                    ? Spacing.sm
                    : Math.max(insets.bottom, Spacing.md) + Spacing.sm,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!canAfford || !canSell || !sharesNum || !symbol || submitting) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canAfford || !canSell || !sharesNum || !symbol || submitting}
            >
              <Text style={styles.submitText}>
                {action === 'buy' ? 'Buy' : 'Sell'} {sharesNum > 0 ? `${sharesNum.toFixed(2)} shares` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default TradeModal;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancelText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  submitFooter: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  actionToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: Colors.primary,
  },
  actionBtnText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  actionBtnTextActive: {
    color: Colors.white,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: Colors.background,
  },
  priceText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
  },
  sharesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availableText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: Spacing.xs,
  },
  inputModeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    padding: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputModeBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  inputModeBtnActive: {
    backgroundColor: Colors.primary,
  },
  inputModeBtnText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  inputModeBtnTextActive: {
    color: Colors.white,
  },
  popularSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  popularStock: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    width: '31%',
    minHeight: 100,
    ...Shadows.small,
  },
  popularSymbol: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing.xs,
  },
  popularName: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    marginBottom: Spacing.xs,
  },
  popularPrice: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  summaryCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  summaryTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
  },
  summaryValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  summaryTotalLabel: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  summaryTotalValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.primary,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },
});



