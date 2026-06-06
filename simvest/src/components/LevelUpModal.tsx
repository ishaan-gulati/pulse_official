import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { gamificationService } from '../services/gamificationService';

type LevelUpModalProps = {
  visible: boolean;
  newLevel: number;
  onClose: () => void;
};

const LevelUpModal: React.FC<LevelUpModalProps> = ({ visible, newLevel, onClose }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      rotateAnim.setValue(0);

      // Scale and fade in animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(rotateAnim, {
              toValue: 1,
              duration: 2000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(rotateAnim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();

      // Auto close after 3 seconds
      const timer = setTimeout(() => {
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.ease,
          useNativeDriver: true,
        }).start(() => onClose());
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const levelTitle = gamificationService.getLevelTitle(newLevel);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }, { rotate }],
              opacity: opacityAnim,
            },
          ]}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="trophy" size={64} color={Colors.primary} />
          </View>
          <Text style={styles.levelUpText}>LEVEL UP!</Text>
          <Text style={styles.levelText}>Level {newLevel}</Text>
          <Text style={styles.titleText}>{levelTitle}</Text>
          <View style={styles.confetti}>
            <Text style={styles.confettiText}>🎉</Text>
            <Text style={styles.confettiText}>✨</Text>
            <Text style={styles.confettiText}>🚀</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  card: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.large,
    shadowColor: Colors.primary,
    minWidth: 280,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  levelUpText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  levelText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  titleText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.md,
  },
  confetti: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  confettiText: {
    fontSize: 32,
  },
});

export default LevelUpModal;


