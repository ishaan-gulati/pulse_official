import { API_KEYS } from '../config/apiKeys';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { stockSearchService } from './stockSearchService';
import { marketDataService } from './marketDataService';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for stock summaries
const STOCK_CACHE_KEY_VERSION = 'v3'; // bump to invalidate when we add news/profile/website context
const PORTFOLIO_EXPLAINS_PER_DAY = 12;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const AI_EXPLAIN_ERRORS = {
  NO_API_KEY: 'NO_API_KEY',
  LIMIT_REACHED: 'LIMIT_REACHED',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function callGroq(prompt: string, maxTokens: number = 1024): Promise<string> {
  const key = API_KEYS.GROQ_API_KEY?.trim();
  if (!key) {
    throw new Error(AI_EXPLAIN_ERRORS.NO_API_KEY);
  }

  const body = JSON.stringify({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.7,
  });

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body,
  });

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2500));
    const retryRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body,
    });
    if (retryRes.ok) {
      const data = await retryRes.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === 'string') return text.trim();
    }
    throw new Error(AI_EXPLAIN_ERRORS.RATE_LIMIT);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error('Groq API error:', res.status, errText);
    throw new Error(AI_EXPLAIN_ERRORS.NETWORK_ERROR);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new Error(AI_EXPLAIN_ERRORS.UNKNOWN);
  }
  return text.trim();
}

function stockCacheDocId(symbol: string): string {
  return `${symbol.toUpperCase()}_${STOCK_CACHE_KEY_VERSION}`;
}

/** Get cached stock summary from Firestore (valid for 24h). */
async function getCachedStock(symbol: string): Promise<string | null> {
  const ref = doc(db, 'aiCache', stockCacheDocId(symbol));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  const cachedAt = d?.cachedAt?.toMillis?.() ?? 0;
  if (Date.now() - cachedAt > CACHE_TTL_MS) return null;
  return typeof d?.explanation === 'string' ? d.explanation : null;
}

/** Store stock summary in Firestore. */
async function setCachedStock(symbol: string, explanation: string): Promise<void> {
  const ref = doc(db, 'aiCache', stockCacheDocId(symbol));
  await setDoc(ref, { explanation, cachedAt: new Date() });
}

/** Get current portfolio explain usage for user (count + date). */
async function getPortfolioUsage(uid: string): Promise<{ count: number; date: string }> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { count: 0, date: '' };
  const d = snap.data();
  const date = (d?.aiPortfolioExplainsDate as string) || '';
  const count = typeof d?.aiPortfolioExplainsToday === 'number' ? d.aiPortfolioExplainsToday : 0;
  return { count, date };
}

/** Increment portfolio explain count for today. */
async function incrementPortfolioUsage(uid: string): Promise<void> {
  const ref = doc(db, 'users', uid);
  const today = getTodayDateString();
  const { count, date } = await getPortfolioUsage(uid);
  const newCount = date === today ? count + 1 : 1;
  await updateDoc(ref, {
    aiPortfolioExplainsToday: newCount,
    aiPortfolioExplainsDate: today,
  });
}

/**
 * Resolve ticker to the exact company name using search (so AI explains the right company, e.g. IREN = Iris Energy not Italian utility).
 */
async function resolveCompanyName(symbol: string): Promise<string | null> {
  try {
    const results = await stockSearchService.searchStocks(symbol, 8);
    const exact = results.find((r) => r.symbol.toUpperCase() === symbol.toUpperCase());
    return exact?.name ?? null;
  } catch {
    return null;
  }
}

/** Company info from search (name + exchange/type for sector context). */
export interface ResolvedCompanyInfo {
  name: string | null;
  type: string;
}

/**
 * Resolve ticker to company name and exchange/type (for portfolio context and sector hints).
 */
async function resolveCompanyInfo(symbol: string): Promise<ResolvedCompanyInfo> {
  try {
    const results = await stockSearchService.searchStocks(symbol, 8);
    const exact = results.find((r) => r.symbol.toUpperCase() === symbol.toUpperCase());
    return {
      name: exact?.name ?? null,
      type: exact?.type ?? 'US Equity',
    };
  } catch {
    return { name: null, type: 'US Equity' };
  }
}

/** Structured input for portfolio explain so we can resolve each ticker and give richer context. */
export interface PortfolioExplainInput {
  totalPortfolioValue: number;
  cash: number;
  positions: Array<{ symbol: string; shares: number; totalValue: number }>;
}

/**
 * AI summary for a stock. Cached per symbol for 24h.
 * Uses company profile, recent news, and optional website snippet so the AI can give accurate, up-to-date info (e.g. pivots, strategy changes).
 */
export async function explainStock(symbol: string): Promise<string> {
  const cached = await getCachedStock(symbol);
  if (cached) return cached;

  const companyName = await resolveCompanyName(symbol);
  const [profile, news] = await Promise.all([
    marketDataService.getCompanyProfile(symbol),
    marketDataService.getCompanyNews(symbol, 6),
  ]);

  let websiteSnippet = '';
  if (profile?.weburl && profile.weburl.startsWith('http')) {
    try {
      const raw = await marketDataService.fetchFullArticleContent(profile.weburl);
      if (raw && raw.length > 100) {
        websiteSnippet = raw.slice(0, 2800).trim();
        if (raw.length > 2800) websiteSnippet += '...';
      }
    } catch {
      // Ignore: CORS/timeout possible; we still have profile + news
    }
  }

  const companyContext = companyName
    ? `The stock ticker ${symbol} refers specifically to ${companyName}. Explain this company - do not confuse it with any other company with a similar name or ticker.`
    : `The stock ticker is ${symbol}. Identify the correct company for this ticker (e.g. IREN is Iris Energy, a Bitcoin mining company - not Iren S.p.A. or other companies).`;

  const profileBlock =
    profile?.description?.trim()
      ? `\nOfficial company description (use for accuracy):\n${profile.description.slice(0, 1200)}`
      : '';

  const newsBlock =
    news.length > 0
      ? `\nRecent headlines (use these for up-to-date info; mention any pivot, strategy change, or major development if relevant):\n${news.map((n) => `- ${n.headline} (${n.source}${n.date ? `, ${n.date}` : ''})`).join('\n')}`
      : '';

  const websiteBlock = websiteSnippet
    ? `\nExcerpt from the company's website (use for current positioning and messaging):\n${websiteSnippet}`
    : '';

  const prompt = `${companyContext}
${profileBlock}
${newsBlock}
${websiteBlock}

Using the information above (especially recent news and any website excerpt), explain the company like you're talking to a friend who's curious about the stock. In 2-4 short paragraphs: what the company actually does, why people care about it, and a couple real pros or risks. If there was a recent pivot, strategy change, or major development, mention it in plain English. Sound human and conversational, not like a textbook. Don't give specific buy/sell advice.`;
  const summary = await callGroq(prompt, 1280);
  await setCachedStock(symbol, summary);
  return summary;
}

function formatCurrencyForPrompt(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

/**
 * AI summary for the user's portfolio. Limited to PORTFOLIO_EXPLAINS_PER_DAY per user.
 * Accepts either a pre-built summary string (legacy) or structured PortfolioExplainInput.
 * When given structured input, resolves each ticker to the correct company name and builds
 * a richer context so the AI can give company-specific, sector, and macro color.
 */
export async function explainPortfolio(
  uid: string,
  portfolioSummaryOrInput: string | PortfolioExplainInput
): Promise<string> {
  const today = getTodayDateString();
  const { count, date } = await getPortfolioUsage(uid);
  const effectiveCount = date === today ? count : 0;
  if (effectiveCount >= PORTFOLIO_EXPLAINS_PER_DAY) {
    throw new Error(AI_EXPLAIN_ERRORS.LIMIT_REACHED);
  }

  const isStructured =
    typeof portfolioSummaryOrInput === 'object' &&
    portfolioSummaryOrInput !== null &&
    'totalPortfolioValue' in portfolioSummaryOrInput &&
    'positions' in portfolioSummaryOrInput;

  let context: string;
  let promptInstruction: string;

  if (isStructured) {
    const input = portfolioSummaryOrInput as PortfolioExplainInput;
    const total = input.totalPortfolioValue;
    const positions = input.positions || [];

    // Resolve each holding to company name + type (exchange)
    const resolvedUnsorted = await Promise.all(
      positions.map(async (p) => {
        const info = await resolveCompanyInfo(p.symbol);
        const pct = total > 0 ? (p.totalValue / total) * 100 : 0;
        return {
          symbol: p.symbol,
          companyName: info.name || p.symbol,
          type: info.type,
          shares: p.shares,
          totalValue: p.totalValue,
          pct,
        };
      })
    );
    // Sort by position size (largest first) so the AI discusses bigger holdings in more depth
    const resolved = [...resolvedUnsorted].sort((a, b) => b.totalValue - a.totalValue);

    // No Finnhub news calls here - saves rate limit for quotes and Search screen market news. Groq handles explanation from context only.
    const totalStr = formatCurrencyForPrompt(input.totalPortfolioValue);
    const cashStr = formatCurrencyForPrompt(input.cash);
    const holdingsBlob =
      resolved.length > 0
        ? resolved
            .map(
              (r) =>
                `${r.symbol} (${r.companyName}) - ${r.shares} shares, ${formatCurrencyForPrompt(r.totalValue)} (${r.pct.toFixed(0)}% of portfolio) - ${r.type}`
            )
            .join('; ')
        : 'No stock holdings yet.';

    const byType = resolved.reduce<Record<string, string[]>>((acc, r) => {
      const t = r.type || 'Other';
      if (!acc[t]) acc[t] = [];
      acc[t].push(`${r.symbol} (${r.companyName})`);
      return acc;
    }, {});
    const sectorBlob =
      Object.keys(byType).length > 0
        ? 'Concentration by exchange/type: ' +
          Object.entries(byType)
            .map(([type, names]) => `${type}: ${names.join(', ')}`)
            .join('; ')
        : '';

    // Fetch recent company news for top 2 holdings so AI can mention pivots / developments
    const topTwo = resolved.slice(0, 2);
    const newsBySymbol: Record<string, string> = {};
    await Promise.all(
      topTwo.map(async (r) => {
        const articles = await marketDataService.getCompanyNews(r.symbol, 3);
        if (articles.length > 0) {
          newsBySymbol[r.symbol] = articles.map((n) => `${n.headline} (${n.source}${n.date ? `, ${n.date}` : ''})`).join('; ');
        }
      })
    );
    const newsBlob =
      Object.keys(newsBySymbol).length > 0
        ? '\nRecent headlines for top holdings (mention any pivot or major development if relevant): ' +
          Object.entries(newsBySymbol)
            .map(([sym, text]) => `${sym}: ${text}`)
            .join(' | ')
        : '';

    context = `Total portfolio value ${totalStr}, Cash ${cashStr}.

Holdings (listed largest to smallest by value - discuss larger positions in MORE detail and smaller ones more briefly): ${holdingsBlob}.
${sectorBlob ? sectorBlob + '.' : ''}${newsBlob}`;

    promptInstruction = `Using the exact companies and tickers above, write a clear portfolio overview. Important:
1) Weight your discussion by position size: spend more space on the user's biggest holdings (what the company does, why it matters). Don't just say "X is your largest holding" - go into real depth on the top one or two. For smaller positions, a short sentence each is enough.
2) Mention sector/theme concentration and what it could mean for risk or opportunity.
3) If recent headlines for top holdings mention a pivot, strategy change, or major development, briefly note it so the user has accurate, up-to-date context.
You can mention sector trends or volatility in general terms. Do NOT assert specific macro facts (e.g. interest rates, Fed policy, inflation, "rates are rising") - we don't have live data for that.
Keep a warm, conversational tone - no jargon. Don't give specific buy/sell advice. Write 4-6 short paragraphs so the biggest positions get real attention.`;
  } else {
    context = portfolioSummaryOrInput as string;
    promptInstruction = `In 2-4 short paragraphs, talk to them like a helpful friend: what their portfolio is actually doing (how spread out it is, where the risk is), and one or two simple things they might want to think about. Use a warm, conversational tone - no jargon, no corporate speak. Don't tell them to buy or sell anything specific.`;
  }

  const prompt = `Someone's got a simulated investing portfolio. Here's the rundown:

${context}

${promptInstruction}`;
  const summary = await callGroq(prompt, isStructured ? 1536 : 1024);
  await incrementPortfolioUsage(uid);
  return summary;
}

export const aiExplainService = {
  explainStock,
  explainPortfolio,
  getPortfolioUsage,
  getTodayDateString,
  PORTFOLIO_EXPLAINS_PER_DAY,
};
