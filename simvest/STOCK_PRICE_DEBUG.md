# Where real-time stock price can fail

When the price shows "..." or never loads, the flow is:

**UI:** `SearchScreen.tsx` line **73** → `tradingService.getCurrentPrice(selected)`  
**Service:** `tradingService.ts` line **13** → `stockPriceService.getCurrentPrice(symbol)`  
**Source:** `stockPriceService.ts` line **135** → `this.getQuote(symbol)` returns `null` → so `getCurrentPrice` returns `null`  
**UI:** `SearchScreen.tsx` lines **74–76** → `if (price !== null) setCurrentPrice(price)` → when `null`, state never updates → you see "..." (line **518**).

So the real-time price "not loading" means **`stockPriceService.getQuote()` is returning `null`**. These are the only places it does:

---

## 1. No API key (prices disabled)

**File:** `src/services/stockPriceService.ts`  
**Lines:** **69–71**

```ts
if (!this.apiKey || !this.useRealPrices) {
  const stale = priceCache.get(upperSymbol);
  return stale && now - stale.timestamp < CACHE_MAX_AGE_MS ? stale.data : null;
}
```

- **When:** `API_KEYS.FINNHUB_API_KEY` and `API_KEYS.FINNHUB_API_KEY_2` are both empty/missing (see `src/config/apiKeys.ts`).
- **Result:** No request is sent; you get `null` unless there’s fresh-enough cache.

---

## 2. Rate limited (no request sent)

**File:** `src/services/stockPriceService.ts`  
**Lines:** **74–77**

```ts
if (!skipRateLimitCheck && !this.canMakeRequest()) {
  const stale = priceCache.get(upperSymbol);
  return stale && now - stale.timestamp < CACHE_MAX_AGE_MS ? stale.data : null;
}
```

- **When:** `canMakeFinnhubRequest()` is false (both keys at or over limit in `src/services/finnhubRateLimit.ts`: 55 calls/min per key, or `isRateLimited` set after a 429).
- **Result:** No request; `null` unless cache is fresh.

---

## 3. No token / both keys at limit

**File:** `src/services/stockPriceService.ts`  
**Lines:** **79–84**

```ts
const keyIndex = pickFinnhubKeyIndex();
const token = keyIndex === 0 ? API_KEYS.FINNHUB_API_KEY : API_KEYS.FINNHUB_API_KEY_2;
if (keyIndex === -1 || !token) {
  const stale = priceCache.get(upperSymbol);
  return stale && now - stale.timestamp < CACHE_MAX_AGE_MS ? stale.data : null;
}
```

- **When:** `pickFinnhubKeyIndex()` returns `-1` (both keys over safe threshold) or the chosen token is empty.
- **Result:** No request; `null` unless cache is fresh.

---

## 4. Finnhub returns invalid/zero price (main API “success” path that still yields no price)

**File:** `src/services/stockPriceService.ts`  
**Lines:** **90–91** and **117–118**

```ts
if (response.data && response.data.c !== null && response.data.c !== 0) {
  // ... build quote and return
}
// If we get here, API said "no price" (e.g. market closed, bad symbol)
const stale = priceCache.get(upperSymbol);
return stale && Date.now() - stale.timestamp < CACHE_MAX_AGE_MS ? stale.data : null;
```

- **When:** Request succeeds but `response.data.c` is `null` or `0` (e.g. market closed, symbol not supported by Finnhub, or bad symbol like some Yahoo-style symbols).
- **Result:** We don’t cache this response and return `null` unless we have fresh cache.
- **Note:** Symbols such as `BTC-USD`, `GC=F`, `SI=F` are Yahoo-style; Finnhub often expects different symbols (e.g. `BINANCE:BTCUSDT`). For those, this branch often runs and you get `null`.

---

## 5. Network error or 429

**File:** `src/services/stockPriceService.ts`  
**Lines:** **119–127** (catch block)

```ts
} catch (error: any) {
  if (error?.response?.status === 429) {
    markFinnhubRateLimited(keyIndex);
  } else if (error?.response?.status !== 429) {
    console.error(`Error fetching quote for ${upperSymbol}:`, error?.message || error);
  }
  const stale = priceCache.get(upperSymbol);
  return stale && Date.now() - stale.timestamp < CACHE_MAX_AGE_MS ? stale.data : null;
}
```

- **When:** Request throws (network error, timeout, or 429 from Finnhub).
- **Result:** After marking rate limit on 429 or logging otherwise, we return `null` unless there’s fresh cache.

---

## Summary: exact failure points

| # | File | Lines | Reason you get no price |
|---|------|--------|--------------------------|
| 1 | `src/services/stockPriceService.ts` | 69–71 | No Finnhub API key |
| 2 | `src/services/stockPriceService.ts` | 74–77 | Rate limited (`canMakeRequest()` false) |
| 3 | `src/services/stockPriceService.ts` | 80–84 | No token / both keys at limit (`keyIndex === -1` or no token) |
| 4 | `src/services/stockPriceService.ts` | 90–91, 117–118 | Finnhub returns `c === null` or `c === 0` (bad symbol / market closed) |
| 5 | `src/services/stockPriceService.ts` | 119–127 | Request failed (network/429) |

The place you see “not loading” in the UI is **`SearchScreen.tsx` line 518**: `currentPrice` stays `null` because `getCurrentPrice` (and thus `getQuote`) returned `null` at one of the spots above.
