import { db } from '../config/firebase';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  where,
  addDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  deleteField,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
import { stockPriceService } from './stockPriceService';
import { STARTING_CASH } from '../constants/theme';

/** Doc ID = normalizeLoginUsername(); used for sign-in before auth. */
const LOGIN_USERNAMES_COLLECTION = 'loginUsernames';

/** Resolve handle → email before Firebase Auth; distinct reasons for sign-in UI. */
export type UsernameLookupReason =
  | 'not_found'
  | 'rules_blocked'
  | 'network'
  | 'unknown';

export class UsernameLookupError extends Error {
  readonly reason: UsernameLookupReason;

  constructor(reason: UsernameLookupReason, message: string) {
    super(message);
    this.name = 'UsernameLookupError';
    this.reason = reason;
  }
}

function tradeTime(t: TradingHistory): number {
  const ts = t.timestamp;
  if (ts?.toDate) return (ts as { toDate: () => Date }).toDate().getTime();
  return new Date(ts).getTime();
}

/**
 * Win rate over sells in this history slice: % of sells where sell price exceeds the
 * average buy price for the same symbol from buys that occurred strictly before that sell.
 * Matches `tradingService` / gamification achievement logic (not `profile.totalWins`, which
 * uses position avg cost at sell time and can differ slightly).
 */
export function computeWinRateFromTradingHistory(tradingHistory: TradingHistory[]): number | null {
  const sells = tradingHistory.filter((t) => t.action === 'sell');
  if (sells.length === 0) return null;
  const wins = sells.filter((sellTrade) => {
    const buyTrades = tradingHistory.filter(
      (bt) =>
        bt.symbol === sellTrade.symbol &&
        bt.action === 'buy' &&
        tradeTime(bt) < tradeTime(sellTrade)
    );
    if (buyTrades.length === 0) return false;
    const avgBuyPrice = buyTrades.reduce((sum, bt) => sum + bt.price, 0) / buyTrades.length;
    return sellTrade.price > avgBuyPrice;
  }).length;
  return (wins / sells.length) * 100;
}

// User data types
export interface UserProfile {
  uid: string;
  username: string; // Unique username for the app
  /** Normalized handle for username sign-in (lowercase, no @). Optional on legacy profiles until next profile write or backfill. */
  loginUsernameKey?: string;
  displayName: string; // Full name
  email: string;
  password?: string; // Optional: store hashed password if needed
  photoURL?: string;
  bio?: string;
  createdAt: any;
  lastLoginAt: any;
  lastActive: any;
  totalPortfolioValue: number;
  totalReturn: number;
  /** Stored cash balance. When set, totalPortfolioValue = cash + sum(positions.totalValue). Omitted for legacy users (we derive cash from total - invested). */
  cash?: number;
  /** If false, other users cannot see your position list on your public profile (total value still shown). Only this user’s doc is updated from Settings - viewers cannot change someone else’s flag. Default true. */
  showPortfolioToOthers?: boolean;
  rank?: number;
  isVerified: boolean; // Email verification status
  tags: string[]; // Dynamic tags for roles, badges, permissions
  customBadges?: string[]; // Custom badge text for special tags
  referredBy?: string; // UID of user who referred this user
  referralCode?: string; // Referral code used by this user
  /** Sum of referrer bonuses actually credited to `cash` (keeps `referrals.totalEarned` and wallet in sync). */
  referralBonusCreditedTotal?: number;
  // Gamification fields
  xp?: number; // Total experience points
  level?: number; // Current level
  dailyStreak?: number; // Consecutive days with trades
  lastTradeDate?: string; // Last date a trade was made (YYYY-MM-DD)
  achievements?: string[]; // Array of achievement IDs unlocked
  totalTrades?: number; // Total number of trades made
  totalWins?: number; // Total winning trades
  pushToken?: string; // Expo push token for remote notifications
  /** Post-signup product tour; `false` = show onboarding. Omitted on legacy profiles (treated as completed). */
  onboardingCompleted?: boolean;
  /** User-chosen starter "vibe" from post-signup onboarding (profile-only, no auto-trades). */
  startingVibe?: string;
}

export interface PortfolioPosition {
  symbol: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  totalValue: number;
  totalReturn: number;
  returnPercentage: number;
  previousClose?: number; // Previous day's close price for calculating today's P/L
  lastUpdated: any;
}

export interface TradingHistory {
  id: string;
  symbol: string;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  totalAmount: number;
  timestamp: any;
  fees: number;
}

/** Public profile: holdings use live quotes while `users.totalPortfolioValue` can lag - use these for consistent UI. */
export type ViewerPortfolioPayload = {
  positions: PortfolioPosition[];
  displayTotalValue: number;
  displayTotalReturn: number;
};

export interface LeaderboardEntry {
  uid: string;
  username: string;
  displayName: string;
  totalReturn: number;
  totalPortfolioValue: number;
  rank: number;
  lastUpdated: any;
  tags: string[];
  customBadges?: string[];
}

/** Rows returned by `getLeaderboard` (default argument). */
export const LEADERBOARD_LIMIT = 100;

// User Service Class
class UserService {
  /**
   * Document ID for loginUsernames - must stay in sync everywhere (signup, lookup, delete).
   * Strips @handle prefix, invisible chars, trim, lowercase.
   */
  normalizeLoginUsername(raw: string): string {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    s = s.replace(/^@+/, '').trim();
    return s.toLowerCase();
  }

  /** Possible Firestore doc IDs for this username (current + legacy @prefixed). */
  private loginUsernameDocKeys(rawInput: string): string[] {
    const key = this.normalizeLoginUsername(rawInput);
    if (!key) return [];
    const keys = [key];
    keys.push(`@${key}`);
    return [...new Set(keys)];
  }

  /**
   * Writes /loginUsernames/{normalized} so username sign-in works while logged out.
   * Safe to call after any successful sign-in to backfill older accounts.
   */
  async syncLoginUsernameLookup(uid: string): Promise<void> {
    const profile = await this.getUserProfile(uid);
    if (!profile?.username || !profile.email?.includes('@')) return;
    const key = this.normalizeLoginUsername(profile.username);
    if (!key) return;
    await setDoc(
      doc(db, LOGIN_USERNAMES_COLLECTION, key),
      { uid, email: profile.email.trim(), username: profile.username },
      { merge: true }
    );
    try {
      await updateDoc(doc(db, 'users', uid), { loginUsernameKey: key });
    } catch {
      // best-effort
    }
  }

  // Create or update user profile
  async createUserProfile(uid: string, userData: Partial<UserProfile>): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      
      // Generate a unique username if not provided
      const username = userData.username || this.generateUsername(userData.displayName || 'user');
      const loginKey = this.normalizeLoginUsername(username);

      // Check if this is a founder account and add appropriate tags
      const tags: string[] = [];
      const customBadges: string[] = [];
      
      if (userData.email === 'ishaan1gulati@gmail.com') {
        tags.push('founder', 'admin', 'verified');
        customBadges.push('🏆 FOUNDER');
      }
      
      const userProfile: UserProfile = {
        uid,
        username,
        loginUsernameKey: loginKey || undefined,
        displayName: userData.displayName || '',
        email: userData.email || '',
        photoURL: userData.photoURL || undefined,
        bio: userData.bio || '',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        totalPortfolioValue: userData.totalPortfolioValue ?? 10000,
        totalReturn: userData.totalReturn ?? 0,
        cash: userData.cash ?? (userData.totalPortfolioValue ?? 10000),
        rank: userData.rank || 0,
        isVerified: false, // Will be verified when email is confirmed
        tags,
        customBadges,
        // Initialize gamification fields
        xp: userData.xp || 0,
        level: userData.level || 1,
        dailyStreak: userData.dailyStreak || 0,
        totalTrades: userData.totalTrades || 0,
        totalWins: userData.totalWins || 0,
        achievements: userData.achievements || [],
        onboardingCompleted:
          userData.onboardingCompleted !== undefined ? userData.onboardingCompleted : false,
      };
      
      // Remove undefined values to prevent Firestore errors
      const cleanProfile = Object.fromEntries(
        Object.entries(userProfile).filter(([_, value]) => value !== undefined)
      );

      const signupEmail = typeof userData.email === 'string' ? userData.email.trim() : '';

      const batch = writeBatch(db);
      batch.set(userRef, cleanProfile, { merge: true });
      if (loginKey && signupEmail.includes('@')) {
        batch.set(
          doc(db, LOGIN_USERNAMES_COLLECTION, loginKey),
          { uid, email: signupEmail, username },
          { merge: true }
        );
      }
      await batch.commit();

      console.log('User profile created/updated successfully');
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  // Get user profile
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return userSnap.data() as UserProfile;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  // Update user profile
  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      const keyPatch =
        typeof updates.username === 'string'
          ? (() => {
              const k = this.normalizeLoginUsername(updates.username);
              return k ? { loginUsernameKey: k } : {};
            })()
          : {};
      const patch: Record<string, unknown> = {
        ...updates,
        ...keyPatch,
        lastLoginAt: serverTimestamp(),
      };
      if ('photoURL' in updates && !updates.photoURL) {
        patch.photoURL = deleteField();
      }
      await updateDoc(userRef, patch);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  async uploadProfilePhoto(uid: string, localUri: string): Promise<string> {
    try {
      const manipulated = await manipulateAsync(
        localUri,
        [{ resize: { width: 256, height: 256 } }],
        { compress: 0.7, format: SaveFormat.JPEG, base64: true }
      );

      if (!manipulated.base64) {
        throw new Error('Could not process image');
      }

      const dataUri = `data:image/jpeg;base64,${manipulated.base64}`;
      if (dataUri.length > 700_000) {
        throw new Error('Image is too large. Try a smaller photo.');
      }

      await this.updateUserProfile(uid, { photoURL: dataUri });
      return dataUri;
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      throw error;
    }
  }

  async removeProfilePhoto(uid: string): Promise<void> {
    await this.updateUserProfile(uid, { photoURL: '' });
  }

  // Reset portfolio value (useful for debugging/testing)
  async resetPortfolioValue(uid: string, value: number = 10000): Promise<void> {
    try {
      await this.updateUserProfile(uid, {
        totalPortfolioValue: value,
        totalReturn: 0,
        cash: value,
      });
      console.log(`Portfolio value reset to $${value} for user ${uid}`);
    } catch (error) {
      console.error('Error resetting portfolio value:', error);
      throw error;
    }
  }

  // Complete portfolio reset - removes all positions, trading history, snapshots; sets account to $10k cash, 0% returns.
  // When resetAchievements is true, also clears XP, level, achievements, and streak.
  async resetPortfolio(uid: string, value: number = 10000, resetAchievements: boolean = false): Promise<void> {
    try {
      // 1. Delete all portfolio positions
      const portfolioRef = collection(db, 'users', uid, 'portfolio');
      const portfolioSnap = await getDocs(portfolioRef);
      const deletePositionPromises = portfolioSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePositionPromises);
      console.log(`Deleted ${portfolioSnap.docs.length} portfolio positions`);

      // 2. Delete all trading history
      const tradingHistoryRef = collection(db, 'users', uid, 'tradingHistory');
      const historySnap = await getDocs(tradingHistoryRef);
      const deleteHistoryPromises = historySnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteHistoryPromises);
      console.log(`Deleted ${historySnap.docs.length} trading history entries`);

      // 3. Delete all portfolio snapshots (so period returns show 0% until new history builds)
      const snapshotsRef = collection(db, 'users', uid, 'portfolioSnapshots');
      const snapSnap = await getDocs(snapshotsRef);
      const deleteSnapPromises = snapSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteSnapPromises);
      console.log(`Deleted ${snapSnap.docs.length} portfolio snapshots`);

      // 4. Reset user profile: $10k cash, 0 return, 0 trades/wins (leaderboard and app use this)
      const profileUpdates: Partial<UserProfile> = {
        totalPortfolioValue: value,
        totalReturn: 0,
        cash: value,
        totalTrades: 0,
        totalWins: 0,
      };
      if (resetAchievements) {
        profileUpdates.xp = 0;
        profileUpdates.level = 1;
        profileUpdates.achievements = [];
        profileUpdates.dailyStreak = 0;
        profileUpdates.lastTradeDate = '';
      }
      await this.updateUserProfile(uid, profileUpdates);

      console.log(`Portfolio reset to $${value} cash; positions, history, snapshots cleared; stats zeroed${resetAchievements ? '; achievements cleared' : ''}`);
    } catch (error) {
      console.error('Error resetting portfolio:', error);
      throw error;
    }
  }

  // Add portfolio position
  async addPortfolioPosition(uid: string, position: Omit<PortfolioPosition, 'lastUpdated'>, skipPortfolioValueUpdate: boolean = false): Promise<void> {
    try {
      const portfolioRef = doc(db, 'users', uid, 'portfolio', position.symbol);
      await setDoc(portfolioRef, {
        ...position,
        lastUpdated: serverTimestamp()
      });
      
      // Only update portfolio value if not skipping (for trades, we update manually)
      if (!skipPortfolioValueUpdate) {
      await this.updateUserPortfolioValue(uid);
      }
    } catch (error) {
      console.error('Error adding portfolio position:', error);
      throw error;
    }
  }

  // Delete portfolio position (when selling all shares)
  async deletePortfolioPosition(uid: string, symbol: string): Promise<void> {
    try {
      const portfolioRef = doc(db, 'users', uid, 'portfolio', symbol);
      await deleteDoc(portfolioRef);
      
      // Don't update portfolio value here - trading service handles it manually
      // This prevents double-counting and ensures correct cash calculations
    } catch (error) {
      console.error('Error deleting portfolio position:', error);
      throw error;
    }
  }

  // Get user portfolio with real-time prices
  async getUserPortfolio(uid: string, refreshPrices: boolean = true): Promise<PortfolioPosition[]> {
    try {
      const portfolioRef = collection(db, 'users', uid, 'portfolio');
      const portfolioSnap = await getDocs(portfolioRef);
      
      const positions: PortfolioPosition[] = [];
      portfolioSnap.forEach((docSnap) => {
        const position = docSnap.data() as PortfolioPosition;
        const shares = Number(position.shares);
        const symbol = (position.symbol || docSnap.id || '').toString();
        if (!Number.isFinite(shares) || shares <= 0) return;
        positions.push({
          ...position,
          symbol: symbol.toUpperCase(),
          shares,
        });
      });

      // Refresh current prices if requested; use returned array so UI gets same data we wrote (no stale re-read)
      if (refreshPrices && positions.length > 0) {
        const updatedPositions = await this.refreshPortfolioPrices(uid, positions);
        return updatedPositions;
      }

      // No positions: price refresh is a no-op, but legacy profiles can still have totalPortfolioValue
      // out of sync (e.g. old 10k+return bug). Reconcile from cash + invested (0) when cash is stored.
      if (refreshPrices && positions.length === 0) {
        await this.updateUserPortfolioValue(uid);
      }

      return positions;
    } catch (error) {
      console.error('Error getting user portfolio:', error);
      throw error;
    }
  }

  /**
   * Viewing another user's profile: load positions from Firestore and apply live quotes in memory only.
   * Does not write to Firestore (viewers cannot update another user's portfolio docs).
   * `displayTotalValue` = stored cash (or inferred) + live market value so the header matches holdings.
   */
  async getUserPortfolioForViewer(uid: string): Promise<ViewerPortfolioPayload> {
    try {
      const profile = await this.getUserProfile(uid);
      const raw = await this.getUserPortfolio(uid, false);
      const positions = raw
        .map((p) => ({
          ...p,
          shares: Number(p.shares),
          symbol: (p.symbol || '').toString().toUpperCase(),
        }))
        .filter((p) => Number.isFinite(p.shares) && p.shares > 0);

      const totalStored = profile?.totalPortfolioValue ?? STARTING_CASH;

      if (positions.length === 0) {
        const cashOnly =
          profile?.cash != null && Number.isFinite(profile.cash)
            ? Math.max(0, profile.cash)
            : Math.max(0, totalStored);
        return {
          positions: [],
          displayTotalValue: cashOnly,
          displayTotalReturn: cashOnly - STARTING_CASH,
        };
      }

      const staleInvested = positions.reduce((sum, p) => sum + Number(p.totalValue), 0);
      const cashBasis =
        profile?.cash != null && Number.isFinite(profile.cash)
          ? profile.cash
          : totalStored - staleInvested;

      const symbols = positions.map((p) => p.symbol.toUpperCase());
      const quotes = await stockPriceService.getQuotes(symbols);
      const livePositions = positions.map((position) => {
        const quote = quotes.get(position.symbol.toUpperCase());
        if (quote) {
          const currentPrice = quote.currentPrice;
          const totalValue = position.shares * currentPrice;
          const totalReturn = totalValue - position.shares * position.avgPrice;
          const returnPercentage =
            position.avgPrice > 0 ? ((currentPrice - position.avgPrice) / position.avgPrice) * 100 : 0;
          return {
            ...position,
            currentPrice,
            totalValue,
            totalReturn,
            returnPercentage,
            previousClose: quote.previousClose,
          };
        }
        return {
          ...position,
          currentPrice: position.avgPrice,
          totalValue: position.shares * position.avgPrice,
          totalReturn: 0,
          returnPercentage: 0,
        };
      });

      const liveInvested = livePositions.reduce((sum, p) => sum + p.totalValue, 0);
      const displayTotalValue = Math.max(0, cashBasis) + liveInvested;
      const displayTotalReturn = displayTotalValue - STARTING_CASH;

      return {
        positions: livePositions,
        displayTotalValue,
        displayTotalReturn,
      };
    } catch (error) {
      console.error('Error getting user portfolio for viewer:', error);
      throw error;
    }
  }

  // Refresh portfolio positions with real-time prices. Returns the updated positions array (in-memory)
  // so callers get the same data we wrote, avoiding stale Firestore re-reads.
  async refreshPortfolioPrices(uid: string, positions?: PortfolioPosition[]): Promise<PortfolioPosition[]> {
    try {
      const { referralService } = await import('./referralService');
      await referralService.reconcileReferralBonusCash(uid);

      const positionsToUpdate = positions || await this.getUserPortfolio(uid, false);
      
      // Get current profile; use stored cash when available so total = cash + positions
      const profile = await this.getUserProfile(uid);
      if (!profile) return positionsToUpdate;
      const oldInvestedValue = positionsToUpdate.reduce((sum, p) => sum + p.totalValue, 0);
      const oldTotalPortfolioValue = profile.totalPortfolioValue || 10000;
      const cash = profile.cash != null ? profile.cash : oldTotalPortfolioValue - oldInvestedValue;
      
      // Fetch real prices for all positions (use uppercase for cache/API consistency)
      const symbols = positionsToUpdate.map(p => p.symbol.toUpperCase());
      const quotes = await stockPriceService.getQuotes(symbols);

      const updatedPositions: PortfolioPosition[] = [];

      // Build updated positions and fire all Firestore writes in parallel
      const writePromises: Promise<void>[] = [];
      for (const position of positionsToUpdate) {
        const quote = quotes.get(position.symbol.toUpperCase());
        if (quote) {
          const currentPrice = quote.currentPrice;
          const totalValue = position.shares * currentPrice;
          const totalReturn = totalValue - (position.shares * position.avgPrice);
          const returnPercentage = position.avgPrice > 0
            ? ((currentPrice - position.avgPrice) / position.avgPrice) * 100
            : 0;

          const updatedPosition: PortfolioPosition = {
            ...position,
            currentPrice,
            totalValue,
            totalReturn,
            returnPercentage,
            previousClose: quote.previousClose,
          };

          updatedPositions.push(updatedPosition);
          // Skip per-row portfolio recompute - parallel updates race and write wrong totals; we batch below.
          writePromises.push(this.addPortfolioPosition(uid, updatedPosition, true));
        } else {
          // No quote: don't show stale Firestore price - use cost basis so we never display old market price
          updatedPositions.push({
            ...position,
            currentPrice: position.avgPrice,
            totalValue: position.shares * position.avgPrice,
            totalReturn: 0,
            returnPercentage: 0,
            previousClose: undefined,
          });
        }
      }

      // Write updated positions first, then compute account totals from cash + invested value.
      await Promise.all(writePromises);
      const investedValue = updatedPositions.reduce((sum, p) => sum + p.totalValue, 0);
      const totalPortfolioValue = Math.max(0, cash) + investedValue;
      const allTimeReturn = totalPortfolioValue - STARTING_CASH;
      await this.updateUserProfile(uid, {
        totalPortfolioValue,
        totalReturn: allTimeReturn,
        cash: Math.max(0, cash),
      });

      return updatedPositions;
    } catch (error) {
      console.error('Error refreshing portfolio prices:', error);
      return positions ?? [];
    }
  }

  // Add trading history
  async addTradingHistory(uid: string, trade: Omit<TradingHistory, 'id' | 'timestamp'>): Promise<string> {
    try {
      const historyRef = collection(db, 'users', uid, 'tradingHistory');
      const docRef = await addDoc(historyRef, {
        ...trade,
        timestamp: serverTimestamp()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding trading history:', error);
      throw error;
    }
  }

  // Get user trading history
  async getUserTradingHistory(uid: string, limit: number = 50): Promise<TradingHistory[]> {
    try {
      const historyRef = collection(db, 'users', uid, 'tradingHistory');
      const q = query(historyRef, orderBy('timestamp', 'desc'), firestoreLimit(limit));
      const historySnap = await getDocs(q);
      
      const history: TradingHistory[] = [];
      historySnap.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() } as TradingHistory);
      });
      
      return history;
    } catch (error) {
      console.error('Error getting trading history:', error);
      throw error;
    }
  }

  /** Realized P/L from sell trades (for backend total = STARTING_CASH + unrealized + realized). */
  async getRealizedPnL(uid: string): Promise<number> {
    const history = await this.getUserTradingHistory(uid, 100);
    const sellTrades = history.filter((t) => t.action === 'sell');
    return sellTrades.reduce((sum, sellTrade) => {
      const buyTrades = history.filter(
        (bt) => bt.symbol === sellTrade.symbol && bt.action === 'buy' && tradeTime(bt) < tradeTime(sellTrade)
      );
      if (buyTrades.length === 0) return sum;
      const avgBuyPrice = buyTrades.reduce((s, bt) => s + bt.price, 0) / buyTrades.length;
      const pnl = (sellTrade.price - avgBuyPrice) * sellTrade.shares - (sellTrade.fees || 0);
      return sum + pnl;
    }, 0);
  }

  // Get leaderboard - ranked by portfolio value (total money)
  async getLeaderboard(limit: number = LEADERBOARD_LIMIT): Promise<LeaderboardEntry[]> {
    const usersRef = collection(db, 'users');
    /** Firestore `orderBy(totalPortfolioValue)` omits docs without that field; merge a broad read when short. */
    const mergeFetchCap = 2000;

    const docsToLeaderboard = (docs: QueryDocumentSnapshot[]) => {
      const leaderboard: LeaderboardEntry[] = [];
      for (const d of docs) {
        const userData = d.data() as UserProfile;
        leaderboard.push({
          uid: userData.uid,
          username: userData.username,
          displayName: userData.displayName,
          totalReturn: userData.totalReturn ?? 0,
          totalPortfolioValue: userData.totalPortfolioValue ?? 0,
          rank: 0,
          lastUpdated: userData.lastLoginAt,
          tags: userData.tags ?? [],
          customBadges: userData.customBadges
        });
      }
      leaderboard.sort((a, b) => b.totalPortfolioValue - a.totalPortfolioValue);
      leaderboard.forEach((entry, i) => { entry.rank = i + 1; });
      return leaderboard.slice(0, limit);
    };

    try {
      const q = query(usersRef, orderBy('totalPortfolioValue', 'desc'), firestoreLimit(limit));
      const usersSnap = await getDocs(q);
      if (usersSnap.size >= limit) {
        return docsToLeaderboard(usersSnap.docs);
      }
      const byId = new Map<string, QueryDocumentSnapshot>();
      usersSnap.docs.forEach((d) => byId.set(d.id, d));
      const q2 = query(usersRef, firestoreLimit(mergeFetchCap));
      const snap2 = await getDocs(q2);
      snap2.forEach((d) => {
        if (!byId.has(d.id)) byId.set(d.id, d);
      });
      return docsToLeaderboard(Array.from(byId.values()));
    } catch {
      const q = query(usersRef, firestoreLimit(mergeFetchCap));
      const usersSnap = await getDocs(q);
      return docsToLeaderboard(usersSnap.docs);
    }
  }

  // Update user portfolio value from account state: total = cash + invested positions.
  private async updateUserPortfolioValue(uid: string): Promise<void> {
    try {
      const { referralService } = await import('./referralService');
      await referralService.reconcileReferralBonusCash(uid);

      const profile = await this.getUserProfile(uid);
      if (!profile) return;

      const portfolio = await this.getUserPortfolio(uid, false);
      const investedValue = portfolio.reduce((sum, p) => sum + p.totalValue, 0);
      const currentTotal = profile.totalPortfolioValue || 10000;
      const cash = profile.cash != null ? profile.cash : currentTotal - investedValue;
      const totalPortfolioValue = Math.max(0, cash) + investedValue;
      const allTimeReturn = totalPortfolioValue - STARTING_CASH;
      await this.updateUserProfile(uid, {
        totalPortfolioValue,
        totalReturn: allTimeReturn,
        cash: Math.max(0, cash),
      });
    } catch (error) {
      console.error('Error updating portfolio value:', error);
      throw error;
    }
  }

  /** Date string YYYY-MM-DD for snapshot doc id and querying. */
  private toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Save a daily portfolio value snapshot for accurate period returns (YTD, 1W, 1M, 1Y).
   * Call after portfolio load or after trades. One doc per day: users/{uid}/portfolioSnapshots/{YYYY-MM-DD}.
   */
  async savePortfolioSnapshot(uid: string, totalPortfolioValue: number): Promise<void> {
    try {
      const dateStr = this.toDateStr(new Date());
      const ref = doc(db, 'users', uid, 'portfolioSnapshots', dateStr);
      await setDoc(ref, { date: dateStr, totalPortfolioValue }, { merge: true });
    } catch (error) {
      console.warn('Failed to save portfolio snapshot:', error);
    }
  }

  /**
   * Get the most recent portfolio snapshot on or before asOfDate. Returns null if none.
   * Used for accurate period returns when available.
   * Note: Firestore may require a composite index on (date). If you see an index error, create the index from the link in the error message.
   */
  async getPortfolioSnapshotOnOrBefore(uid: string, asOfDate: Date): Promise<number | null> {
    try {
      const asOfStr = this.toDateStr(asOfDate);
      const ref = collection(db, 'users', uid, 'portfolioSnapshots');
      const q = query(
        ref,
        where('date', '<=', asOfStr),
        orderBy('date', 'desc'),
        firestoreLimit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const data = snap.docs[0].data();
      return typeof data.totalPortfolioValue === 'number' ? data.totalPortfolioValue : null;
    } catch (error) {
      console.warn('Failed to get portfolio snapshot:', error);
      return null;
    }
  }

  // Search users by name
  async searchUsers(searchTerm: string, limit: number = 20): Promise<UserProfile[]> {
    try {
      const usersRef = collection(db, 'users');
      // Note: Firestore doesn't support full-text search, so we'll search by displayName prefix
      const q = query(
        usersRef, 
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        firestoreLimit(limit)
      );
      const usersSnap = await getDocs(q);
      
      const users: UserProfile[] = [];
      usersSnap.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      
      return users;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  // Check if username is available
  async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty;
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    }
  }

  // Generate a unique username from display name
  private generateUsername(displayName: string): string {
    const base = displayName.toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove special characters
      .substring(0, 15); // Limit length
    
    if (base.length === 0) return 'user' + Math.floor(Math.random() * 10000);
    
    return base + Math.floor(Math.random() * 1000);
  }

  // Resolve username → profile fields for sign-in (works while logged out via loginUsernames).
  async getUserByUsername(username: string): Promise<UserProfile> {
    const keys = this.loginUsernameDocKeys(username);
    if (keys.length === 0) {
      throw new UsernameLookupError('not_found', 'Enter a valid username.');
    }
    try {
      for (const key of keys) {
        const snap = await getDoc(doc(db, LOGIN_USERNAMES_COLLECTION, key));
        if (!snap.exists()) continue;
        const d = snap.data();
        const email = typeof d.email === 'string' ? d.email.trim() : '';
        if (!email.includes('@')) continue;
        const uid = typeof d.uid === 'string' ? d.uid : '';
        if (!uid) continue;
        return {
          uid,
          username: typeof d.username === 'string' ? d.username : username,
          displayName: '',
          email,
          isVerified: false,
          tags: [],
        } as UserProfile;
      }
      throw new UsernameLookupError(
        'not_found',
        'No account found for that username. If you already have an account, sign in with your email once - that links your username for next time. New signups are linked automatically.'
      );
    } catch (error: unknown) {
      if (error instanceof UsernameLookupError) throw error;
      console.error('Error getting user by username:', error);
      const code = (error as { code?: string })?.code;
      if (code === 'permission-denied') {
        throw new UsernameLookupError(
          'rules_blocked',
          'Username sign-in is blocked: Firestore rules must allow reading loginUsernames (public get). Deploy simvest/firestore.rules (npm run deploy:firestore-rules), or sign in with your email.'
        );
      }
      if (code === 'unavailable') {
        throw new UsernameLookupError('network', 'Network error while looking up username. Try again.');
      }
      throw new UsernameLookupError(
        'unknown',
        error instanceof Error ? error.message : 'Username lookup failed.'
      );
    }
  }

  // Tag management functions
  async addUserTag(uid: string, tag: string): Promise<void> {
    try {
      const userProfile = await this.getUserProfile(uid);
      if (!userProfile) throw new Error('User not found');
      
      const updatedTags = [...new Set([...userProfile.tags, tag])]; // Remove duplicates
      await this.updateUserProfile(uid, { tags: updatedTags });
      
      console.log(`Added tag "${tag}" to user ${uid}`);
    } catch (error) {
      console.error('Error adding user tag:', error);
      throw error;
    }
  }

  async removeUserTag(uid: string, tag: string): Promise<void> {
    try {
      const userProfile = await this.getUserProfile(uid);
      if (!userProfile) throw new Error('User not found');
      
      const updatedTags = userProfile.tags.filter(t => t !== tag);
      await this.updateUserProfile(uid, { tags: updatedTags });
      
      console.log(`Removed tag "${tag}" from user ${uid}`);
    } catch (error) {
      console.error('Error removing user tag:', error);
      throw error;
    }
  }

  async setUserTags(uid: string, tags: string[]): Promise<void> {
    try {
      await this.updateUserProfile(uid, { tags });
      console.log(`Set tags for user ${uid}:`, tags);
    } catch (error) {
      console.error('Error setting user tags:', error);
      throw error;
    }
  }

  // Get all users with a specific tag
  async getUsersByTag(tag: string, limit: number = 50): Promise<UserProfile[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('tags', 'array-contains', tag), firestoreLimit(limit));
      const usersSnap = await getDocs(q);
      
      const users: UserProfile[] = [];
      usersSnap.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      
      return users;
    } catch (error) {
      console.error('Error getting users by tag:', error);
      return [];
    }
  }
}

export const userService = new UserService();
export default userService;
