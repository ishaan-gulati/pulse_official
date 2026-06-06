import React from 'react';
import { View, StyleSheet } from 'react-native';
import UserBadge from './UserBadge';

interface UserBadgesProps {
  tags: string[];
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  maxBadges?: number;
}

const UserBadges: React.FC<UserBadgesProps> = ({ 
  tags, 
  size = 'medium', 
  showIcon = true,
  maxBadges = 3
}) => {
  if (!tags || tags.length === 0) return null;

  // Filter out common tags and prioritize special ones
  const priorityTags = ['founder', 'admin', 'verified', 'moderator', 'premium'];
  const sortedTags = tags.sort((a, b) => {
    const aPriority = priorityTags.indexOf(a.toLowerCase());
    const bPriority = priorityTags.indexOf(b.toLowerCase());
    if (aPriority === -1 && bPriority === -1) return 0;
    if (aPriority === -1) return 1;
    if (bPriority === -1) return -1;
    return aPriority - bPriority;
  });

  const displayTags = sortedTags.slice(0, maxBadges);

  return (
    <View style={styles.container}>
      {displayTags.map((tag, index) => (
        <UserBadge
          key={tag}
          tag={tag}
          size={size}
          showIcon={showIcon}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
});

export default UserBadges;
