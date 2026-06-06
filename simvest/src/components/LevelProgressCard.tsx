import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassSurface from './GlassSurface';
import { Colors, Spacing, BorderRadius, Typography, Glass } from '../constants/theme';
import {
  gamificationService,
  XP_HELP_ALERT_TITLE,
  getXPHelpMessage,
} from '../services/gamificationService';

interface LevelProgressCardProps {
  xp: number;
  level: number;
  streak?: number;
}

const LevelProgressCard: React.FC<LevelProgressCardProps> = ({ xp, level, streak = 0 }) => {
  const progress = gamificationService.getXPProgress(xp, level);
  const levelTitle = gamificationService.getLevelTitle(level);
  const nextLevelXP = gamificationService.getXPForNextLevel(level);

  const showXpHelp = useCallback(() => {
    Alert.alert(XP_HELP_ALERT_TITLE, getXPHelpMessage());
  }, []);

  return (
    <GlassSurface
      style={styles.card}
      borderRadius={BorderRadius.xxxl}
      variant="subtle"
      glow="mixed"
    >
      <View style={styles.cardInner}>
      <View style={styles.header}>
        <View style={styles.levelBadge}>
          <Ionicons name="trophy" size={18} color={Colors.primary} />
          <Text style={styles.levelText}>Level {level}</Text>
        </View>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={16} color={Colors.warning} />
            <Text style={styles.streakText}>{streak} day{streak !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{levelTitle}</Text>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress.percentage}%` }]} />
        </View>
        <View style={styles.progressTextRow}>
          <Text style={styles.progressText}>
            {progress.current.toFixed(0)} / {progress.needed} XP
          </Text>
          {nextLevelXP > 0 && (
            <Text style={styles.nextLevelText}>
              {nextLevelXP - xp} XP to Level {level + 1}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.xpRow}>
        <View style={styles.xpStat}>
          <Ionicons name="star" size={16} color={Colors.primary} />
          <Text style={styles.xpValue}>{xp.toLocaleString()}</Text>
          <Text style={styles.xpLabel}>Total XP</Text>
          <TouchableOpacity
            onPress={showXpHelp}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="How XP works"
            accessibilityRole="button"
          >
            <Ionicons name="information-circle-outline" size={17} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  cardInner: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    backgroundColor: Glass.primaryTint,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  levelText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  streakText: {
    color: Colors.warning,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
  },
  progressContainer: {
    marginBottom: Spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.border,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  nextLevelText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
  xpRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  xpStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  xpValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  xpLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
});

export default LevelProgressCard;
