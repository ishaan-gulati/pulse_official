import { userService, UserProfile } from './userService';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Level thresholds - XP required for each level
const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  300,    // Level 3
  600,    // Level 4
  1000,   // Level 5
  1500,   // Level 6
  2200,   // Level 7
  3000,   // Level 8
  4000,   // Level 9
  5000,   // Level 10
  6500,   // Level 11
  8000,   // Level 12
  10000,  // Level 13
  12500,  // Level 14
  15000,  // Level 15
];

// Level titles
const LEVEL_TITLES: { [key: number]: string } = {
  1: 'Novice Trader',
  2: 'Rising Star',
  3: 'Active Investor',
  4: 'Market Player',
  5: 'Portfolio Pro',
  6: 'Trading Master',
  7: 'Market Expert',
  8: 'Investment Guru',
  9: 'Wall Street Pro',
  10: 'Trading Legend',
  11: 'Market Titan',
  12: 'Investment Master',
  13: 'Trading Elite',
  14: 'Market Dominator',
  15: 'Trading God',
};

// Achievement definitions
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  category: 'trading' | 'milestone' | 'streak' | 'performance';
  checkCondition: (profile: UserProfile, stats: any) => boolean;
}

/** Shown next to XP in Profile / level card (keep in sync with `awardXP` usage). */
export const XP_HELP_ALERT_TITLE = 'How XP works';

export function getXPHelpMessage(): string {
  return [
    'Total XP is everything you have earned from simulated trading and achievements.',
    '',
    'You earn XP by:',
    '• +10 XP each time you complete a trade (buy or sell)',
    '• +25 XP when you close a winning trade (profitable sell)',
    '• Bonus XP when you unlock achievements (trade milestones, wins, portfolio goals, streak badges, and more)',
    '',
    'Your level increases as your total XP crosses each threshold. Use the Stats tab on Profile to see a rough breakdown by source.',
  ].join('\n');
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_trade',
    name: 'First Steps',
    description: 'Made your first trade',
    icon: 'rocket',
    xpReward: 50,
    category: 'trading',
    checkCondition: (profile, stats) => (profile.totalTrades || 0) >= 1,
  },
  {
    id: 'first_win',
    name: 'Winner',
    description: 'Made your first profitable trade',
    icon: 'trophy',
    xpReward: 75,
    category: 'trading',
    checkCondition: (profile, stats) => (profile.totalWins || 0) >= 1,
  },
  {
    id: 'ten_trades',
    name: 'Getting Started',
    description: 'Made 10 trades',
    icon: 'stats-chart',
    xpReward: 100,
    category: 'trading',
    checkCondition: (profile, stats) => (profile.totalTrades || 0) >= 10,
  },
  {
    id: 'fifty_trades',
    name: 'Active Trader',
    description: 'Made 50 trades',
    icon: 'trending-up',
    xpReward: 200,
    category: 'trading',
    checkCondition: (profile, stats) => (profile.totalTrades || 0) >= 50,
  },
  {
    id: 'hundred_trades',
    name: 'Trading Veteran',
    description: 'Made 100 trades',
    icon: 'medal',
    xpReward: 500,
    category: 'trading',
    checkCondition: (profile, stats) => (profile.totalTrades || 0) >= 100,
  },
  {
    id: 'ten_wins',
    name: 'Consistent Winner',
    description: 'Won 10 trades',
    icon: 'star',
    xpReward: 150,
    category: 'performance',
    checkCondition: (profile, stats) => (profile.totalWins || 0) >= 10,
  },
  {
    id: 'fifty_wins',
    name: 'Win Master',
    description: 'Won 50 trades',
    icon: 'trophy',
    xpReward: 400,
    category: 'performance',
    checkCondition: (profile, stats) => (profile.totalWins || 0) >= 50,
  },
  {
    id: 'streak_3',
    name: 'On a Roll',
    description: '3 day trading streak',
    icon: 'flame',
    xpReward: 50,
    category: 'streak',
    checkCondition: (profile, stats) => (profile.dailyStreak || 0) >= 3,
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: '7 day trading streak',
    icon: 'flame',
    xpReward: 150,
    category: 'streak',
    checkCondition: (profile, stats) => (profile.dailyStreak || 0) >= 7,
  },
  {
    id: 'streak_30',
    name: 'Month Master',
    description: '30 day trading streak',
    icon: 'flame',
    xpReward: 500,
    category: 'streak',
    checkCondition: (profile, stats) => (profile.dailyStreak || 0) >= 30,
  },
  {
    id: 'portfolio_15k',
    name: 'Growing Fast',
    description: 'Reached $15,000 portfolio value',
    icon: 'trending-up',
    xpReward: 100,
    category: 'milestone',
    checkCondition: (profile, stats) => profile.totalPortfolioValue >= 15000,
  },
  {
    id: 'portfolio_20k',
    name: 'Big Spender',
    description: 'Reached $20,000 portfolio value',
    icon: 'cash',
    xpReward: 200,
    category: 'milestone',
    checkCondition: (profile, stats) => profile.totalPortfolioValue >= 20000,
  },
  {
    id: 'portfolio_50k',
    name: 'High Roller',
    description: 'Reached $50,000 portfolio value',
    icon: 'diamond',
    xpReward: 500,
    category: 'milestone',
    checkCondition: (profile, stats) => profile.totalPortfolioValue >= 50000,
  },
  {
    id: 'profit_1k',
    name: 'First Grand',
    description: 'Made $1,000 profit',
    icon: 'cash',
    xpReward: 150,
    category: 'milestone',
    checkCondition: (profile, stats) => profile.totalReturn >= 1000,
  },
  {
    id: 'profit_5k',
    name: 'Big Winner',
    description: 'Made $5,000 profit',
    icon: 'trophy',
    xpReward: 400,
    category: 'milestone',
    checkCondition: (profile, stats) => profile.totalReturn >= 5000,
  },
  {
    id: 'win_rate_70',
    name: 'Sharpshooter',
    description: 'Achieved 70% win rate (min 10 trades)',
    icon: 'locate',
    xpReward: 300,
    category: 'performance',
    checkCondition: (profile, stats) => {
      const winRate = stats.winRate || 0;
      const totalTrades = stats.totalRealizedTrades || 0;
      return winRate >= 70 && totalTrades >= 10;
    },
  },
];

class GamificationService {
  // Calculate level from XP
  calculateLevel(xp: number): number {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_THRESHOLDS[i]) {
        return i + 1;
      }
    }
    return 1;
  }

  // Get XP needed for next level
  getXPForNextLevel(currentLevel: number): number {
    if (currentLevel >= LEVEL_THRESHOLDS.length) {
      return 0; // Max level
    }
    return LEVEL_THRESHOLDS[currentLevel];
  }

  // Get XP progress to next level
  getXPProgress(xp: number, level: number): { current: number; needed: number; percentage: number } {
    const currentLevelXP = LEVEL_THRESHOLDS[level - 1] || 0;
    const nextLevelXP = this.getXPForNextLevel(level);
    const progressXP = xp - currentLevelXP;
    const neededXP = nextLevelXP - currentLevelXP;
    const percentage = neededXP > 0 ? (progressXP / neededXP) * 100 : 100;

    return {
      current: progressXP,
      needed: neededXP,
      percentage: Math.min(100, Math.max(0, percentage)),
    };
  }

  // Get level title
  getLevelTitle(level: number): string {
    return LEVEL_TITLES[level] || `Level ${level}`;
  }

  // Award XP to user
  async awardXP(uid: string, amount: number, reason?: string): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }> {
    try {
      const profile = await userService.getUserProfile(uid);
      if (!profile) throw new Error('User profile not found');

      const currentXP = profile.xp ?? 0;
      const currentLevel = profile.level ?? this.calculateLevel(currentXP);
      const newXP = currentXP + amount;
      const newLevel = this.calculateLevel(newXP);
      const leveledUp = newLevel > currentLevel;

      // Update user profile
      const userRef = doc(db, 'users', uid);
      const updateData: any = {
        xp: newXP,
        level: newLevel,
      };
      
      // Only update if level changed to avoid unnecessary writes
      if (leveledUp) {
        updateData.level = newLevel;
      }
      
      await updateDoc(userRef, updateData);

      if (reason) {
        console.log(`Awarded ${amount} XP to ${uid}: ${reason}${leveledUp ? ' (LEVEL UP!)' : ''}`);
      }

      return { newXP, newLevel, leveledUp };
    } catch (error) {
      console.error('Error awarding XP:', error);
      throw error;
    }
  }

  // Update daily streak
  async updateStreak(uid: string): Promise<number> {
    try {
      const profile = await userService.getUserProfile(uid);
      if (!profile) return 0;

      const today = new Date().toISOString().split('T')[0];
      const lastTradeDate = profile.lastTradeDate;
      const currentStreak = profile.dailyStreak || 0;

      let newStreak = currentStreak;
      if (lastTradeDate === today) {
        // Already traded today, no change
        newStreak = currentStreak;
      } else if (lastTradeDate) {
        // Check if yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastTradeDate === yesterdayStr) {
          // Continuing streak
          newStreak = currentStreak + 1;
        } else {
          // Streak broken, start over
          newStreak = 1;
        }
      } else {
        // First trade ever
        newStreak = 1;
      }

      // Update profile
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        dailyStreak: newStreak,
        lastTradeDate: today,
      });

      return newStreak;
    } catch (error) {
      console.error('Error updating streak:', error);
      return 0;
    }
  }

  // Check and unlock achievements
  async checkAchievements(uid: string, stats?: any): Promise<string[]> {
    try {
      const profile = await userService.getUserProfile(uid);
      if (!profile) return [];

      const currentAchievements = profile.achievements || [];
      const newlyUnlocked: string[] = [];

      for (const achievement of ACHIEVEMENTS) {
        // Skip if already unlocked
        if (currentAchievements.includes(achievement.id)) continue;

        // Check if condition is met
        if (achievement.checkCondition(profile, stats || {})) {
          newlyUnlocked.push(achievement.id);

          // Award XP for achievement
          await this.awardXP(uid, achievement.xpReward, `Achievement: ${achievement.name}`);

          // Add to achievements list
          const userRef = doc(db, 'users', uid);
          await updateDoc(userRef, {
            achievements: [...currentAchievements, achievement.id],
          });
        }
      }

      return newlyUnlocked;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }

  // Get all achievements for display
  getAchievements(): Achievement[] {
    return ACHIEVEMENTS;
  }

  // Get user's unlocked achievements
  async getUserAchievements(uid: string): Promise<Achievement[]> {
    try {
      const profile = await userService.getUserProfile(uid);
      if (!profile) return [];

      const unlockedIds = profile.achievements || [];
      return ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id));
    } catch (error) {
      console.error('Error getting user achievements:', error);
      return [];
    }
  }
}

export const gamificationService = new GamificationService();

