/**
 * Yahoo Finance Service
 * Uses Yahoo's public quote API (no API key, no rate limits for normal use).
 * Provides batch quotes with volume for Most Traded, Top Gainers, Top Losers.
 */

import axios from 'axios';

const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

// User-Agent required so Yahoo doesn't block the request
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Accept': 'application/json',
};

export interface YahooQuote {
  symbol: string;
  shortName?: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  regularMarketPreviousClose?: number;
}

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: Array<{
      symbol: string;
      shortName?: string;
      longName?: string;
      regularMarketPrice?: number;
      regularMarketChange?: number;
      regularMarketChangePercent?: number;
      regularMarketVolume?: number;
      regularMarketPreviousClose?: number;
    }>;
    error?: unknown;
  };
}

/**
 * Fetch batch quotes from Yahoo Finance (no API key).
 * Returns array of quotes with price, change, changePercent, volume.
 */
export async function fetchYahooQuotes(symbols: string[]): Promise<YahooQuote[]> {
  if (symbols.length === 0) return [];

  const symbolsParam = symbols.slice(0, 50).join(','); // Yahoo accepts many symbols in one call
  const url = `${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(symbolsParam)}`;

  try {
    const response = await axios.get<YahooQuoteResponse>(url, {
      timeout: 15000,
      headers: REQUEST_HEADERS,
    });

    const results = response.data?.quoteResponse?.result;
    if (!Array.isArray(results) || results.length === 0) {
      return [];
    }

    const quotes: YahooQuote[] = results
      .filter((item: any) => item && item.symbol)
      .map((item: any) => {
        const price = typeof item.regularMarketPrice === 'number' ? item.regularMarketPrice : 0;
        const prevClose = typeof item.regularMarketPreviousClose === 'number' ? item.regularMarketPreviousClose : price;
        const change = typeof item.regularMarketChange === 'number' ? item.regularMarketChange : price - prevClose;
        const changePercent = typeof item.regularMarketChangePercent === 'number'
          ? item.regularMarketChangePercent
          : (prevClose > 0 ? (change / prevClose) * 100 : 0);
        const volume = typeof item.regularMarketVolume === 'number' ? item.regularMarketVolume : 0;

        return {
          symbol: item.symbol,
          shortName: item.shortName || item.longName,
          regularMarketPrice: price,
          regularMarketChange: change,
          regularMarketChangePercent: changePercent,
          regularMarketVolume: volume,
          regularMarketPreviousClose: prevClose,
        };
      });

    return quotes;
  } catch (error: any) {
    console.error('Yahoo Finance fetch error:', error?.message || error);
    throw error;
  }
}
