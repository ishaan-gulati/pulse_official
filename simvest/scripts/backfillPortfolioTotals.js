#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * One-time migration: enforce portfolio totals as
 * totalPortfolioValue = cash + sum(portfolio.totalValue)
 * totalReturn = totalPortfolioValue - STARTING_CASH
 *
 * Usage:
 *   node scripts/backfillPortfolioTotals.js --service-account ./service-account.json
 *   node scripts/backfillPortfolioTotals.js --service-account ./service-account.json --dry-run
 *   node scripts/backfillPortfolioTotals.js --service-account ./service-account.json --verify-only
 *   node scripts/backfillPortfolioTotals.js --service-account ./service-account.json --uid <firebaseUid>
 *   node scripts/backfillPortfolioTotals.js --service-account ./service-account.json --uid <firebaseUid> --dry-run
 *   node scripts/backfillPortfolioTotals.js --service-account ./service-account.json --username nikki
 *   (Resolves UID via loginUsernames + users.username, same as the app.)
 */

const path = require('path');
const fs = require('fs');

const STARTING_CASH = 10000;
const BATCH_LIMIT = 300;
const EPS = 0.0001;

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, true);
    } else {
      args.set(key, next);
      i++;
    }
  }
  return args;
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function nearEqual(a, b, eps = EPS) {
  return Math.abs(a - b) <= eps;
}

function resolveServiceAccountPath(args) {
  const provided = args.get('service-account');
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const candidate = provided || envPath;
  if (!candidate) {
    throw new Error(
      'Missing service account path. Pass --service-account <path> or set GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }
  const abs = path.resolve(process.cwd(), candidate);
  if (!fs.existsSync(abs)) {
    throw new Error(`Service account file not found: ${abs}`);
  }
  return abs;
}

const LOGIN_USERNAMES_COLLECTION = 'loginUsernames';

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

/**
 * Resolve Firebase Auth UID from app username (loginUsernames lookup, then users.username).
 */
async function resolveUidFromUsername(db, raw) {
  for (const docId of loginUsernameDocKeys(raw)) {
    const snap = await db.collection(LOGIN_USERNAMES_COLLECTION).doc(docId).get();
    if (snap.exists) {
      const uid = snap.data()?.uid;
      if (typeof uid === 'string' && uid.length > 0) return uid;
    }
  }
  const trimmed = raw.trim();
  const q1 = await db.collection('users').where('username', '==', trimmed).limit(5).get();
  if (!q1.empty) {
    if (q1.size > 1) throw new Error('Multiple users with username == exact string');
    return q1.docs[0].id;
  }
  const key = normalizeLoginUsername(raw);
  const q2 = await db.collection('users').where('username', '==', key).limit(5).get();
  if (!q2.empty) {
    if (q2.size > 1) throw new Error('Multiple users with username == normalized key');
    return q2.docs[0].id;
  }
  throw new Error(`No user found for username: ${raw}`);
}

async function initAdmin(serviceAccountPath) {
  const admin = require(path.resolve(
    __dirname,
    '..',
    'functions',
    'node_modules',
    'firebase-admin'
  ));
  if (admin.apps.length === 0) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin.firestore();
}

async function collectUsers(db, singleUid) {
  if (singleUid) {
    const ref = db.collection('users').doc(singleUid);
    const doc = await ref.get();
    if (!doc.exists) {
      throw new Error(`users/${singleUid} does not exist`);
    }
    return [doc];
  }
  const users = [];
  let last = null;
  while (true) {
    let q = db.collection('users').orderBy('__name__').limit(BATCH_LIMIT);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    users.push(...snap.docs);
    last = snap.docs[snap.docs.length - 1];
  }
  return users;
}

async function recomputeUser(db, userDoc, verifyOnly, dryRun) {
  const uid = userDoc.id;
  const u = userDoc.data() || {};
  const oldTotal = toNum(u.totalPortfolioValue, STARTING_CASH);

  const portfolioSnap = await db.collection('users').doc(uid).collection('portfolio').get();
  let invested = 0;
  portfolioSnap.forEach((d) => {
    invested += toNum(d.data()?.totalValue, 0);
  });

  // Preserve legacy users with no explicit cash by deriving from previous totals.
  const derivedCash = oldTotal - invested;
  const cash = u.cash != null ? toNum(u.cash, 0) : derivedCash;
  const normalizedCash = Math.max(0, cash);
  const newTotal = normalizedCash + invested;
  const newReturn = newTotal - STARTING_CASH;

  const changed =
    !nearEqual(oldTotal, newTotal) ||
    !nearEqual(toNum(u.totalReturn, newReturn), newReturn) ||
    !nearEqual(toNum(u.cash, normalizedCash), normalizedCash);

  if (!verifyOnly && !dryRun && changed) {
    await db.collection('users').doc(uid).update({
      totalPortfolioValue: newTotal,
      totalReturn: newReturn,
      cash: normalizedCash,
    });
  }

  return {
    uid,
    changed,
    oldTotal,
    newTotal,
    cash: normalizedCash,
    invested,
  };
}

async function pass(db, { verifyOnly, dryRun, printMismatches = 5, uid }) {
  const users = await collectUsers(db, uid);
  let changedCount = 0;
  let mismatchCount = 0;
  const samples = [];

  for (const doc of users) {
    const r = await recomputeUser(db, doc, verifyOnly, dryRun);
    if (r.changed) {
      changedCount++;
      mismatchCount++;
      if (samples.length < printMismatches) samples.push(r);
    }
  }

  return {
    usersScanned: users.length,
    changedCount: verifyOnly ? 0 : changedCount,
    mismatchCount,
    samples,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = Boolean(args.get('dry-run'));
  const verifyOnly = Boolean(args.get('verify-only'));
  let uid = typeof args.get('uid') === 'string' ? args.get('uid').trim() : '';
  const usernameArg =
    typeof args.get('username') === 'string' ? args.get('username').trim() : '';
  if (usernameArg && uid) {
    throw new Error('Use only one of --uid or --username');
  }
  const serviceAccountPath = resolveServiceAccountPath(args);
  const db = await initAdmin(serviceAccountPath);

  if (usernameArg) {
    uid = await resolveUidFromUsername(db, usernameArg);
    console.log(JSON.stringify({ resolvedFromUsername: usernameArg, uid }, null, 2));
  }

  console.log(
    JSON.stringify(
      {
        mode: verifyOnly ? 'verify-only' : dryRun ? 'dry-run' : 'write',
        uid: uid || null,
      },
      null,
      2
    )
  );

  // Pass 1: write (or dry run / verify-only)
  const p1 = await pass(db, { verifyOnly, dryRun, uid: uid || undefined });
  console.log(JSON.stringify({ pass: 1, ...p1 }, null, 2));

  // Pass 2: verify
  const p2 = await pass(db, { verifyOnly: true, dryRun: false, uid: uid || undefined });
  console.log(JSON.stringify({ pass: 2, verifyOnly: true, ...p2 }, null, 2));

  // Pass 3: verify again (multiple checks)
  const p3 = await pass(db, { verifyOnly: true, dryRun: false, uid: uid || undefined });
  console.log(JSON.stringify({ pass: 3, verifyOnly: true, ...p3 }, null, 2));

  if (!verifyOnly && !dryRun && (p2.mismatchCount > 0 || p3.mismatchCount > 0)) {
    process.exitCode = 2;
    console.error(
      'Backfill completed but verification still found mismatches. Re-run and inspect samples.'
    );
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err?.message || err);
  process.exit(1);
});

