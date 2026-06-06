import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TabKey } from '../types';
import { Colors, Spacing, Typography, Shadows } from '../constants/theme';

type BottomNavbarProps = {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
  /** Pending incoming friend requests — dot on Profile tab */
  profileBadgeCount?: number;
};

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'search', label: 'Trade', icon: 'stats-chart' },
  { key: 'portfolio', label: 'Portfolio', icon: 'briefcase' },
  { key: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

const BottomNavbar: React.FC<BottomNavbarProps> = ({ activeTab, onTabPress, profileBadgeCount = 0 }) => {
  const renderTab = ({ key, label, icon }: { key: TabKey; label: string; icon: string }) => {
    const isActive = activeTab === key;
    const color = isActive ? Colors.primary : Colors.textTertiary;
    const iconName = (isActive ? `${icon}` : `${icon}-outline`) as any;
    const showBadge = key === 'profile' && profileBadgeCount > 0;
    return (
      <TouchableOpacity key={key} style={styles.tab} onPress={() => onTabPress(key)}>
        <View style={styles.iconWrap}>
          <Ionicons name={iconName} size={22} color={color} />
          {showBadge && (
            <View style={[styles.badge, profileBadgeCount > 1 && styles.badgeMulti]}>
              {profileBadgeCount > 1 ? (
                <Text style={styles.badgeText}>
                  {profileBadgeCount > 9 ? '9+' : profileBadgeCount}
                </Text>
              ) : null}
            </View>
          )}
        </View>
        <Text style={[styles.label, { color }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {TABS.map(renderTab)}
    </View>
  );
};

export default BottomNavbar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    paddingHorizontal: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 50,
  },
  iconWrap: {
    position: 'relative',
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  badgeMulti: {
    width: undefined,
    minWidth: 16,
    height: 14,
    borderRadius: 7,
    paddingHorizontal: 3,
    top: -4,
    right: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: Typography.fontWeight.bold,
    lineHeight: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.semibold,
  },
});


