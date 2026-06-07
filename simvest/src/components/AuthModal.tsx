import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, BorderRadius, Typography, Shadows, Glass } from '../constants/theme';

type AuthModalProps = {
  visible: boolean;
  onClose: () => void;
  mode: 'signin' | 'signup';
};

const SIGNUP_STEP_COUNT = 3;

function validateSignupStep(
  step: number,
  fields: { username: string; displayName: string; email: string; password: string }
): string | null {
  if (step === 0) {
    if (!fields.username.trim()) return 'Please enter a username';
    if (!fields.displayName.trim()) return 'Please enter your name';
    return null;
  }
  if (step === 1) {
    if (!fields.email.trim() || !fields.password.trim()) return 'Please enter both email and password';
    if (!fields.email.trim().includes('@')) return 'Please enter a valid email address';
    return null;
  }
  return null;
}

const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, mode }) => {
  const { login, signup } = useAuth();
  const isSignup = mode === 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupStep, setSignupStep] = useState(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const signupStepAnim = useRef(new Animated.Value(1)).current;
  const signupUsernameRef = useRef<TextInput>(null);
  const signupEmailRef = useRef<TextInput>(null);
  const signupReferralRef = useRef<TextInput>(null);

  const inputStyle = useCallback(
    (fieldKey: string) => [styles.input, focusedField === fieldKey && styles.inputFocused],
    [focusedField]
  );

  const runSignup = useCallback(
    async (referral: string | undefined) => {
      const err0 = validateSignupStep(0, { username, displayName, email, password });
      const err1 = validateSignupStep(1, { username, displayName, email, password });
      if (err0 || err1) {
        setError(err0 || err1);
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        await signup(email.trim(), password, username.trim(), displayName.trim(), referral);
        onClose();
      } catch (e: any) {
        setError(e?.message ?? 'Failed to create account');
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, displayName, username, signup, onClose]
  );

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    if (!email.trim().includes('@')) {
      setError('Please sign in with your email address');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await login(email.trim(), password);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to sign in');
    } finally {
      setSubmitting(false);
    }
  }, [email, password, login, onClose]);

  const goNextSignup = useCallback(() => {
    const err = validateSignupStep(signupStep, { username, displayName, email, password });
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSignupStep((s) => Math.min(s + 1, SIGNUP_STEP_COUNT - 1));
  }, [signupStep, username, displayName, email, password]);

  const goBackSignup = useCallback(() => {
    setError(null);
    setSignupStep((s) => Math.max(0, s - 1));
  }, []);

  useEffect(() => {
    if (!visible) {
      setEmail('');
      setPassword('');
      setUsername('');
      setDisplayName('');
      setReferralCode('');
      setError(null);
      setSignupStep(0);
      setFocusedField(null);
    } else if (mode === 'signup') {
      setSignupStep(0);
    }
  }, [visible, mode]);

  useEffect(() => {
    if (!isSignup) return;
    signupStepAnim.setValue(0.92);
    Animated.spring(signupStepAnim, {
      toValue: 1,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [signupStep, isSignup, signupStepAnim]);

  useEffect(() => {
    if (!visible || !isSignup) return;
    const t = setTimeout(() => {
      switch (signupStep) {
        case 0:
          signupUsernameRef.current?.focus();
          break;
        case 1:
          signupEmailRef.current?.focus();
          break;
        case 2:
          signupReferralRef.current?.focus();
          break;
        default:
          break;
      }
    }, Platform.OS === 'ios' ? 80 : 120);
    return () => clearTimeout(t);
  }, [signupStep, visible, isSignup]);

  const handleClose = useCallback(() => {
    setError(null);
    setEmail('');
    setPassword('');
    setUsername('');
    setDisplayName('');
    setReferralCode('');
    setSignupStep(0);
    setFocusedField(null);
    onClose();
  }, [onClose]);

  const renderSignupStepIndicator = () => (
    <View style={styles.stepDots}>
      {Array.from({ length: SIGNUP_STEP_COUNT }, (_, i) => (
        <View key={i} style={[styles.stepDot, i === signupStep && styles.stepDotActive]} />
      ))}
    </View>
  );

  const renderSignupBody = () => {
    switch (signupStep) {
      case 0:
        return (
          <>
            <Text style={styles.stepSubtitle}>Pick a public username and how you’d like to be named.</Text>
            <TextInput
              ref={signupUsernameRef}
              style={inputStyle('username')}
              placeholder="Username"
              placeholderTextColor={Colors.textDisabled}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField((f) => (f === 'username' ? null : f))}
            />
            <TextInput
              style={inputStyle('displayName')}
              placeholder="Full Name"
              placeholderTextColor={Colors.textDisabled}
              value={displayName}
              onChangeText={setDisplayName}
              onFocus={() => setFocusedField('displayName')}
              onBlur={() => setFocusedField((f) => (f === 'displayName' ? null : f))}
            />
          </>
        );
      case 1:
        return (
          <>
            <Text style={styles.stepSubtitle}>Use your email and a secure password to sign in later.</Text>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              ref={signupEmailRef}
              style={inputStyle('email')}
              placeholder=""
              placeholderTextColor={Colors.textDisabled}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField((f) => (f === 'email' ? null : f))}
            />
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={inputStyle('password')}
              placeholder=""
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField((f) => (f === 'password' ? null : f))}
            />
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.stepSubtitle}>
              Have a referral code? Enter it below - or leave it blank and tap Create account.
            </Text>
            <TextInput
              ref={signupReferralRef}
              style={inputStyle('referral')}
              placeholder="Referral code (optional)"
              placeholderTextColor={Colors.textDisabled}
              autoCapitalize="characters"
              autoCorrect={false}
              value={referralCode}
              onChangeText={setReferralCode}
              onFocus={() => setFocusedField('referral')}
              onBlur={() => setFocusedField((f) => (f === 'referral' ? null : f))}
            />
          </>
        );
      default:
        return null;
    }
  };

  const renderSignupActions = () => {
    if (signupStep === 0) {
      return (
        <View style={styles.signupStackedActions}>
          <TouchableOpacity
            style={[styles.button, styles.buttonStackedPrimary, submitting && styles.buttonDisabled]}
            onPress={goNextSignup}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (signupStep === 1) {
      return (
        <View style={styles.signupStackedActions}>
          <TouchableOpacity
            style={[styles.button, styles.buttonStackedPrimary, submitting && styles.buttonDisabled]}
            onPress={goNextSignup}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signupStackedBack}
            onPress={goBackSignup}
            disabled={submitting}
          >
            <Text style={styles.textButtonLabel}>Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.signupStackedActions}>
        <TouchableOpacity
          style={[styles.button, styles.buttonStackedPrimary, submitting && styles.buttonDisabled]}
          onPress={() => runSignup(referralCode.trim() || undefined)}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Creating account...' : 'Create account'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.signupStackedBack}
          onPress={goBackSignup}
          disabled={submitting}
        >
          <Text style={styles.textButtonLabel}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -44 : 0}
        style={styles.keyboardRoot}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={handleClose}
          />
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {isSignup ? 'Create Account' : 'Sign In'}
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {isSignup ? renderSignupStepIndicator() : null}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.form}>
                {!isSignup && (
                  <View style={styles.signinFields}>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Email</Text>
                      <TextInput
                        style={inputStyle('signinEmail')}
                        placeholder=""
                        placeholderTextColor={Colors.textDisabled}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => setFocusedField('signinEmail')}
                        onBlur={() => setFocusedField((f) => (f === 'signinEmail' ? null : f))}
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Password</Text>
                      <TextInput
                        style={inputStyle('signinPassword')}
                        placeholder=""
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="password"
                        textContentType="password"
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => setFocusedField('signinPassword')}
                        onBlur={() => setFocusedField((f) => (f === 'signinPassword' ? null : f))}
                      />
                    </View>

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <TouchableOpacity
                      style={[styles.button, submitting && styles.buttonDisabled]}
                      onPress={handleSubmit}
                      disabled={submitting}
                    >
                      <Text style={styles.buttonText}>
                        {submitting ? 'Signing in...' : 'Sign In'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isSignup && (
                  <Animated.View
                    style={{
                      opacity: signupStepAnim,
                      transform: [
                        {
                          translateY: signupStepAnim.interpolate({
                            inputRange: [0.92, 1],
                            outputRange: [10, 0],
                          }),
                        },
                      ],
                    }}
                  >
                    <View style={styles.signupStepColumn}>
                      <View style={styles.signupFieldsBlock}>{renderSignupBody()}</View>
                      {error ? <Text style={styles.error}>{error}</Text> : null}
                      {renderSignupActions()}
                    </View>
                  </Animated.View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default AuthModal;

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    width: '85%',
    maxWidth: 380,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: Glass.postBorder,
    overflow: 'hidden',
    ...Shadows.large,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
    width: 22,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: Spacing.lg,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
  },
  stepSubtitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  form: {
    gap: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  signinFields: {
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textTertiary,
    marginLeft: 2,
  },
  input: {
    height: 50,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Glass.postBorder,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    letterSpacing: 0,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  button: {
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    ...Shadows.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  signupStepColumn: {
    gap: Spacing.xxl,
  },
  signupFieldsBlock: {
    gap: Spacing.lg,
  },
  signupStackedActions: {
    width: '100%',
    alignItems: 'center',
    marginTop: 0,
    gap: Spacing.md,
  },
  buttonStackedPrimary: {
    alignSelf: 'stretch',
    marginTop: 0,
  },
  signupStackedBack: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  textButtonLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  error: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    fontWeight: Typography.fontWeight.normal,
    paddingHorizontal: Spacing.sm,
    lineHeight: 20,
  },
});
