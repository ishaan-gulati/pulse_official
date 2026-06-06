/**
 * Revokes Firebase Auth refresh tokens so clients must sign in again.
 *
 * Single user (Pulse username → loginUsernames doc):
 *   export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
 *   REVOKE_USERNAME=ishaangulati npm run revoke:all-sessions
 *
 * Dry run (single user — prints uid, no revoke):
 *   DRY_RUN=1 REVOKE_USERNAME=ishaangulati npm run revoke:all-sessions
 *
 * All users (destructive):
 *   npm run revoke:all-sessions
 *
 * Dry run (all users — count only):
 *   DRY_RUN=1 npm run revoke:all-sessions
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

const dryRun = process.env.DRY_RUN === '1';
const revokeUsername = (process.env.REVOKE_USERNAME || '').trim();

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(resolve(credPath), 'utf8'))),
});

const db = admin.firestore();

/** Same rules as userService.normalizeLoginUsername + loginUsernameDocKeys */
function normalizeLoginUsername(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  s = s.replace(/^@+/, '').trim();
  return s.toLowerCase();
}

function loginUsernameDocKeys(rawInput) {
  const key = normalizeLoginUsername(rawInput);
  if (!key) return [];
  return [...new Set([key, `@${key}`])];
}

async function resolveUidFromUsername(raw) {
  const keys = loginUsernameDocKeys(raw);
  if (keys.length === 0) {
    throw new Error('Invalid username');
  }
  for (const kid of keys) {
    const snap = await db.collection('loginUsernames').doc(kid).get();
    if (snap.exists) {
      const uid = snap.data()?.uid;
      if (typeof uid === 'string' && uid.length > 0) return uid;
    }
  }
  return null;
}

async function revokeOneUser() {
  const uid = await resolveUidFromUsername(revokeUsername);
  if (!uid) {
    console.error(`No loginUsernames mapping found for "${revokeUsername}".`);
    process.exit(1);
  }
  console.log(`Resolved "${revokeUsername}" → uid ${uid}`);
  if (dryRun) {
    console.log('DRY_RUN: would revoke refresh tokens for this user only.');
    return;
  }
  await admin.auth().revokeRefreshTokens(uid);
  console.log('Done. Revoked refresh tokens for this user.');
}

async function revokeAllUsers() {
  let nextPageToken;
  let revoked = 0;
  let page = 0;

  do {
    const listResult = await admin.auth().listUsers(1000, nextPageToken);
    page += 1;
    for (const userRecord of listResult.users) {
      if (dryRun) {
        revoked += 1;
      } else {
        await admin.auth().revokeRefreshTokens(userRecord.uid);
        revoked += 1;
      }
    }
    nextPageToken = listResult.pageToken;
    console.log(`Page ${page}: ${listResult.users.length} users (running total: ${revoked})`);
  } while (nextPageToken);

  if (dryRun) {
    console.log(`\nDRY_RUN: would revoke refresh tokens for ${revoked} users. Run without DRY_RUN=1 to apply.`);
  } else {
    console.log(`\nDone. Revoked refresh tokens for ${revoked} users.`);
  }
}

async function main() {
  if (revokeUsername) {
    await revokeOneUser();
  } else {
    await revokeAllUsers();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
