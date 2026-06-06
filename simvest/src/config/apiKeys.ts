/**
 * API Keys Configuration
 *
 * Finnhub - Company news for AI explanation ("Explain this stock" / "Explain my portfolio")
 * Free tier: 60 calls/minute. Get key: https://finnhub.io/register
 *
 * Alpha Vantage - Market news on trade/search page (NEWS_SENTIMENT) + market movers
 * Free tier: 5 calls/minute, 500/day. Get key: https://www.alphavantage.co/support/#api-key
 *
 * FMP - Most active stocks. Get key: https://site.financialmodelingprep.com/developer/docs/
 *
 * Groq - AI summaries (Explain this stock, Explain my portfolio). Get key: https://console.groq.com/keys
 */

export const API_KEYS = {
  // Finnhub - Company news, market news fallback, AI explain (single key)
  FINNHUB_API_KEY: 'd6p1gr1r01qk3chii1j0d6p1gr1r01qk3chii1jg',

  // Alpha Vantage - Market news on trade page (getMarketNews) + market movers (commented out for testing - using Finnhub only)
  // ALPHA_VANTAGE_API_KEY: 'K94EJNVDSEYMAOBT',

  // Financial Modeling Prep - Most active stocks
  FMP_API_KEY: 'QO2fFmU5FuTZ6YPzhMQc3SZTapES8Gj2',

  // Groq - "Explain this stock" & "Explain my portfolio" (AI summaries)
  GROQ_API_KEY: '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',

  USE_REAL_NEWS: true,
};

