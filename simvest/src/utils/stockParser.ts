/**
 * Utility functions for parsing and handling stock symbols in text
 */

// Extract stock symbols from text (format: $SYMBOL)
export const extractStockSymbols = (text: string): string[] => {
  const symbolRegex = /\$([A-Z]{1,5})\b/gi;
  const matches = text.match(symbolRegex);
  if (!matches) return [];

  const symbols = matches.map((match) => match.substring(1).toUpperCase());
  return [...new Set(symbols)];
};

// Get the primary stock symbol (first one found, or most mentioned)
export const getPrimaryStockSymbol = (text: string): string | null => {
  const symbols = extractStockSymbols(text);
  if (symbols.length === 0) return null;

  const counts = new Map<string, number>();
  symbols.forEach((symbol) => {
    const count = (text.match(new RegExp(`\\$${symbol}\\b`, 'gi')) || []).length;
    counts.set(symbol, count);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])[0][0];
};

// Parse text and create segments with stock symbols as clickable
export interface TextSegment {
  text: string;
  isStock: boolean;
  symbol?: string;
}

export const parseTextWithStocks = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  const symbolRegex = /\$([A-Z]{1,5})\b/gi;
  let lastIndex = 0;
  let match;

  while ((match = symbolRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, match.index),
        isStock: false,
      });
    }

    segments.push({
      text: match[0],
      isStock: true,
      symbol: match[1].toUpperCase(),
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      isStock: false,
    });
  }

  if (segments.length === 0) {
    segments.push({ text, isStock: false });
  }

  return segments;
};

/** Trailing `$` + partial symbol being typed (for compose autocomplete). */
export function getActiveDollarQuery(text: string): string | null {
  const match = text.match(/\$([A-Za-z]{0,5})$/);
  if (!match) return null;
  return match[1].toUpperCase();
}
