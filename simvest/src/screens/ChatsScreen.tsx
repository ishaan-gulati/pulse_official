import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Chat } from '../types';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { MOCK_CHATS } from '../constants/mockData';

const ChatsScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chats</Text>
      <FlatList
        data={MOCK_CHATS}
        keyExtractor={(i) => i.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.last}>{item.last}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
};

export default ChatsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
  },
  separator: {
    height: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.border,
  },
  name: {
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.bold,
  },
  last: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  badge: {
    minWidth: 30,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  badgeText: {
    color: Colors.background,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.extrabold,
  },
});


