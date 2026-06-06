/**
 * Centralized theme constants for the Pulse app
 * All colors, spacing, typography, and design tokens
 */

export const Colors = {
  // Background colors — pure black base
  background: '#000000',
  backgroundSecondary: '#000000',
  backgroundTertiary: '#0A0A0A',
  
  // Border colors
  border: '#1C2430',
  borderLight: '#121922',
  
  // Text colors
  textPrimary: '#E2E8F0',
  textSecondary: '#E5D9FF',
  textTertiary: '#9AA4B2',
  textMuted: '#94A3B8',
  textDisabled: '#64748B',
  
  // Brand colors
  primary: '#8B5CF6',
  primaryDark: '#7C3AED',
  
  // Status colors
  success: '#10B981',
  successAlt: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#38BDF8',
  
  // Badge colors
  badgeFounder: '#FFD700',
  badgeAdmin: '#EF4444',
  badgeVerified: '#10B981',
  badgeModerator: '#8B5CF6',
  badgePremium: '#F59E0B',
  
  // Special
  trophy: '#F59E0B',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BorderRadius = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 32,
  full: 999,
} as const;

export const Typography = {
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    xxxl: 24,
    huge: 48,
  },
  fontWeight: {
    normal: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

/** Glassmorphism tokens — subtle frost on near-black backgrounds */
export const Glass = {
  blurIntensity: 48,
  blurIntensityLight: 28,
  blurIntensityHeavy: 56,
  /** Frosted fill over blur — black-first */
  fill: 'rgba(0, 0, 0, 0.88)',
  fillElevated: 'rgba(0, 0, 0, 0.92)',
  fillSubtle: 'rgba(0, 0, 0, 0.82)',
  /** Light purple RGB boundary for feed posts — thin, darker violet edge */
  postBorder: 'rgba(109, 40, 217, 0.42)',
  postBorderBright: 'rgba(124, 58, 237, 0.52)',
  /** Hairline edge catch-light */
  border: 'rgba(255, 255, 255, 0.10)',
  borderBright: 'rgba(255, 255, 255, 0.18)',
  /** Inner top highlight */
  highlight: 'rgba(255, 255, 255, 0.07)',
  /** Tinted glass accents */
  primaryTint: 'rgba(139, 92, 246, 0.22)',
  successTint: 'rgba(16, 185, 129, 0.16)',
  errorTint: 'rgba(239, 68, 68, 0.14)',
  /** RGB edge glow presets (used by GlassSurface) — subtle on near-black */
  glowPurple: 'rgba(109, 40, 217, 0.28)',
  glowCyan: 'rgba(56, 189, 248, 0.36)',
  glowPink: 'rgba(236, 72, 153, 0.32)',
} as const;

export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  primary: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const STARTING_CASH = 10000;

