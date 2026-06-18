/**
 * Export every Firebase Auth user (email is source of truth — not on public Firestore profiles).
 *
 * Setup:
 *   export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
 *   cd simvest && npm run export:users
 *
 * Custom output path:
 *   EXPORT_OUTPUT=~/Downloads/pulse-users.csv npm run export:users
 *
 * Emails only (no CSV header extras):
 *   EMAILS_ONLY=1 npm run export:users
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

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
const emailsOnly = process.env.EMAILS_ONLY === '1';
const outputPath = resolve(
  (process.env.EXPORT_OUTPUT || `pulse-auth-users-${new Date().toISOString().slice(0, 10)}.csv`).replace(
    /^~(?=$|\/)/,
    homedir()
  )
);

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function profileByUid(uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return { username: '', displayName: '' };
  const d = snap.data();
  return {
    username: typeof d.username === 'string' ? d.username : '',
    displayName: typeof d.displayName === 'string' ? d.displayName : '',
  };
}

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const res = await admin.auth().listUsers(1000, pageToken);
    users.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

async function main() {
  console.log('Fetching Firebase Auth users…');
  const authUsers = await listAllAuthUsers();
  authUsers.sort((a, b) => (a.email || '').localeCompare(b.email || ''));

  const rows = [];
  if (emailsOnly) {
    for (const u of authUsers) {
      if (u.email) rows.push(csvEscape(u.email));
    }
  } else {
    rows.push('email,uid,emailVerified,displayName,username,createdAt');
    for (const u of authUsers) {
      const profile = await profileByUid(u.uid);
      const created =
        u.metadata?.creationTime != null
          ? new Date(u.metadata.creationTime).toISOString()
          : '';
      rows.push(
        [
          csvEscape(u.email || ''),
          csvEscape(u.uid),
          csvEscape(u.emailVerified ? 'true' : 'false'),
          csvEscape(u.displayName || profile.displayName),
          csvEscape(profile.username),
          csvEscape(created),
        ].join(',')
      );
    }
  }

  writeFileSync(outputPath, rows.join('\n') + '\n', 'utf8');

  const withEmail = authUsers.filter((u) => u.email).length;
  console.log(`Exported ${authUsers.length} users (${withEmail} with email) → ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
