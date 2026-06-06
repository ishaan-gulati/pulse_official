/**
 * Reset referral leaderboard stats: sets referrals/{uid} totalReferrals and totalEarned to 0.
 * By default also deletes all referralClaims so pending invites do not pay out again after a reset.
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
 *   cd simvest && npm run reset:referral-stats
 *
 * Dry run:
 *   DRY_RUN=1 npm run reset:referral-stats
 *
 * Keep pending claims (not recommended unless you know why):
 *   CLEAR_CLAIMS=0 npm run reset:referral-stats
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath || !existsSync(resolve(credPath))) {
  console.error(
    'Set GOOGLE_APPLICATION_CREDENTIALS to the absolute path of your Firebase service account JSON.'
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(resolve(credPath), 'utf8'))),
});

const db = admin.firestore();
const FieldPath = admin.firestore.FieldPath;
const FieldValue = admin.firestore.FieldValue;

const PAGE_SIZE = 400;
const BATCH_MAX = 400;
const dryRun = process.env.DRY_RUN === '1';
const clearClaims = process.env.CLEAR_CLAIMS !== '0';

async function resetReferralDocs() {
  let lastDoc = null;
  let count = 0;

  for (;;) {
    let q = db.collection('referrals').orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    let batch = db.batch();
    let ops = 0;

    const flush = async () => {
      if (ops === 0) return;
      if (!dryRun) await batch.commit();
      batch = db.batch();
      ops = 0;
    };

    for (const d of snap.docs) {
      lastDoc = d;
      count++;
      batch.set(
        d.ref,
        {
          totalReferrals: 0,
          totalEarned: 0,
          lastReferralAt: FieldValue.delete(),
        },
        { merge: true }
      );
      ops++;
      if (ops >= BATCH_MAX) await flush();
    }
    await flush();
  }

  console.log(dryRun ? `[dry-run] Would reset ${count} referrals/* docs` : `Reset ${count} referrals/* docs`);
}

async function deleteAllReferralClaims() {
  let deleted = 0;
  if (dryRun) {
    let last = null;
    for (;;) {
      let q = db.collection('referralClaims').orderBy(FieldPath.documentId()).limit(500);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;
      deleted += snap.docs.length;
      last = snap.docs[snap.docs.length - 1];
    }
    console.log(`[dry-run] Would delete ${deleted} referralClaims docs`);
    return;
  }
  for (;;) {
    const snap = await db.collection('referralClaims').limit(500).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.docs.length;
  }
  console.log(`Deleted ${deleted} referralClaims docs`);
}

async function main() {
  console.log(
    dryRun ? 'DRY RUN - no writes' : 'LIVE',
    clearClaims ? '(clearing referralClaims)' : '(keeping referralClaims - stale claims may pay again)'
  );
  await resetReferralDocs();
  if (clearClaims) await deleteAllReferralClaims();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
