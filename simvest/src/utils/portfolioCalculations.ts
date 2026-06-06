/**
 * Period returns (YTD, 1W, 1M, 1Y): how they're calculated
 *
 * 1) Period dates (start of period)
 *    - YTD: Jan 1 of current year
 *    - 1W: 7 calendar days ago
 *    - 1M: same day, 1 calendar month ago
 *    - 1Y: same day, 1 calendar year ago
 *
 * 2) "Start value" for each period (portfolio value at that date)
 *    - If we have a Firestore snapshot on or before that date, we use it (accurate).
 *    - Otherwise we replay trades up to that date and value open positions at the last
 *      trade price for each symbol (approximation; no historical market prices).
 *
 * 3) "End value"
 *    - Always current total portfolio value (cash + market value of all positions).
 *
 * 4) Formula (same for each period)
 *    - $ change = end value − start value
 *    - % change = (end value − start value) / start value × 100  (0% if start value ≤ 0)
 *
 * For accuracy: we save a daily snapshot (total portfolio value) when you load the
 * portfolio or after a trade. Once those dates have snapshots, period returns use
 * real saved values instead of the replay approximation.
 */

import { TradingHistory } from '../services/userService';

function getTradeTime(trade: TradingHistory): number {
  if (trade.timestamp?.toDate) return trade.timestamp.toDate().getTime();
  return new Date(trade.timestamp).getTime();
}

/**
 * Portfolio value at asOfDate by replaying all trades with timestamp <= asOfDate.
 * Open positions are valued at the last trade price that affected them (approximation).
 */
export function getPortfolioValueAtDate(
  trades: TradingHistory[],
  startingCash: number,
  asOfDate: Date
): number {
  const asOfTime = asOfDate.getTime();
  const sorted = [...trades].sort((a, b) => getTradeTime(a) - getTradeTime(b));
  const filtered = sorted.filter((t) => getTradeTime(t) <= asOfTime);

  let runningCash = startingCash;
  const positions = new Map<string, { shares: number; avgPrice: number; lastPrice: number }>();

  for (const trade of filtered) {
    const symbol = trade.symbol;
    const pos = positions.get(symbol) || { shares: 0, avgPrice: 0, lastPrice: trade.price };

    if (trade.action === 'buy') {
      const totalCost = trade.totalAmount + (trade.fees || 0);
      const newShares = pos.shares + trade.shares;
      const newAvgPrice =
        newShares > 0
          ? (pos.avgPrice * pos.shares + trade.price * trade.shares) / newShares
          : trade.price;
      positions.set(symbol, { shares: newShares, avgPrice: newAvgPrice, lastPrice: trade.price });
      runningCash -= totalCost;
    } else {
      const totalReceived = trade.totalAmount - (trade.fees || 0);
      const newShares = pos.shares - trade.shares;
      if (newShares <= 0) {
        positions.delete(symbol);
      } else {
        positions.set(symbol, {
          shares: newShares,
          avgPrice: pos.avgPrice,
          lastPrice: trade.price,
        });
      }
      runningCash += totalReceived;
    }
  }

  const positionsValue = Array.from(positions.values()).reduce(
    (sum, p) => sum + p.shares * p.lastPrice,
    0
  );
  return runningCash + positionsValue;
}

export type PeriodReturn = {
  changeDollars: number;
  changePercent: number;
  valueStart: number;
};

/**
 * Period return from valueStart to valueEnd.
 */
function periodReturn(valueStart: number, valueEnd: number): PeriodReturn {
  const changeDollars = valueEnd - valueStart;
  const changePercent = valueStart > 0 ? (changeDollars / valueStart) * 100 : 0;
  return { changeDollars, changePercent, valueStart };
}

export type PeriodReturnsResult = {
  ytd: PeriodReturn;
  oneWeek: PeriodReturn;
  oneMonth: PeriodReturn;
  oneYear: PeriodReturn;
};

/**
 * Optional snapshot values for start of each period (from Firestore). When provided, uses these
 * instead of trade-replay for accurate period returns.
 */
export type PeriodSnapshotValues = {
  ytd?: number | null;
  oneWeek?: number | null;
  oneMonth?: number | null;
  oneYear?: number | null;
};

/** When replayed period start equals starting cash (no history), use cost-basis start so period return matches all-time P/L. */
const TOLERANCE = 1;

function periodStartValue(
  fromReplay: number,
  startingCash: number,
  currentPortfolioValue: number,
  allTimeReturnDollars: number | undefined
): number {
  if (allTimeReturnDollars == null) return fromReplay;
  if (Math.abs(fromReplay - startingCash) <= TOLERANCE) {
    return currentPortfolioValue - allTimeReturnDollars;
  }
  return fromReplay;
}

/**
 * Compute portfolio value at YTD, 1W, 1M, 1Y ago and return period returns vs current value.
 * When snapshotValues are provided (e.g. from Firestore), uses them for accurate historical value;
 * otherwise falls back to trade replay (approximation).
 * When there is no snapshot and replay gives startingCash, uses cost-basis start (current - allTimeReturn)
 * so period returns match the all-time P/L (+$111 style) instead of vs starting cash (+$125).
 */
export function getPeriodReturns(
  trades: TradingHistory[],
  startingCash: number,
  currentPortfolioValue: number,
  snapshotValues?: PeriodSnapshotValues | null,
  allTimeReturnDollars?: number
): PeriodReturnsResult {
  const now = new Date();

  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const rawYTD =
    snapshotValues?.ytd != null
      ? snapshotValues.ytd
      : getPortfolioValueAtDate(trades, startingCash, ytdStart);
  const raw1W =
    snapshotValues?.oneWeek != null
      ? snapshotValues.oneWeek
      : getPortfolioValueAtDate(trades, startingCash, oneWeekAgo);
  const raw1M =
    snapshotValues?.oneMonth != null
      ? snapshotValues.oneMonth
      : getPortfolioValueAtDate(trades, startingCash, oneMonthAgo);
  const raw1Y =
    snapshotValues?.oneYear != null
      ? snapshotValues.oneYear
      : getPortfolioValueAtDate(trades, startingCash, oneYearAgo);

  const valueYTD = periodStartValue(rawYTD, startingCash, currentPortfolioValue, allTimeReturnDollars);
  const value1W = periodStartValue(raw1W, startingCash, currentPortfolioValue, allTimeReturnDollars);
  const value1M = periodStartValue(raw1M, startingCash, currentPortfolioValue, allTimeReturnDollars);
  const value1Y = periodStartValue(raw1Y, startingCash, currentPortfolioValue, allTimeReturnDollars);

  return {
    ytd: periodReturn(valueYTD, currentPortfolioValue),
    oneWeek: periodReturn(value1W, currentPortfolioValue),
    oneMonth: periodReturn(value1M, currentPortfolioValue),
    oneYear: periodReturn(value1Y, currentPortfolioValue),
  };
}
