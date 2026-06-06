import { userService } from './userService';
import type { UserProfile } from './userService';
import { db } from '../config/firebase';
import { STARTING_CASH } from '../constants/theme';
import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  writeBatch,
  Timestamp,
  onSnapshot,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

/** Cash bonus for the referrer when a claim is processed. */
export const REFERRAL_BONUS_REFERRER = 200;
/** Cash bonus for the new user when they sign up with a valid code. */
export const REFERRAL_BONUS_NEW_USER = 200;

const REFERRAL_CLAIMS = 'referralClaims';

/**
 * Dollars in `referrals.totalEarned` not yet reflected in `users.referralBonusCreditedTotal` (and thus cash).
 * When this is > 0, `reconcileReferralBonusCash` should add the gap to the user wallet.
 */
export function computeReferralGap(
  profile: Pick<UserProfile, 'referralBonusCreditedTotal'>,
  totalEarnedFromReferralsDoc: number
): number {
  const credited = Number(profile.referralBonusCreditedTotal ?? 0);
  const earned = Number(totalEarnedFromReferralsDoc);
  if (!Number.isFinite(earned) || earned < 0) return 0;
  return Math.max(0, earned - credited);
}

function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s/g, '');
}

class ReferralService {
  async generateReferralCode(uid: string): Promise<string> {
    try {
      const userProfile = await userService.getUserProfile(uid);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const code = (userProfile.username?.toUpperCase() || uid.substring(0, 8).toUpperCase()).replace(/\s/g, '');

      const referralRef = doc(db, 'referrals', uid);
      await setDoc(
        referralRef,
        {
          uid,
          code,
          createdAt: serverTimestamp(),
          totalReferrals: 0,
          totalEarned: 0,
        },
        { merge: true }
      );

      const codeRef = doc(db, 'referralCodes', code);
      await setDoc(
        codeRef,
        {
          uid,
          code,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      return code;
    } catch (error) {
      console.error('Error generating referral code:', error);
      throw error;
    }
  }

  async getReferralCode(uid: string): Promise<string | null> {
    try {
      const referralRef = doc(db, 'referrals', uid);
      const referralDoc = await getDoc(referralRef);

      if (referralDoc.exists()) {
        const code = referralDoc.data().code || null;
        if (code) {
          const codeRef = doc(db, 'referralCodes', code.toUpperCase().replace(/\s/g, ''));
          await setDoc(
            codeRef,
            { uid, code: code.toUpperCase(), createdAt: serverTimestamp() },
            { merge: true }
          );
          return code;
        }
      }

      return await this.generateReferralCode(uid);
    } catch (error) {
      console.error('Error getting referral code:', error);
      return null;
    }
  }

  /**
   * Invitee: record referredBy + bonus on own profile and queue a claim for the referrer to process.
   */
  async applyReferralCode(
    newUserUid: string,
    referralCode: string
  ): Promise<{ success: boolean; message: string }> {
    const code = normalizeReferralCode(referralCode);
    if (!code) {
      return { success: false, message: 'Please enter a referral code' };
    }

    try {
      const userRef = doc(db, 'users', newUserUid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists() && userDoc.data().referredBy) {
        return { success: false, message: 'Referral code already used' };
      }

      const referralDataRef = doc(db, 'referralCodes', code);
      const referralDataDoc = await getDoc(referralDataRef);

      if (!referralDataDoc.exists()) {
        return { success: false, message: 'Invalid referral code' };
      }

      const referrerUid = referralDataDoc.data().uid as string;

      if (referrerUid === newUserUid) {
        return { success: false, message: 'Cannot use your own referral code' };
      }

      const profile = await userService.getUserProfile(newUserUid);
      if (!profile) {
        return { success: false, message: 'Profile not ready. Try again in a moment.' };
      }
      const portfolio = await userService.getUserPortfolio(newUserUid, false);
      const investedValue = portfolio.reduce((sum, p) => sum + p.totalValue, 0);
      const total = profile.totalPortfolioValue ?? 10000;
      const currentCash = profile.cash != null ? profile.cash : total - investedValue;
      const newCash = currentCash + REFERRAL_BONUS_NEW_USER;
      const newTotal = newCash + investedValue;
      const newTotalReturn = newTotal - STARTING_CASH;

      const batch = writeBatch(db);
      const claimRef = doc(collection(db, REFERRAL_CLAIMS));
      batch.set(claimRef, {
        newUserUid,
        referrerUid,
        code,
        processed: false,
        createdAt: serverTimestamp(),
      });
      batch.update(userRef, {
        referredBy: referrerUid,
        referralCode: code,
        totalPortfolioValue: newTotal,
        cash: newCash,
        totalReturn: newTotalReturn,
        lastLoginAt: serverTimestamp(),
      });
      await batch.commit();

      return {
        success: true,
        message: `Referral applied! You received ${REFERRAL_BONUS_NEW_USER} bonus cash. Your referrer gets ${REFERRAL_BONUS_REFERRER} bonus cash too.`,
      };
    } catch (error) {
      console.error('Error applying referral code:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to apply referral code',
      };
    }
  }

  /**
   * Referrer: pay out pending bonuses and delete claims (must run as referrer).
   */
  async processPendingReferralClaims(referrerUid: string): Promise<number> {
    let paid = 0;
    try {
      const q = query(collection(db, REFERRAL_CLAIMS), where('referrerUid', '==', referrerUid));
      const snap = await getDocs(q);

      for (const claimDoc of snap.docs) {
        const data = claimDoc.data();
        if (data.processed === true) continue;

        let investedValue = 0;
        try {
          const portfolio = await userService.getUserPortfolio(referrerUid, false);
          investedValue = portfolio.reduce((sum, p) => sum + p.totalValue, 0);
        } catch (e) {
          console.warn('processPendingReferralClaims: portfolio read failed, using 0 invested', e);
        }

        const claimRef = claimDoc.ref;
        const userRef = doc(db, 'users', referrerUid);
        const referrerRef = doc(db, 'referrals', referrerUid);

        try {
          const didPay = await runTransaction(db, async (transaction) => {
            const claimSnap = await transaction.get(claimRef);
            if (!claimSnap.exists()) return false;
            const c = claimSnap.data();
            if (c.processed === true) return false;

            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) return false;

            const u = userSnap.data() as Record<string, unknown>;
            const total = (u.totalPortfolioValue as number) || 0;
            const currentCash =
              u.cash != null ? (u.cash as number) : total - investedValue;
            const newCash = currentCash + REFERRAL_BONUS_REFERRER;
            const newTotal = newCash + investedValue;
            const newTotalReturn = newTotal - STARTING_CASH;
            const prevCredited = Number(u.referralBonusCreditedTotal ?? 0);

            const refSnap = await transaction.get(referrerRef);
            const prev = refSnap.exists() ? refSnap.data() : {};
            const totalReferrals = (prev.totalReferrals as number) || 0;
            const totalEarned = (prev.totalEarned as number) || 0;

            transaction.update(userRef, {
              cash: newCash,
              totalPortfolioValue: newTotal,
              totalReturn: newTotalReturn,
              referralBonusCreditedTotal: prevCredited + REFERRAL_BONUS_REFERRER,
            });

            const statsPayload: Record<string, unknown> = {
              uid: referrerUid,
              totalReferrals: totalReferrals + 1,
              totalEarned: totalEarned + REFERRAL_BONUS_REFERRER,
              lastReferralAt: Timestamp.now(),
            };
            if (prev.code != null) statsPayload.code = prev.code;

            transaction.set(referrerRef, statsPayload, { merge: true });

            transaction.delete(claimRef);
            return true;
          });
          if (didPay) paid++;
        } catch (e: unknown) {
          const code =
            e && typeof e === 'object' && 'code' in e
              ? String((e as { code: unknown }).code)
              : 'unknown';
          console.error('Referral claim payout failed:', claimDoc.id, code, e);
        }
      }
    } catch (error) {
      console.error('Error processing referral claims:', error);
    }
    await this.reconcileReferralBonusCash(referrerUid);
    return paid;
  }

  /**
   * When a new referral claim is created for this user as referrer, process it immediately
   * (no waiting for the 2-minute poll). Works with Cloud Function: if the function already
   * paid and deleted the claim, this is a no-op.
   */
  subscribeReferralClaimsForReferrer(referrerUid: string, onProcessed?: () => void): Unsubscribe {
    const q = query(collection(db, REFERRAL_CLAIMS), where('referrerUid', '==', referrerUid));
    return onSnapshot(
      q,
      () => {
        this.processPendingReferralClaims(referrerUid)
          .then((n) => {
            if (n > 0) onProcessed?.();
          })
          .catch(() => {});
      },
      (err) => console.error('referralClaims listener error:', err)
    );
  }

  async registerReferralCode(uid: string, code: string): Promise<void> {
    try {
      const normalized = normalizeReferralCode(code);
      const codeRef = doc(db, 'referralCodes', normalized);
      await setDoc(
        codeRef,
        {
          uid,
          code: normalized,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error registering referral code:', error);
    }
  }

  async getReferralStats(
    uid: string,
    options?: { skipReconcile?: boolean }
  ): Promise<{ totalReferrals: number; totalEarned: number } | null> {
    try {
      if (!options?.skipReconcile) {
        await this.reconcileReferralBonusCash(uid);
      }
      const referralRef = doc(db, 'referrals', uid);
      const referralDoc = await getDoc(referralRef);

      if (referralDoc.exists()) {
        const data = referralDoc.data();
        return {
          totalReferrals: data.totalReferrals || 0,
          totalEarned: data.totalEarned || 0,
        };
      }

      return { totalReferrals: 0, totalEarned: 0 };
    } catch (error) {
      console.error('Error getting referral stats:', error);
      return null;
    }
  }

  /**
   * If `referrals.totalEarned` is ahead of cash actually credited (drift from old bugs / overwrites),
   * add the shortfall to the user's cash and totalPortfolioValue and set `referralBonusCreditedTotal`.
   *
   * Also repairs "ghost credits": `referralBonusCreditedTotal` already equals `totalEarned` but `cash`
   * never left STARTING_CASH (e.g. stats updated without wallet) - common when Cloud Function / client
   * paths get out of sync.
   */
  async reconcileReferralBonusCash(uid: string): Promise<void> {
    const referrerRef = doc(db, 'referrals', uid);
    const userRef = doc(db, 'users', uid);

    try {
      const portfolio = await userService.getUserPortfolio(uid, false);
      const invested = portfolio.reduce((sum, p) => sum + p.totalValue, 0);

      await runTransaction(db, async (transaction) => {
        const refSnap = await transaction.get(referrerRef);
        const userSnap = await transaction.get(userRef);
        if (!refSnap.exists() || !userSnap.exists()) return;

        const totalEarned = Number(refSnap.data()?.totalEarned || 0);
        const u = userSnap.data() as Record<string, unknown>;
        const credited = Number(u.referralBonusCreditedTotal ?? 0);
        const owed = totalEarned - credited;
        if (owed <= 0.01) return;

        const total = Number(u.totalPortfolioValue ?? STARTING_CASH);
        const cashBase = u.cash != null ? Number(u.cash) : total - invested;
        const newCash = Math.max(0, cashBase + owed);
        const newTotal = newCash + invested;
        const newReturn = newTotal - STARTING_CASH;

        transaction.update(userRef, {
          cash: newCash,
          totalPortfolioValue: newTotal,
          totalReturn: newReturn,
          referralBonusCreditedTotal: totalEarned,
        });
      });

      // Server read avoids stale cache missing a just-written wallet update.
      const [refServer, userServer] = await Promise.all([
        getDocFromServer(referrerRef),
        getDocFromServer(userRef),
      ]);
      if (!refServer.exists() || !userServer.exists()) return;

      const totalEarned2 = Number(refServer.data()?.totalEarned || 0);
      const u2 = userServer.data() as Record<string, unknown>;
      const credited2 = Number(u2.referralBonusCreditedTotal ?? 0);
      if (totalEarned2 < 1) return;

      const owed2 = totalEarned2 - credited2;
      if (owed2 > 0.01) return;

      if (invested > 0.01) return;

      const cashField = u2.cash != null ? Number(u2.cash) : null;
      if (cashField == null || !Number.isFinite(cashField)) return;

      const storedTotal = Number(u2.totalPortfolioValue ?? cashField);
      // Both wallet lines stuck at $10k while referrals doc says you earned bonuses → ghost credit row.
      const stuckAtStarting =
        Math.abs(cashField - STARTING_CASH) <= 0.05 && Math.abs(storedTotal - STARTING_CASH) <= 0.05;
      const expectedCash = STARTING_CASH + totalEarned2;
      const markedFullyPaid = credited2 >= totalEarned2 - 0.05;

      if (stuckAtStarting && markedFullyPaid && cashField < expectedCash - 0.05) {
        await updateDoc(userRef, {
          cash: expectedCash,
          totalPortfolioValue: expectedCash,
          totalReturn: expectedCash - STARTING_CASH,
          referralBonusCreditedTotal: totalEarned2,
        });
      }
    } catch (e) {
      console.error('reconcileReferralBonusCash failed:', uid, e);
    }
  }
}

export const referralService = new ReferralService();
export default referralService;
