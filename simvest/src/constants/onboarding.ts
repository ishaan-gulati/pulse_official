/** Stored on `UserProfile.startingVibe` after post-signup onboarding (profile-only). */
export const STARTING_VIBE = {
  TECH_BULL: 'tech_bull',
  DIVERSIFIED: 'diversified',
  CRYPTO_CURIOUS: 'crypto_curious',
} as const;

export type StartingVibeId = (typeof STARTING_VIBE)[keyof typeof STARTING_VIBE];

export const STARTING_VIBE_OPTIONS: {
  id: StartingVibeId;
  title: string;
  description: string;
  icon: 'rocket-outline' | 'globe-outline' | 'shield-checkmark-outline';
}[] = [
  {
    id: STARTING_VIBE.TECH_BULL,
    title: 'Growth aggressive',
    description: 'Chase momentum and high-growth names - bigger swings, still paper only.',
    icon: 'rocket-outline',
  },
  {
    id: STARTING_VIBE.DIVERSIFIED,
    title: 'Diversified',
    description: 'Spread risk across ideas - steady, balanced energy.',
    icon: 'globe-outline',
  },
  {
    id: STARTING_VIBE.CRYPTO_CURIOUS,
    title: 'Value investor',
    description: 'Focus on fundamentals and patience over hype - build discipline with simulated trades.',
    icon: 'shield-checkmark-outline',
  },
];
