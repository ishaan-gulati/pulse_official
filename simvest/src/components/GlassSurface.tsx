import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Glass } from '../constants/theme';

export type GlassVariant = 'default' | 'subtle' | 'elevated';
export type GlassGlow = 'none' | 'purple' | 'cyan' | 'success' | 'error' | 'mixed';

export type GlassSurfaceProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  intensity?: number;
  tintColor?: string;
  variant?: GlassVariant;
  glow?: GlassGlow;
  /** Override edge color (e.g. feed post purple boundary) */
  borderColor?: string;
  borderWidth?: number;
};

const variantFill: Record<GlassVariant, string> = {
  default: Glass.fill,
  subtle: Glass.fillSubtle,
  elevated: Glass.fillElevated,
};

/** Subtle RGB edge tint — kept low so black background stays dominant */
const glowBorder: Record<GlassGlow, string> = {
  none: Glass.border,
  purple: Glass.postBorder,
  cyan: 'rgba(56, 189, 248, 0.26)',
  success: 'rgba(16, 185, 129, 0.26)',
  error: 'rgba(239, 68, 68, 0.26)',
  mixed: 'rgba(147, 120, 255, 0.28)',
};

const glowShadow: Record<GlassGlow, string | undefined> = {
  none: undefined,
  purple: Glass.glowPurple,
  cyan: Glass.glowCyan,
  success: 'rgba(16, 185, 129, 0.4)',
  error: 'rgba(239, 68, 68, 0.4)',
  mixed: 'rgba(139, 92, 246, 0.38)',
};

const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  style,
  borderRadius = 20,
  intensity = Glass.blurIntensityLight,
  tintColor,
  variant = 'default',
  glow = 'none',
  borderColor: borderColorProp,
  borderWidth = StyleSheet.hairlineWidth,
}) => {
  const fill = tintColor ?? variantFill[variant];
  const borderColor = borderColorProp ?? glowBorder[glow];
  const shadowColor = glowShadow[glow];

  const shellStyle: ViewStyle = {
    borderRadius,
    overflow: 'hidden',
    borderWidth,
    borderColor,
    ...(shadowColor && glow !== 'none'
      ? {
          shadowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0.12,
          shadowRadius: 8,
          elevation: 3,
        }
      : {}),
  };

  const highlightStyle = [
    styles.highlight,
    {
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
    },
  ];

  if (Platform.OS === 'web') {
    return (
      <View style={[shellStyle, { backgroundColor: fill }, style]}>
        <View style={highlightStyle} pointerEvents="none" />
        {children}
      </View>
    );
  }

  return (
    <View style={[shellStyle, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: fill }]} />
      <View style={highlightStyle} pointerEvents="none" />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Glass.highlight,
  },
});

export default GlassSurface;
