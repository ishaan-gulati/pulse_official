const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

/** Must match simvest/src/services/referralService.ts */
const REFERRAL_BONUS_REFERRER = 200;
const STARTING_CASH = 10000;

const REGION = 'us-central1';

/**
 * Credits referrer cash + stats and deletes the claim. Safe to call from trigger + retries.
 * @param {FirebaseFirestore.DocumentReference} claimRef
 */
async function payoutReferrerForClaimRef(claimRef) {
  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) {
    return { status: 'already_processed' };
  }

  const data = claimSnap.data();
  const referrerUid = data.referrerUid;
  const newUserUid = data.newUserUid;

  if (!referrerUid || !newUserUid || referrerUid === newUserUid) {
    await claimRef.delete().catch(() => {});
    return { status: 'invalid_claim_removed' };
  }
  if (data.processed === true) {
    return { status: 'noop' };
  }

  const userRef = db.collection('users').doc(referrerUid);

  let investedValue = 0;
  try {
    const portfolioSnap = await userRef.collection('portfolio').get();
    portfolioSnap.forEach((d) => {
      investedValue += d.data().totalValue || 0;
    });
  } catch (e) {
    console.error('payoutReferrerForClaimRef: portfolio read failed, using 0', e);
    investedValue = 0;
  }

  try {
    await db.runTransaction(async (tx) => {
      const claimDoc = await tx.get(claimRef);
      if (!claimDoc.exists) return;
      const c = claimDoc.data();
      if (c.processed === true) return;

      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        console.warn('payoutReferrerForClaimRef: referrer users doc missing', referrerUid);
        return;
      }
      const u = userSnap.data();
      const total = u.totalPortfolioValue || 0;
      const currentCash = u.cash != null ? u.cash : total - investedValue;
      const newCash = currentCash + REFERRAL_BONUS_REFERRER;
      const newTotal = newCash + investedValue;
      const newTotalReturn = newTotal - STARTING_CASH;
      const prevCredited = u.referralBonusCreditedTotal || 0;

      const refRef = db.collection('referrals').doc(referrerUid);
      const refSnap = await tx.get(refRef);
      const prev = refSnap.exists ? refSnap.data() : {};
      const totalReferrals = prev.totalReferrals || 0;
      const totalEarned = prev.totalEarned || 0;

      tx.update(userRef, {
        cash: newCash,
        totalPortfolioValue: newTotal,
        totalReturn: newTotalReturn,
        referralBonusCreditedTotal: prevCredited + REFERRAL_BONUS_REFERRER,
      });

      const statsPayload = {
        uid: referrerUid,
        totalReferrals: totalReferrals + 1,
        totalEarned: totalEarned + REFERRAL_BONUS_REFERRER,
        lastReferralAt: FieldValue.serverTimestamp(),
      };
      if (prev.code != null) statsPayload.code = prev.code;
      tx.set(refRef, statsPayload, { merge: true });
      tx.delete(claimRef);
    });
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? e.code : 'unknown';
    console.error('payoutReferrerForClaimRef: transaction failed', code, e);
    throw e;
  }

  return { status: 'paid' };
}

exports.onReferralClaimCreated = onDocumentCreated(
  { document: 'referralClaims/{claimId}', region: REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    try {
      await payoutReferrerForClaimRef(snap.ref);
    } catch (e) {
      console.error('onReferralClaimCreated: payout failed', e);
    }
  }
);
