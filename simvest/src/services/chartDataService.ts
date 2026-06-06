/**
 * Chart Data Service
 * Fetches candlestick/OHLC data for charts
 * 
 * Using Yahoo Finance API (unofficial, free, no API key)
 */

import axios from 'axios';

export interface CandlestickData {
  timestamp: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Cache for chart data (5 minutes)
const chartCache: Map<string, { data: CandlestickData[]; timestamp: number }> = new Map();
const CHART_CACHE_DURATION = 300000; // 5 minutes

class ChartDataService {
  /**
   * Get candlestick data for a symbol using Yahoo Finance API
   * @param symbol Stock symbol (e.g., 'AAPL')
   * @param interval '1m', '5m', '15m', '30m', '60m', '1h', '1d', '1wk', '1mo'
   * @param range '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max'
   */
  async getCandlestickData(
    symbol: string,
    interval: string = '1d',
    range: string = '1mo'
  ): Promise<CandlestickData[]> {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `${upperSymbol}_${interval}_${range}`;
    
    // Check cache first
    const cached = chartCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CHART_CACHE_DURATION) {
      return cached.data;
    }

    // Use Yahoo Finance API
    try {
      console.log(`Attempting Yahoo Finance chart data for ${upperSymbol} with interval ${interval}, range ${range}`);
      const yahooData = await this.getYahooFinanceData(upperSymbol, interval, range);
      if (yahooData && yahooData.length > 0) {
        console.log(`Yahoo Finance: Successfully fetched ${yahooData.length} candles for ${upperSymbol}`);
        chartCache.set(cacheKey, { data: yahooData, timestamp: Date.now() });
        return yahooData;
      } else {
        console.warn(`Yahoo Finance returned empty data for ${upperSymbol} (likely market closed for 1-minute data)`);
        // If we have cached data, use it (market is probably closed)
        if (cached && cached.data.length > 0) {
          console.log(`Using cached data for ${upperSymbol} (market closed)`);
          return cached.data;
        }
      }
    } catch (error: any) {
      console.error(`Yahoo Finance chart data failed for ${upperSymbol}:`, error.message || error);
      if (error.response) {
        console.error(`Response status: ${error.response.status}`, error.response.data);
      }
      // If we have cached data, use it (market might be closed)
      if (cached && cached.data.length > 0) {
        console.log(`Using cached data for ${upperSymbol} after error (market may be closed)`);
        return cached.data;
      }
    }

    // If we have cached data (even expired), return it as fallback
    if (cached && cached.data.length > 0) {
      console.log(`Using cached data for ${upperSymbol} (all APIs failed or empty)`);
      return cached.data;
    }

    // No data and no cache - return empty so UI can show empty chart instead of crashing
    console.warn(`No chart data for ${upperSymbol} (API empty or failed, no cache)`);
    return [];
  }


  /**
   * Get chart data from Yahoo Finance API
   */
  private async getYahooFinanceData(
    symbol: string,
    interval: string,
    range: string
  ): Promise<CandlestickData[]> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.data?.chart?.result?.[0]) {
      return [];
    }

    const result = response.data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    if (!timestamps?.length || !quote) {
      return [];
    }

    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];
    const candles: CandlestickData[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (opens[i] == null || highs[i] == null || lows[i] == null || closes[i] == null) {
        continue;
      }
      candles.push({
        timestamp: timestamps[i],
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i] || 0,
      });
    }

    return candles;
  }

  /**
   * Get intraday data for 1-day chart. Uses 5m/15m with range=1d (one trading day).
   * Yahoo 1m is often empty; 5m/15m for 1d is reliable and accurate.
   * @param symbol Stock symbol
   * @param hours Unused; we fetch one full trading day (1d range).
   */
  async getIntradayData(symbol: string, _hours: number = 8): Promise<CandlestickData[]> {
    const upperSymbol = symbol.toUpperCase();

    // 1) Primary: 5m bars for today (range=1d) - one trading day, accurate
    try {
      const data5m = await this.getCandlestickData(symbol, '5m', '1d');
      if (data5m && data5m.length > 0) {
        return data5m;
      }
    } catch (e) {
      // continue
    }

    // 2) Fallback: 15m bars for today
    try {
      const data15m = await this.getCandlestickData(symbol, '15m', '1d');
      if (data15m && data15m.length > 0) {
        return data15m;
      }
    } catch (e) {
      // continue
    }

    // 3) 5m with 5d range, filter to last ~8 hours (one session)
    try {
      const data5d = await this.getCandlestickData(symbol, '5m', '5d');
      if (data5d && data5d.length > 0) {
        const cutoff = Math.floor(Date.now() / 1000) - 8 * 60 * 60;
        const filtered = data5d.filter(c => c.timestamp >= cutoff);
        if (filtered.length > 0) return filtered;
        return data5d;
      }
    } catch (e) {
      // continue
    }

    // 4) Last resort: single daily candle for "today" (so 1D shows one bar, not wrong multi-day)
    try {
      const oneDay = await this.getCandlestickData(symbol, '1d', '5d');
      if (oneDay && oneDay.length > 0) {
        return oneDay.slice(-1);
      }
    } catch (e) {
      // continue
    }

    return [];
  }

  /**
   * Get daily data for longer-term chart
   * @param symbol Stock symbol
   * @param days Number of days to fetch
   */
  async getDailyData(symbol: string, days: number = 30): Promise<CandlestickData[]> {
    let range = '1mo';
    
    if (days <= 5) {
      range = '5d';
    } else if (days <= 30) {
      range = '1mo';
    } else if (days <= 90) {
      range = '3mo';
    } else if (days <= 180) {
      range = '6mo';
    } else if (days <= 365) {
      range = '1y';
    } else if (days <= 730) {
      range = '2y';
    } else if (days <= 1825) {
      range = '5y';
    } else {
      range = 'max';
    }
    
    return this.getCandlestickData(symbol, '1d', range);
  }
}

export const chartDataService = new ChartDataService();
export default chartDataService;



