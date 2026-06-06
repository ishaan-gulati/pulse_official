import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Colors, Glass } from '../constants/theme';

type UserAvatarProps = {
  photoURL?: string | null;
  displayName?: string;
  username?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export function getAvatarInitial(displayName?: string, username?: string): string {
  const source = (displayName || username || '?').trim();
  return source.charAt(0).toUpperCase();
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  photoURL,
  displayName,
  username,
  size = 44,
  style,
  onPress,
}) => {
  const hasPhoto = Boolean(photoURL && photoURL.trim() !== '');
  const initial = getAvatarInitial(displayName, username);
  const fontSize = Math.max(12, Math.round(size * 0.38));
  const borderRadius = size / 2;

  const content = hasPhoto ? (
    <Image
      source={{ uri: photoURL! }}
      style={{ width: size, height: size, borderRadius }}
    />
  ) : (
    <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
  );

  const containerStyle = [
    styles.container,
    {
      width: size,
      height: size,
      borderRadius,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress} activeOpacity={0.75}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{content}</View>;
};

export default UserAvatar;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary + '25',
    borderWidth: 1,
    borderColor: Glass.postBorder,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initial: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
