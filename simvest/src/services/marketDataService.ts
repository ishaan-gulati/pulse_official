/**
 * Market Data Service
 * Provides market data: top gainers, losers, most traded
 * Uses Yahoo Finance (no API key, no restrictions) for gainers/losers/most traded.
 * News still uses Finnhub.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STOCK_SUGGESTIONS } from '../constants/mockData';
import { stockPriceService } from './stockPriceService';
import { API_KEYS } from '../config/apiKeys';
import { fetchYahooQuotes, YahooQuote } from './yahooFinanceService';
import {
  canMakeFinnhubRequest,
  pickFinnhubKeyIndex,
  recordFinnhubCall,
  markFinnhubRateLimited,
} from './finnhubRateLimit';

const MARKET_NEWS_CACHE_KEY = '@simvest/market_news_cache';
const CACHE_LIMIT = 3; // Top 3 for the day; only refetch next day
// Set to true to clear cache and always fetch fresh (e.g. testing Finnhub-only). Set back to false to restore daily cache.
const TEMPORARILY_SKIP_MARKET_NEWS_CACHE = true;

export interface MarketStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  logo: string;
}

export interface MarketNews {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  url?: string;
  relatedStocks?: string[];
  fullContent?: string; // Full article content
}

// Yahoo Finance cache (single batch quote result for all sections)
const yahooCache: {
  quotes: YahooQuote[] | null;
  timestamp: number;
} = {
  quotes: null,
  timestamp: 0,
};
const YAHOO_CACHE_DURATION = 120000; // 2 minutes

let yahooFetchPromise: Promise<YahooQuote[]> | null = null;

class MarketDataService {
  // Expanded pool of popular stocks (only used as fallback now)
  // CHECKPOINT: Expanded from 15 to 50 stocks, but now primarily using Alpha Vantage API
  // Alpha Vantage gives us REAL market-wide top movers with just 1 API call
  private popularStocks: string[] = [
    // Tech giants
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 
    'NFLX', 'AMD', 'INTC', 'ADBE', 'CRM', 'PYPL', 'ORCL',
    // Consumer & Retail
    'DIS', 'NKE', 'SBUX', 'WMT', 'TGT', 'HD', 'LOW', 'MCD',
    // Finance
    'JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA', 'AXP',
    // Healthcare
    'JNJ', 'PFE', 'UNH', 'ABBV', 'MRK', 'TMO', 'ABT',
    // Energy & Materials
    'XOM', 'CVX', 'COP', 'SLB', 'FCX', 'NEM',
    // Industrial
    'BA', 'CAT', 'GE', 'HON', 'UPS', 'RTX',
    // Communication
    'T', 'VZ', 'CMCSA'
  ];

  // Stock name mapping for stocks not in STOCK_SUGGESTIONS
  private stockNames: Record<string, string> = {
    'ORCL': 'Oracle Corporation',
    'NKE': 'Nike, Inc.',
    'SBUX': 'Starbucks Corporation',
    'WMT': 'Walmart Inc.',
    'TGT': 'Target Corporation',
    'HD': 'The Home Depot, Inc.',
    'LOW': "Lowe's Companies, Inc.",
    'MCD': "McDonald's Corporation",
    'BAC': 'Bank of America Corp.',
    'WFC': 'Wells Fargo & Company',
    'GS': 'The Goldman Sachs Group, Inc.',
    'MS': 'Morgan Stanley',
    'MA': 'Mastercard Incorporated',
    'AXP': 'American Express Company',
    'PFE': 'Pfizer Inc.',
    'UNH': 'UnitedHealth Group Inc.',
    'ABBV': 'AbbVie Inc.',
    'MRK': 'Merck & Co., Inc.',
    'TMO': 'Thermo Fisher Scientific Inc.',
    'ABT': 'Abbott Laboratories',
    'XOM': 'Exxon Mobil Corporation',
    'CVX': 'Chevron Corporation',
    'COP': 'ConocoPhillips',
    'SLB': 'Schlumberger Limited',
    'FCX': 'Freeport-McMoRan Inc.',
    'NEM': 'Newmont Corporation',
    'BA': 'The Boeing Company',
    'CAT': 'Caterpillar Inc.',
    'GE': 'General Electric Company',
    'HON': 'Honeywell International Inc.',
    'UPS': 'United Parcel Service, Inc.',
    'RTX': 'Raytheon Technologies Corporation',
    'T': 'AT&T Inc.',
    'VZ': 'Verizon Communications Inc.',
    'CMCSA': 'Comcast Corporation',
  };
  private fixedMostTraded: string[] = ['AAPL', 'TSLA', 'NVDA'];

  /** Map Yahoo quote to MarketStock (name from STOCK_SUGGESTIONS or stockNames) */
  private yahooToMarketStock(q: YahooQuote): MarketStock {
    const stockInfo = STOCK_SUGGESTIONS.find(s => s.symbol === q.symbol);
    return {
      symbol: q.symbol,
      name: stockInfo?.name || this.stockNames[q.symbol] || q.shortName || q.symbol,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePercent: q.regularMarketChangePercent,
      volume: q.regularMarketVolume,
      logo: stockInfo?.logo || '',
    };
  }

  /** Ensure Yahoo batch quotes are fetched and cached (single request for all sections) */
  private async ensureYahooData(): Promise<YahooQuote[]> {
    const now = Date.now();
    if (yahooCache.quotes && (now - yahooCache.timestamp) < YAHOO_CACHE_DURATION) {
      return yahooCache.quotes;
    }
    if (yahooFetchPromise) {
      return yahooFetchPromise;
    }
    yahooFetchPromise = fetchYahooQuotes(this.popularStocks)
      .then(quotes => {
        yahooCache.quotes = quotes.filter(q => q.regularMarketPrice > 0);
        yahooCache.timestamp = Date.now();
        return yahooCache.quotes;
      })
      .finally(() => {
        yahooFetchPromise = null;
      });
    try {
      return await yahooFetchPromise;
    } catch (e) {
      if (yahooCache.quotes) return yahooCache.quotes;
      throw e;
    }
  }

  // Get top gainers from Yahoo Finance (no API key, includes volume)
  async getTopGainers(limit: number = 3): Promise<MarketStock[]> {
    try {
      const quotes = await this.ensureYahooData();
      const sorted = [...quotes]
        .filter(q => q.regularMarketChangePercent != null && !Number.isNaN(q.regularMarketChangePercent))
        .sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent)
        .slice(0, limit);
      return sorted.map(q => this.yahooToMarketStock(q));
    } catch (error: any) {
      console.warn('Yahoo top gainers failed, using fallback:', error?.message);
      return this.getTopGainersFallback(limit);
    }
  }

  // Fallback method using popular stocks (old implementation)
  private async getTopGainersFallback(limit: number): Promise<MarketStock[]> {
    const quotes = await stockPriceService.getQuotes(this.popularStocks);
    
    const stocks: MarketStock[] = this.popularStocks.map(symbol => {
      const quote = quotes.get(symbol);
      const stockInfo = STOCK_SUGGESTIONS.find(s => s.symbol === symbol);
      
      if (quote) {
        return {
          symbol: quote.symbol,
          name: stockInfo?.name || this.stockNames[quote.symbol] || quote.symbol,
          price: quote.currentPrice,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          logo: stockInfo?.logo || '',
        };
      } else {
        return null as any;
      }
    });

    const sortedStocks = stocks
      .filter(stock => stock && stock.changePercent !== undefined && stock.changePercent !== -999)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, limit);

    return sortedStocks;
  }

  // Get top losers from Yahoo Finance (no API key, includes volume)
  async getTopLosers(limit: number = 3): Promise<MarketStock[]> {
    try {
      const quotes = await this.ensureYahooData();
      const sorted = [...quotes]
        .filter(q => q.regularMarketChangePercent != null && !Number.isNaN(q.regularMarketChangePercent))
        .sort((a, b) => a.regularMarketChangePercent - b.regularMarketChangePercent)
        .slice(0, limit);
      return sorted.map(q => this.yahooToMarketStock(q));
    } catch (error: any) {
      console.warn('Yahoo top losers failed, using fallback:', error?.message);
      return this.getTopLosersFallback(limit);
    }
  }

  // Fallback method using popular stocks (old implementation)
  private async getTopLosersFallback(limit: number): Promise<MarketStock[]> {
    const quotes = await stockPriceService.getQuotes(this.popularStocks);
    
    const stocks: MarketStock[] = this.popularStocks.map(symbol => {
      const quote = quotes.get(symbol);
      const stockInfo = STOCK_SUGGESTIONS.find(s => s.symbol === symbol);
      
      if (quote) {
        return {
          symbol: quote.symbol,
          name: stockInfo?.name || this.stockNames[quote.symbol] || quote.symbol,
          price: quote.currentPrice,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          logo: stockInfo?.logo || '',
        };
      } else {
        return null as any;
      }
    });

    const sortedStocks = stocks
      .filter(stock => stock && stock.changePercent !== undefined && stock.changePercent !== 999)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, limit);

    return sortedStocks;
  }

  // Get most traded by volume from Yahoo Finance (real volume, no 0.0M glitch)
  async getMostTraded(limit: number = 3): Promise<MarketStock[]> {
    try {
      const quotes = await this.ensureYahooData();
      const sorted = [...quotes]
        .filter(q => (q.regularMarketVolume ?? 0) > 0)
        .sort((a, b) => (b.regularMarketVolume ?? 0) - (a.regularMarketVolume ?? 0))
        .slice(0, limit);
      if (sorted.length > 0) {
        return sorted.map(q => this.yahooToMarketStock(q));
      }
      // If all volumes are 0 (e.g. weekend), still return top by price/change with volume shown as 0
      const fallback = quotes.slice(0, limit).map(q => this.yahooToMarketStock(q));
      return fallback;
    } catch (error: any) {
      console.warn('Yahoo most traded failed, using fallback:', error?.message);
      return this.getMostTradedFallback(limit);
    }
  }

  // Fallback method using fixed stocks (when Yahoo fails)
  private async getMostTradedFallback(limit: number = 3): Promise<MarketStock[]> {
    const symbols = this.fixedMostTraded.slice(0, limit);
    const quotes = await stockPriceService.getQuotes(symbols);
    
    const stocks: MarketStock[] = symbols.map(symbol => {
      const quote = quotes.get(symbol);
      const stockInfo = STOCK_SUGGESTIONS.find(s => s.symbol === symbol);
      
      if (quote) {
        return {
          symbol: quote.symbol,
          name: stockInfo?.name || quote.symbol,
          price: quote.currentPrice,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume || 0,
          logo: stockInfo?.logo || '',
        };
      } else {
        return null as any;
      }
    });

    return stocks.filter(stock => stock !== null && stock !== undefined);
  }

  // Get market news for trade/search page. Cached for the whole day (top 3) to avoid Alpha Vantage rate limits.
  async getMarketNews(limit: number = 3): Promise<MarketNews[]> {
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (TEMPORARILY_SKIP_MARKET_NEWS_CACHE) {
      try {
        await AsyncStorage.removeItem(MARKET_NEWS_CACHE_KEY);
      } catch (_) {}
    }

    if (API_KEYS.USE_REAL_NEWS) {
      if (!TEMPORARILY_SKIP_MARKET_NEWS_CACHE) {
        try {
          const raw = await AsyncStorage.getItem(MARKET_NEWS_CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as { date: string; articles: MarketNews[] };
            if (parsed?.date === todayStr && Array.isArray(parsed.articles) && parsed.articles.length > 0) {
              return parsed.articles.slice(0, limit);
            }
          }
        } catch (_) {
          // ignore parse/storage errors
        }
      }

      // Fetch once per day: try Alpha Vantage then Finnhub, cache top 3
      let articles: MarketNews[] = [];
      if (API_KEYS.ALPHA_VANTAGE_API_KEY) {
        try {
          articles = await this.fetchMarketNewsFromAlphaVantage(CACHE_LIMIT);
        } catch (e: any) {
          console.warn('Alpha Vantage news failed:', e?.message || e);
        }
      }
      if (articles.length === 0 && canMakeFinnhubRequest()) {
        try {
          articles = await this.fetchMarketNewsFromFinnhub(CACHE_LIMIT);
        } catch (e: any) {
          console.warn('Finnhub market news failed:', e?.message || e);
        }
      }
      if (articles.length > 0) {
        if (!TEMPORARILY_SKIP_MARKET_NEWS_CACHE) {
          try {
            await AsyncStorage.setItem(
              MARKET_NEWS_CACHE_KEY,
              JSON.stringify({ date: todayStr, articles })
            );
          } catch (_) {}
        }
        return articles.slice(0, limit);
      }
    }

    return this.getMockMarketNews(limit);
  }

  // Alpha Vantage NEWS_SENTIMENT - returns error body (Note / Error Message) when rate limited or invalid key
  private async fetchMarketNewsFromAlphaVantage(limit: number): Promise<MarketNews[]> {
    const key = API_KEYS.ALPHA_VANTAGE_API_KEY?.trim();
    if (!key) return [];
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=50&topics=financial_markets&sort=LATEST&apikey=${key}`;
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;
    if (data?.Note != null || data?.['Error Message'] != null || data?.Information != null) {
      console.warn('Alpha Vantage returned error/rate-limit:', data?.Note || data?.['Error Message'] || data?.Information);
      return [];
    }
    const feed = data?.feed;
    if (!Array.isArray(feed) || feed.length === 0) return [];
    return feed.slice(0, limit).map((article: any, index: number) => {
      const timeMs = article.time_published
        ? new Date(article.time_published.slice(0, 4) + '-' + article.time_published.slice(4, 6) + '-' + article.time_published.slice(6, 8) + 'T' + article.time_published.slice(9, 11) + ':' + article.time_published.slice(11, 13) + ':' + article.time_published.slice(13, 15) + 'Z').getTime()
        : Date.now();
      const tickers = (article.ticker_sentiment || []).map((t: any) => t.ticker).filter(Boolean);
      return {
        id: article.url || `av-${index}`,
        title: article.title || 'Market News',
        summary: article.summary || article.title || 'No description available.',
        source: article.source || 'Alpha Vantage',
        publishedAt: this.formatTimeAgo(timeMs),
        imageUrl: article.banner_image,
        url: article.url,
        relatedStocks: tickers.length > 0 ? tickers : undefined,
      };
    });
  }

  // Finnhub general market news (fallback when Alpha Vantage is rate limited)
  private async fetchMarketNewsFromFinnhub(limit: number): Promise<MarketNews[]> {
    const keyIndex = pickFinnhubKeyIndex();
    const token = API_KEYS.FINNHUB_API_KEY;
    if (keyIndex === -1 || !token) return [];
    const url = `https://finnhub.io/api/v1/news?category=general&token=${encodeURIComponent(token)}`;
    const response = await axios.get(url, { timeout: 8000 });
    recordFinnhubCall(keyIndex);
    const list = response.data;
    if (!Array.isArray(list) || list.length === 0) return [];
    return list.slice(0, limit).map((item: any, index: number) => ({
      id: item.id?.toString() || item.url || `fh-${index}`,
      title: item.headline || 'Market News',
      summary: item.summary || item.headline || 'No description available.',
      source: item.source || 'Finnhub',
      publishedAt: item.datetime ? this.formatTimeAgo(item.datetime * 1000) : 'Recently',
      imageUrl: item.image,
      url: item.url,
      relatedStocks: Array.isArray(item.related) ? item.related : undefined,
    }));
  }

  /**
   * Company profile from Finnhub (name, description, weburl) for AI explain context.
   */
  async getCompanyProfile(symbol: string): Promise<{ name: string; description: string; weburl: string } | null> {
    if (!API_KEYS.FINNHUB_API_KEY) return null;
    if (!canMakeFinnhubRequest()) return null;
    const keyIndex = pickFinnhubKeyIndex();
    const token = API_KEYS.FINNHUB_API_KEY;
    if (keyIndex === -1 || !token) return null;
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${token}`;
    try {
      const response = await axios.get(url, { timeout: 6000 });
      recordFinnhubCall(keyIndex);
      const d = response.data;
      if (!d || typeof d !== 'object') return null;
      return {
        name: d.name || '',
        description: typeof d.description === 'string' ? d.description : '',
        weburl: d.weburl || '',
      };
    } catch (e: any) {
      if (e?.response?.status === 429) markFinnhubRateLimited(keyIndex);
      console.warn('getCompanyProfile failed for', symbol, (e as Error).message);
      return null;
    }
  }

  /**
   * Fetch recent company-specific news for a symbol (for portfolio explain context).
   * Uses Finnhub company-news; returns last 7 days, up to `limit` articles.
   */
  async getCompanyNews(symbol: string, limit: number = 3): Promise<Array<{ headline: string; source: string; date: string }>> {
    if (!API_KEYS.FINNHUB_API_KEY) return [];
    if (!canMakeFinnhubRequest()) return [];
    const keyIndex = pickFinnhubKeyIndex();
    const token = API_KEYS.FINNHUB_API_KEY;
    if (keyIndex === -1 || !token) return [];
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromStr}&to=${toStr}&token=${token}`;
    try {
      const response = await axios.get(url, { timeout: 8000 });
      recordFinnhubCall(keyIndex);
      if (!Array.isArray(response.data) || response.data.length === 0) return [];
      return response.data.slice(0, limit).map((a: any) => ({
        headline: a.headline || 'No title',
        source: a.source || 'News',
        date: a.datetime ? this.formatTimeAgo(a.datetime * 1000) : '',
      }));
    } catch (e: any) {
      if (e?.response?.status === 429) markFinnhubRateLimited(keyIndex);
      console.warn('getCompanyNews failed for', symbol, (e as Error).message);
      return [];
    }
  }

  // Fetch full article content from URL
  async fetchFullArticleContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PulseApp/1.0)',
        },
        timeout: 10000, // 10 second timeout
      });
      
      const html = response.data;
      
      // Try to extract main article content using common patterns
      let articleText = '';
      
      // Method 1: Look for <article> tag
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (articleMatch) {
        articleText = articleMatch[1];
      } else {
        // Method 2: Look for common article class names
        const articleClassPatterns = [
          /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*story[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<main[^>]*>([\s\S]*?)<\/main>/i,
        ];
        
        for (const pattern of articleClassPatterns) {
          const match = html.match(pattern);
          if (match && match[1].length > 500) { // Make sure it's substantial content
            articleText = match[1];
            break;
          }
        }
      }
      
      // If no specific article section found, try to extract paragraphs
      if (!articleText || articleText.length < 200) {
        const paragraphMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        if (paragraphMatches && paragraphMatches.length > 3) {
          articleText = paragraphMatches.slice(0, 20).join(' '); // Take first 20 paragraphs
        }
      }
      
      // Fallback: use body but remove unwanted sections
      if (!articleText || articleText.length < 200) {
        articleText = html;
      }
      
      // Remove unwanted elements
      articleText = articleText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      articleText = articleText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      articleText = articleText.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
      articleText = articleText.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
      articleText = articleText.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
      articleText = articleText.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
      articleText = articleText.replace(/<div[^>]*class="[^"]*(nav|menu|header|footer|sidebar|ad|advertisement|social|share|comment)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
      
      // Remove all HTML tags but preserve paragraph breaks
      articleText = articleText.replace(/<br\s*\/?>/gi, '\n');
      articleText = articleText.replace(/<\/p>/gi, '\n\n');
      articleText = articleText.replace(/<\/div>/gi, '\n');
      articleText = articleText.replace(/<[^>]+>/g, '');
      
      // Clean up whitespace and newlines
      articleText = articleText.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
      articleText = articleText.replace(/[ \t]+/g, ' '); // Multiple spaces to single
      articleText = articleText.trim();
      
      // Remove common unwanted text patterns
      const unwantedPatterns = [
        /Skip to main content/gi,
        /Share.*?Resize/gi,
        /Listen.*?min/gi,
        /Explore Our Brands/gi,
        /Account Settings/gi,
        /Log In.*?Sign Up/gi,
        /Site Search/gi,
        /Back To Top/gi,
        /Copyright.*?All rights reserved/gi,
        /Terms of Use.*?Privacy Notice/gi,
        /Photo:.*?Getty Images/gi,
        /Published:.*?ET/gi,
        /Advertisement/gi,
      ];
      
      unwantedPatterns.forEach(pattern => {
        articleText = articleText.replace(pattern, '');
      });
      
      // Clean up again after removing unwanted text
      articleText = articleText.replace(/\n{3,}/g, '\n\n');
      articleText = articleText.trim();
      
      // Take reasonable length (5000 chars for full article)
      if (articleText.length > 5000) {
        // Try to cut at a sentence boundary
        const cutPoint = articleText.lastIndexOf('.', 5000);
        if (cutPoint > 3000) {
          articleText = articleText.substring(0, cutPoint + 1);
        } else {
          articleText = articleText.substring(0, 5000) + '...';
        }
      }
      
      return articleText || '';
    } catch (error) {
      console.error('Error fetching article content:', error);
      return '';
    }
  }

  // Format timestamp to "X hours ago" format
  private formatTimeAgo(dateString: string | number): string {
    const date = typeof dateString === 'number' ? new Date(dateString) : new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // Mock market news (fallback)
  private getMockMarketNews(limit: number): MarketNews[] {
    return [
      {
        id: '1',
        title: 'Tech Stocks Rally on Strong Earnings Reports',
        summary: 'Major technology companies including Apple, Microsoft, and NVIDIA reported better-than-expected earnings this quarter, driving the NASDAQ up 2.3%. Analysts are optimistic about continued growth in the AI and cloud computing sectors.',
        source: 'Financial Times',
        publishedAt: '2 hours ago',
        imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400',
        relatedStocks: ['AAPL', 'MSFT', 'NVDA'],
      },
      {
        id: '2',
        title: 'Federal Reserve Holds Interest Rates Steady',
        summary: 'The Federal Reserve announced it will maintain current interest rates, citing stable inflation and strong employment numbers. Markets responded positively, with the S&P 500 gaining 1.5% in afternoon trading.',
        source: 'Bloomberg',
        publishedAt: '5 hours ago',
        imageUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=400',
        relatedStocks: ['SPY'],
      },
      {
        id: '3',
        title: 'Tesla Announces New Battery Technology Breakthrough',
        summary: 'Tesla revealed a new battery technology that could extend electric vehicle range by 40%. The announcement sent TSLA stock up 8% in pre-market trading, with analysts raising price targets.',
        source: 'Reuters',
        publishedAt: '8 hours ago',
        imageUrl: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400',
        relatedStocks: ['TSLA'],
      },
    ].slice(0, limit);
  }
}

export const marketDataService = new MarketDataService();
export default marketDataService;

