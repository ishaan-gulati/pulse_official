/**
 * Shared Finnhub API rate limit (free tier: 60 calls/minute).
 * Single key only.
 */

interface Tracker {
  calls: number;
  windowStart: number;
  isRateLimited: boolean;
}

const ONE_MINUTE_MS = 60_000;
export const FINNHUB_LIMIT_PER_MINUTE = 60;
export const FINNHUB_SAFE_THRESHOLD = 55; // stop before 60 to avoid 429s

const trackers: Tracker[] = [
  { calls: 0, windowStart: Date.now(), isRateLimited: false },
];

function refreshWindow(index: number): void {
  const now = Date.now();
  const t = trackers[index];
  if (!t) return;
  if (now - t.windowStart >= ONE_MINUTE_MS) {
    t.calls = 0;
    t.windowStart = now;
    t.isRateLimited = false;
  }
}

/** True if the key is under the safe limit (so we can make a request). */
export function canMakeFinnhubRequest(): boolean {
  refreshWindow(0);
  return trackers[0].calls < FINNHUB_SAFE_THRESHOLD && !trackers[0].isRateLimited;
}

/** True if single key (tracker 0) is under the safe limit. Use for quote-only key. */
export function canMakeFinnhubRequestKey0(): boolean {
  refreshWindow(0);
  return trackers[0].calls < FINNHUB_SAFE_THRESHOLD && !trackers[0].isRateLimited;
}

/** True if single key (tracker 0) is at limit. Use for quote-only key. */
export function isFinnhubRateLimitedKey0(): boolean {
  refreshWindow(0);
  return trackers[0].calls >= FINNHUB_SAFE_THRESHOLD || trackers[0].isRateLimited;
}

/** Returns 0 if key is available, -1 if at limit. */
export function pickFinnhubKeyIndex(): number {
  refreshWindow(0);
  return trackers[0].calls < FINNHUB_SAFE_THRESHOLD && !trackers[0].isRateLimited ? 0 : -1;
}

export function recordFinnhubCall(keyIndex: number): void {
  if (keyIndex === 0 && trackers[0]) trackers[0].calls++;
}

export function isFinnhubRateLimited(): boolean {
  refreshWindow(0);
  return trackers[0].calls >= FINNHUB_SAFE_THRESHOLD || trackers[0].isRateLimited;
}

export function markFinnhubRateLimited(keyIndex: number): void {
  if (keyIndex === 0 && trackers[0]) trackers[0].isRateLimited = true;
}

export function getFinnhubRateLimitStatus(): { calls: number; isRateLimited: boolean; timeUntilReset: number } {
  refreshWindow(0);
  const t = trackers[0];
  const now = Date.now();
  return {
    calls: t?.calls ?? 0,
    isRateLimited: t?.isRateLimited ?? false,
    timeUntilReset: t ? Math.max(0, ONE_MINUTE_MS - (now - t.windowStart)) : 0,
  };
}

/** Reset rate limit state (e.g. when app comes to foreground) so next requests can go through. */
export function resetFinnhubRateLimit(): void {
  const now = Date.now();
  trackers[0] = { calls: 0, windowStart: now, isRateLimited: false };
}
