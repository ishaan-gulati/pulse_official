import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { Achievement } from '../services/gamificationService';

interface AchievementBadgeProps {
  achievement: Achievement;
  unlocked: boolean;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  achievement,
  unlocked,
  onPress,
  size = 'medium',
}) => {
  const sizeStyles = {
    small: { container: 60, icon: 24, fontSize: Typography.fontSize.xs },
    medium: { container: 80, icon: 32, fontSize: Typography.fontSize.sm },
    large: { container: 100, icon: 40, fontSize: Typography.fontSize.md },
  };

  const currentSize = sizeStyles[size];

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[
        styles.badge,
        {
          width: currentSize.container,
          height: currentSize.container,
          opacity: unlocked ? 1 : 0.4,
        },
        !unlocked && styles.locked,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconContainer,
          {
            width: currentSize.container * 0.7,
            height: currentSize.container * 0.7,
          },
          unlocked && styles.unlockedIcon,
        ]}
      >
        <Ionicons
          name={achievement.icon as any}
          size={currentSize.icon}
          color={unlocked ? Colors.primary : Colors.textDisabled}
        />
      </View>
      {!unlocked && (
        <View style={styles.lockOverlay}>
          <Ionicons name="lock-closed" size={currentSize.icon * 0.5} color={Colors.textDisabled} />
        </View>
      )}
    </Component>
  );
};

export const AchievementCard: React.FC<{
  achievement: Achievement;
  unlocked: boolean;
}> = ({ achievement, unlocked }) => {
  return (
    <View style={[styles.card, !unlocked && styles.cardLocked]}>
      <View style={[styles.cardIcon, unlocked && styles.cardIconUnlocked]}>
        <Ionicons
          name={achievement.icon as any}
          size={32}
          color={unlocked ? Colors.primary : Colors.textDisabled}
        />
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardName, !unlocked && styles.cardNameLocked]}>
          {achievement.name}
        </Text>
        <Text style={[styles.cardDescription, !unlocked && styles.cardDescriptionLocked]}>
          {achievement.description}
        </Text>
        <View style={styles.cardReward}>
          <Ionicons name="star" size={14} color={Colors.primary} />
          <Text style={styles.cardRewardText}>+{achievement.xpReward} XP</Text>
        </View>
      </View>
      {unlocked && (
        <View style={styles.unlockedBadge}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  locked: {
    backgroundColor: Colors.backgroundSecondary + '80',
  },
  iconContainer: {
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlockedIcon: {
    backgroundColor: Colors.primary + '20',
  },
  lockOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    ...Shadows.small,
  },
  cardLocked: {
    opacity: 0.6,
    borderColor: Colors.border + '60',
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  cardIconUnlocked: {
    backgroundColor: Colors.primary + '20',
  },
  cardContent: {
    flex: 1,
  },
  cardName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  cardNameLocked: {
    color: Colors.textTertiary,
  },
  cardDescription: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.xs,
  },
  cardDescriptionLocked: {
    color: Colors.textDisabled,
  },
  cardReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cardRewardText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  unlockedBadge: {
    marginLeft: Spacing.sm,
  },
});

export default AchievementBadge;


