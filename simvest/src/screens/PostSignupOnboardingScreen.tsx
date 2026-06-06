import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { STARTING_VIBE_OPTIONS, type StartingVibeId } from '../constants/onboarding';

const SLIDE_COUNT = 4;

const FEATURE_SLIDES: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}[] = [
  {
    icon: 'trending-up',
    title: 'Paper trading, real skills',
    body: 'Practice with $10,000 in simulated cash. No real money - learn how markets move without the stress.',
  },
  {
    icon: 'trophy',
    title: 'Climb the leaderboard',
    body: 'Compete with friends and the community. Rankings update from your saved portfolio as you trade.',
  },
  {
    icon: 'pie-chart',
    title: 'Track your portfolio',
    body: 'Watch positions, P/L, and streaks. Level up and unlock achievements as you get sharper.',
  },
  {
    icon: 'people-outline',
    title: 'Share the pulse',
    body: 'Post ideas, tag tickers, and see how the crowd moves - all in one feed built for traders.',
  },
];

type PostSignupOnboardingScreenProps = {
  onFinished: () => void;
};

const PostSignupOnboardingScreen: React.FC<PostSignupOnboardingScreenProps> = ({ onFinished }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  /** 0..3 = slides, 4 = vibe, 5 = finale */
  const [step, setStep] = useState(0);
  const [selectedVibe, setSelectedVibe] = useState<StartingVibeId | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentY = useRef(new Animated.Value(0)).current;
  const progressFill = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  const totalSteps = SLIDE_COUNT + 2;

  const animateStepChange = useCallback(
    (next: () => void) => {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(contentY, {
          toValue: 12,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => {
        next();
        contentY.setValue(-10);
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.spring(contentY, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [contentOpacity, contentY]
  );

  const goNext = () => {
    if (step < SLIDE_COUNT - 1) {
      animateStepChange(() => setStep((s) => s + 1));
      return;
    }
    if (step === SLIDE_COUNT - 1) {
      animateStepChange(() => setStep(SLIDE_COUNT));
      return;
    }
    if (step === SLIDE_COUNT) {
      if (!selectedVibe) {
        setError('Pick a vibe to continue');
        return;
      }
      setError(null);
      animateStepChange(() => setStep(SLIDE_COUNT + 1));
    }
  };

  const goBack = () => {
    if (step <= 0) return;
    setError(null);
    animateStepChange(() => setStep((s) => s - 1));
  };

  useEffect(() => {
    if (step !== SLIDE_COUNT + 1 || trackWidth <= 0) return;
    progressFill.setValue(0);
    Animated.timing(progressFill, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [step, trackWidth, progressFill]);

  const handleEnterApp = async () => {
    if (!user?.uid || !selectedVibe) {
      setError('Something went wrong. Please try again.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await userService.updateUserProfile(user.uid, {
        onboardingCompleted: true,
        startingVibe: selectedVibe,
      });
      onFinished();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const iconPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(iconPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [iconPulse]);

  const renderSlide = (index: number) => {
    const s = FEATURE_SLIDES[index];
    return (
      <>
        <Animated.View style={{ transform: [{ scale: iconPulse }] }}>
          <View style={styles.iconRing}>
            <Ionicons name={s.icon} size={44} color={Colors.primary} />
          </View>
        </Animated.View>
        <Text style={styles.slideTitle}>{s.title}</Text>
        <Text style={styles.slideBody}>{s.body}</Text>
      </>
    );
  };

  const renderVibe = () => (
    <>
      <Text style={styles.slideTitle}>Pick your starting vibe</Text>
      <Text style={styles.slideBody}>This is your style - we won’t place trades for you. You can change your mind anytime.</Text>
      <View style={styles.vibeList}>
        {STARTING_VIBE_OPTIONS.map((opt) => {
          const selected = selectedVibe === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.vibeCard, selected && styles.vibeCardSelected]}
              onPress={() => {
                setSelectedVibe(opt.id);
                setError(null);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.vibeCardIcon}>
                <Ionicons name={opt.icon} size={26} color={selected ? Colors.primary : Colors.textTertiary} />
              </View>
              <View style={styles.vibeCardText}>
                <Text style={styles.vibeCardTitle}>{opt.title}</Text>
                <Text style={styles.vibeCardDesc}>{opt.description}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  const renderFinale = () => {
    const fillWidth = progressFill.interpolate({
      inputRange: [0, 1],
      outputRange: [0, Math.max(0, trackWidth)],
    });

    return (
      <>
        <View style={styles.finaleIconWrap}>
          <Ionicons name="sparkles" size={48} color={Colors.trophy} />
        </View>
        <Text style={styles.slideTitle}>Your journey starts now</Text>
        <Text style={styles.slideBody}>You’re set with $10,000 paper cash. Tap below when you’re ready to jump in.</Text>
        <View
          style={styles.progressTrack}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View style={[styles.progressFill, { width: fillWidth }]} />
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
          onPress={handleEnterApp}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Enter Pulse</Text>
          )}
        </TouchableOpacity>
      </>
    );
  };

  const renderBody = () => {
    if (step < SLIDE_COUNT) return renderSlide(step);
    if (step === SLIDE_COUNT) return renderVibe();
    return renderFinale();
  };

  const showBack = step > 0 && step <= SLIDE_COUNT;

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
      <View style={styles.topBar}>
        <Text style={styles.brand} numberOfLines={1} includeFontPadding={false}>
          Welcome to Pulse
        </Text>
        <Text style={styles.stepLabel} includeFontPadding={false}>
          {step < totalSteps ? `Step ${step + 1} of ${totalSteps}` : ''}
        </Text>
      </View>

      <View style={styles.dotsRow}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          step === SLIDE_COUNT ? styles.scrollContentTop : styles.scrollContentCentered,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: contentY }],
          }}
        >
          {renderBody()}
        </Animated.View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {step <= SLIDE_COUNT ? (
        <View style={styles.footerRow}>
          {showBack ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={goBack}>
              <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.footerSpacer} />
          )}
          {step < SLIDE_COUNT + 1 ? (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                styles.footerNext,
                step === SLIDE_COUNT && !selectedVibe && styles.primaryBtnDisabled,
              ]}
              onPress={goNext}
              disabled={step === SLIDE_COUNT && !selectedVibe}
            >
              <Text style={styles.primaryBtnText}>{step === SLIDE_COUNT ? 'Continue' : 'Next'}</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

export default PostSignupOnboardingScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.md,
    minHeight: 22,
  },
  brand: {
    flex: 1,
    flexShrink: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 0.3,
    lineHeight: 22,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  stepLabel: {
    flexShrink: 0,
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    lineHeight: 22,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
    // Extra bottom inset shifts the centered block slightly upward vs true vertical center.
    paddingBottom: Spacing.xxxl + Spacing.xxl + Spacing.lg,
  },
  scrollContentTop: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: Spacing.xl + Spacing.md,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.medium,
  },
  slideTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.extrabold,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 32,
  },
  slideBody: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  vibeList: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  vibeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    gap: Spacing.md,
  },
  vibeCardSelected: {
    borderColor: 'rgba(139, 92, 246, 0.55)',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  vibeCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vibeCardText: {
    flex: 1,
  },
  vibeCardTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 4,
  },
  vibeCardDesc: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
  },
  finaleIconWrap: {
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  footerSpacer: {
    width: 80,
  },
  footerNext: {
    flex: 1,
    flexDirection: 'row',
  },
  primaryBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    ...Shadows.primary,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  secondaryBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    minWidth: 80,
  },
  secondaryBtnText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  error: {
    color: Colors.error,
    textAlign: 'center',
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.sm,
  },
});
