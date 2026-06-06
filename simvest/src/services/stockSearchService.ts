/**
 * Stock Search Service
 * Provides stock symbol search/autocomplete using Yahoo Finance API
 * 
 * Yahoo Finance has a free search endpoint that returns matching stocks
 */

import axios from 'axios';
import { StockSuggestion } from '../types';

interface YahooFinanceSearchResult {
  quotes: Array<{
    symbol: string;
    shortname?: string;
    longname?: string;
    quoteType?: string;
    exchange?: string;
  }>;
}

class StockSearchService {
  // Cache for search results (1 minute)
  private searchCache: Map<string, { results: StockSuggestion[]; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 60000; // 1 minute

  /**
   * Search for stocks by symbol or name
   * @param query Search query (symbol or company name)
   * @param limit Maximum number of results to return
   */
  async searchStocks(query: string, limit: number = 10): Promise<StockSuggestion[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery.length < 1) {
      return [];
    }

    const cacheKey = trimmedQuery.toUpperCase();
    const cached = this.searchCache.get(cacheKey);
    
    // Check cache
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.results.slice(0, limit);
    }

    try {
      // Yahoo Finance search endpoint
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(trimmedQuery)}&quotesCount=${limit * 2}&newsCount=0`;
      
      const response = await axios.get<YahooFinanceSearchResult>(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FinanceApp/1.0)',
        },
      });

      if (response.data && response.data.quotes && Array.isArray(response.data.quotes)) {
        const seenSymbols = new Set<string>();
        const suggestions: StockSuggestion[] = response.data.quotes
          .filter((quote: any) => {
            // Filter to only stocks/equities (not options, forex, etc.)
            const quoteType = quote.quoteType?.toUpperCase();
            const symbol = (quote.symbol || '').toUpperCase();
            
            // Skip if already seen (duplicate)
            if (seenSymbols.has(symbol)) {
              return false;
            }
            
            // Filter out international stocks (Finnhub free tier doesn't support them)
            // International stocks have suffixes like .V, .JO, .L, .KL, .BA, .MX, .NE, etc.
            const hasInternationalSuffix = /\.(V|JO|L|KL|BA|MX|NE|TO|PA|BR|DE|FR|HK|SG|AU|CN|IN|KR|TW|JP)$/i.test(symbol);
            if (hasInternationalSuffix) {
              return false;
            }
            
            // Only US equities/ETFs
            const isEquity = quoteType === 'EQUITY' || quoteType === 'ETF' || quoteType === undefined;
            if (isEquity) {
              seenSymbols.add(symbol);
              return true;
            }
            
            return false;
          })
          .map((quote: any) => {
            const symbol = (quote.symbol || '').toUpperCase();
            const name = quote.longname || quote.shortname || symbol;
            const exchange = quote.exchange || '';
            
            // Determine type
            let type = 'US Equity';
            if (exchange.includes('NASDAQ')) {
              type = 'NASDAQ';
            } else if (exchange.includes('NYSE')) {
              type = 'NYSE';
            } else if (exchange) {
              type = exchange;
            }

            // Get logo URL
            const logo = `https://logo.clearbit.com/${this.extractDomain(symbol, name)}`;

            return {
              symbol: symbol,
              name: name,
              type: type,
              logo: logo,
            };
          })
          .filter((suggestion: StockSuggestion) => suggestion.symbol.length > 0)
          .slice(0, limit);

        // Cache the results
        this.searchCache.set(cacheKey, {
          results: suggestions,
          timestamp: Date.now(),
        });

        return suggestions;
      }

      return [];
    } catch (error: any) {
      console.error(`Error searching stocks for "${trimmedQuery}":`, error.message);
      
      // If we have cached data, return it even if expired
      if (cached) {
        console.warn(`Using cached search results for "${trimmedQuery}"`);
        return cached.results.slice(0, limit);
      }

      return [];
    }
  }

  /**
   * Extract domain from symbol or name for logo
   */
  private extractDomain(symbol: string, name: string): string {
    // Try to extract company domain from name
    const companyName = name.toLowerCase()
      .replace(/inc\./gi, '')
      .replace(/corp\./gi, '')
      .replace(/corporation/gi, '')
      .replace(/company/gi, '')
      .replace(/ltd\./gi, '')
      .replace(/limited/gi, '')
      .trim()
      .split(' ')[0]; // Take first word

    // Some common mappings
    const domainMap: Record<string, string> = {
      'AAPL': 'apple.com',
      'MSFT': 'microsoft.com',
      'GOOGL': 'google.com',
      'GOOG': 'google.com',
      'AMZN': 'amazon.com',
      'NVDA': 'nvidia.com',
      'META': 'meta.com',
      'TSLA': 'tesla.com',
      'NFLX': 'netflix.com',
      'AMD': 'amd.com',
      'INTC': 'intel.com',
      'ADBE': 'adobe.com',
      'CRM': 'salesforce.com',
      'PYPL': 'paypal.com',
      'ORCL': 'oracle.com',
      'DIS': 'disney.com',
      'NKE': 'nike.com',
      'SBUX': 'starbucks.com',
      'WMT': 'walmart.com',
      'TGT': 'target.com',
      'HD': 'homedepot.com',
      'LOW': 'lowes.com',
      'MCD': 'mcdonalds.com',
      'JPM': 'jpmorganchase.com',
      'BAC': 'bankofamerica.com',
      'V': 'visa.com',
      'MA': 'mastercard.com',
    };

    // Check if we have a mapping
    if (domainMap[symbol]) {
      return domainMap[symbol];
    }

    // Fallback to first word of company name + .com
    return `${companyName}.com`;
  }
}

export const stockSearchService = new StockSearchService();
export default stockSearchService;

