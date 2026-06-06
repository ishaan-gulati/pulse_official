import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../constants/theme';

type CelebrationModalProps = {
  visible: boolean;
  onClose: () => void;
  message: string;
  icon?: string;
  color?: string;
};

const CelebrationModal: React.FC<CelebrationModalProps> = ({
  visible,
  onClose,
  message,
  icon = 'trophy',
  color = Colors.success,
}) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scale.setValue(0);
      opacity.setValue(0);
      rotate.setValue(0);

      // Animate in
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(rotate, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(rotate, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Auto close after 2 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onClose();
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal 
      transparent 
      visible={visible} 
      animationType="none" 
      onRequestClose={onClose}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale }, { rotate: rotation }],
              opacity,
            },
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon as any} size={64} color={color} />
          </View>
          <Text style={styles.message}>{message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 24,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    minWidth: 280,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  message: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
  },
});

export default CelebrationModal;



