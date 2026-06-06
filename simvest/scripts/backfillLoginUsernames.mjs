/**
 * One-time backfill: creates/updates loginUsernames/{normalizedUsername} for every
 * Firestore users/* profile that has username + email (same shape the app expects).
 *
 * The Expo app cannot list all users (security rules). This uses the Admin SDK once.
 *
 * Before running: deploy Firestore rules so clients can read loginUsernames (public get):
 *   cd simvest && npm run deploy:firestore-rules
 *
 * Setup:
 *   1. Firebase Console → Project settings → Service accounts → Generate new private key
 *   2. Save the JSON outside the repo (never commit it)
 *   3. export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/your-key.json"
 *   4. cd simvest && npm install && npm run backfill:login-usernames
 *
 * Per-user alternative: sign in once with email + password - the app calls syncLoginUsernameLookup.
 *
 * Dry run (no writes):
 *   npm run backfill:login-usernames:dry
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

function normalizeLoginUsername(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  s = s.replace(/^@+/, '').trim();
  return s.toLowerCase();
}

const PAGE_SIZE = 400;
const BATCH_MAX = 400;
const dryRun = process.env.DRY_RUN === '1';

async function main() {
  let lastDoc = null;
  let scanned = 0;
  let written = 0;
  let skipped = 0;
  const seenKeys = new Map();

  let batch = db.batch();
  let batchOps = 0;

  const commitBatch = async () => {
    if (batchOps === 0) return;
    if (!dryRun) await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  const enqueue = async (key, data, userUid) => {
    if (dryRun) {
      written++;
      return;
    }
    batch.set(db.collection('loginUsernames').doc(key), data, { merge: true });
    batchOps++;
    if (userUid) {
      batch.set(
        db.collection('users').doc(userUid),
        { loginUsernameKey: key },
        { merge: true }
      );
      batchOps++;
    }
    written++;
    if (batchOps >= BATCH_MAX) await commitBatch();
  };

  for (;;) {
    let q = db.collection('users').orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      lastDoc = docSnap;
      scanned++;
      const d = docSnap.data();
      const uid = docSnap.id;
      const email = typeof d.email === 'string' ? d.email.trim() : '';
      const username = d.username;

      if (!username || !email.includes('@')) {
        skipped++;
        continue;
      }

      const key = normalizeLoginUsername(String(username));
      if (!key) {
        skipped++;
        continue;
      }

      const prevUid = seenKeys.get(key);
      if (prevUid && prevUid !== uid) {
        console.warn(
          `Collision on login key "${key}": was ${prevUid}, now ${uid} - last one wins in Firestore`
        );
      }
      seenKeys.set(key, uid);

      if (dryRun) {
        console.log(`[dry-run] ${key} <- uid=${uid} email=${email}`);
      }
      await enqueue(key, { uid, email, username: String(username) }, uid);
    }
  }

  await commitBatch();

  console.log(
    dryRun
      ? `Dry run done. Scanned ${scanned} profiles, would write ${written}, skipped ${skipped}.`
      : `Done. Scanned ${scanned} profiles, wrote/merged ${written} loginUsernames docs, skipped ${skipped}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
