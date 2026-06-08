/**
 * API keys — loaded from .env (EXPO_PUBLIC_*). Copy .env.example → .env locally.
 * Never commit real keys to git.
 */

export const API_KEYS = {
  FINNHUB_API_KEY: process.env.EXPO_PUBLIC_FINNHUB_API_KEY ?? '',

  ALPHA_VANTAGE_API_KEY: process.env.EXPO_PUBLIC_ALPHA_VANTAGE_API_KEY ?? '',

  FMP_API_KEY: process.env.EXPO_PUBLIC_FMP_API_KEY ?? '',

  GROQ_API_KEY: process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '',

  USE_REAL_NEWS: process.env.EXPO_PUBLIC_USE_REAL_NEWS !== 'false',
};
