/**
 * Stock Price Service
 * Uses Yahoo Finance (chart API) for quotes - no API key, no strict rate limit.
 * Same endpoint the app uses for charts; returns current/last price and previous close.
 */

import axios from 'axios';
import { getFinnhubRateLimitStatus } from './finnhubRateLimit';

export interface StockQuote {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  timestamp: number;
}

const DEBUG_PRICE_FAILURE = __DEV__;
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// 60-second in-memory cache - avoids re-fetching the same quotes on quick navigation
const CACHE_TTL_MS = 60_000;
interface CacheEntry { quote: StockQuote; expiresAt: number; }
const quoteCache = new Map<string, CacheEntry>();

class StockPriceService {
  /**
   * Fetch quote from Yahoo Finance chart API (1d candles, 5d range).
   * Last candle close = current price; previous candle close = previous close.
   */
  private async fetchYahooQuote(symbol: string): Promise<StockQuote | null> {
    const upperSymbol = symbol.toUpperCase();

    // Return cached quote if still fresh
    const cached = quoteCache.get(upperSymbol);
    if (cached && Date.now() < cached.expiresAt) return cached.quote;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${upperSymbol}?interval=1d&range=5d`;
    try {
      const response = await axios.get(url, { timeout: 8000, headers: YAHOO_HEADERS });
      const result = response.data?.chart?.result?.[0];
      if (!result?.timestamp?.length || !result?.indicators?.quote?.[0]) return null;

      const quote = result.indicators.quote[0];
      const closes = quote.close || [];
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const volumes = quote.volume || [];
      const timestamps = result.timestamp;

      // Find last non-null close as current price
      let lastIdx = closes.length - 1;
      while (lastIdx >= 0 && closes[lastIdx] == null) lastIdx--;
      if (lastIdx < 0) return null;

      const currentPrice = closes[lastIdx];

      // Find the most recent non-null close BEFORE lastIdx as previous close.
      // This correctly handles weekends/holidays where closes[lastIdx-1] may be null.
      let prevIdx = lastIdx - 1;
      while (prevIdx >= 0 && closes[prevIdx] == null) prevIdx--;
      const previousClose = prevIdx >= 0 && closes[prevIdx] != null
        ? closes[prevIdx]
        : (opens[lastIdx] ?? currentPrice);

      const change = currentPrice - previousClose;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

      const stockQuote: StockQuote = {
        symbol: upperSymbol,
        currentPrice,
        previousClose,
        change,
        changePercent,
        high: highs[lastIdx] ?? currentPrice,
        low: lows[lastIdx] ?? currentPrice,
        open: opens[lastIdx] ?? currentPrice,
        volume: volumes[lastIdx] ?? 0,
        timestamp: (timestamps[lastIdx] ?? 0) * 1000,
      };

      quoteCache.set(upperSymbol, { quote: stockQuote, expiresAt: Date.now() + CACHE_TTL_MS });
      return stockQuote;
    } catch (error: any) {
      if (DEBUG_PRICE_FAILURE) console.warn('[StockPrice] Yahoo failed', upperSymbol, error?.message);
      return null;
    }
  }

  /**
   * Get quote for a single stock (Yahoo Finance only).
   */
  async getQuote(symbol: string, _skipRateLimitCheck: boolean = false): Promise<StockQuote | null> {
    return this.fetchYahooQuote(symbol);
  }

  /**
   * Get current price for a stock (simplified method)
   */
  async getCurrentPrice(symbol: string): Promise<number | null> {
    const quote = await this.getQuote(symbol);
    return quote?.currentPrice || null;
  }

  /**
   * Get quotes for multiple stocks - all fired in parallel, no artificial delay.
   */
  async getQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const results = await Promise.all(
      symbols.map(async symbol => {
        const quote = await this.fetchYahooQuote(symbol);
        return quote ? { symbol: symbol.toUpperCase(), quote } : null;
      })
    );
    const quotes = new Map<string, StockQuote>();
    for (const r of results) {
      if (r) quotes.set(r.symbol, r.quote);
    }
    return quotes;
  }

  /**
   * Get market data for top gainers/losers
   */
  async getMarketData(symbols: string[]): Promise<StockQuote[]> {
    const quotes = await this.getQuotes(symbols);
    return Array.from(quotes.values());
  }

  /** For debugging; Yahoo has no client-side limit. */
  getRateLimitStatus(): { calls: number; isRateLimited: boolean; timeUntilReset: number } {
    return getFinnhubRateLimitStatus();
  }

  /** Clears the in-memory quote cache (call on pull-to-refresh). */
  clearCache(): void {
    quoteCache.clear();
  }

  /** Clears the cache for a single symbol. */
  clearCacheForSymbol(symbol: string): void {
    quoteCache.delete(symbol.toUpperCase());
  }
}

export const stockPriceService = new StockPriceService();
export default stockPriceService;
