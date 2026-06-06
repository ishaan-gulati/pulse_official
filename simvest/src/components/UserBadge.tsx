import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BadgeSize } from '../types';
import { Colors, Typography } from '../constants/theme';

interface UserBadgeProps {
  tag: string;
  size?: BadgeSize;
  showIcon?: boolean;
}

const UserBadge: React.FC<UserBadgeProps> = ({ 
  tag, 
  size = 'medium', 
  showIcon = true 
}) => {
  const getBadgeConfig = (tag: string) => {
    switch (tag.toLowerCase()) {
      case 'founder':
        return {
          icon: 'trophy',
          color: Colors.badgeFounder,
          backgroundColor: 'rgba(255, 215, 0, 0.15)',
          text: 'FOUNDER'
        };
      case 'admin':
        return {
          icon: 'shield',
          color: Colors.badgeAdmin,
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          text: 'ADMIN'
        };
      case 'verified':
        return {
          icon: 'checkmark-circle',
          color: Colors.badgeVerified,
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          text: 'VERIFIED'
        };
      case 'moderator':
        return {
          icon: 'star',
          color: Colors.badgeModerator,
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          text: 'MODERATOR'
        };
      case 'premium':
        return {
          icon: 'diamond',
          color: Colors.badgePremium,
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          text: 'PREMIUM'
        };
      default:
        return {
          icon: 'person',
          color: Colors.textMuted,
          backgroundColor: 'rgba(107, 114, 128, 0.15)',
          text: tag.toUpperCase()
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          fontSize: 10,
          iconSize: 12
        };
      case 'large':
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          fontSize: 16,
          iconSize: 20
        };
      default: // medium
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
          fontSize: 12,
          iconSize: 16
        };
    }
  };

  const badgeConfig = getBadgeConfig(tag);
  const sizeStyles = getSizeStyles();

  return (
    <View style={[
      styles.badge,
      {
        paddingHorizontal: sizeStyles.paddingHorizontal,
        paddingVertical: sizeStyles.paddingVertical,
        borderRadius: sizeStyles.borderRadius,
        backgroundColor: badgeConfig.backgroundColor,
        borderColor: badgeConfig.color,
      }
    ]}>
      {showIcon && (
        <Ionicons 
          name={badgeConfig.icon as any} 
          size={sizeStyles.iconSize} 
          color={badgeConfig.color} 
          style={styles.icon}
        />
      )}
      <Text style={[
        styles.text,
        { 
          fontSize: sizeStyles.fontSize,
          color: badgeConfig.color,
          fontWeight: Typography.fontWeight.extrabold,
        }
      ]}>
        {badgeConfig.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: Typography.fontWeight.extrabold,
    letterSpacing: 0.5,
  },
});

export default UserBadge;
