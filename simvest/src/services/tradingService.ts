import {
  userService,
  PortfolioPosition,
  TradingHistory,
  UserProfile,
  computeWinRateFromTradingHistory,
} from './userService';
import { STARTING_CASH } from '../constants/theme';
import { stockPriceService } from './stockPriceService';
import { gamificationService } from './gamificationService';
import { referralService } from './referralService';

// Trading fee (free trading - no fees)
const TRADING_FEE = 0;

class TradingService {
  // Get current real price for a stock. Returns null if unavailable (rate limit, no data).
  async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      return await stockPriceService.getCurrentPrice(symbol);
    } catch (error) {
      console.error(`Error getting price for ${symbol}:`, error);
      return null;
    }
  }

  // Synchronous version for backward compatibility (uses cached price if available)
  getCurrentPriceSync(symbol: string): number {
    // This is a fallback for components that need immediate price
    // It will return a default value, but components should use async version
    return 100.0;
  }

  // Get user's available cash (uses stored cash when available)
  async getAvailableCash(uid: string): Promise<number> {
    try {
      await referralService.reconcileReferralBonusCash(uid);
      const profile = await userService.getUserProfile(uid);
      if (!profile) return STARTING_CASH;
      const portfolio = await userService.getUserPortfolio(uid);
      const investedValue = portfolio.reduce((sum, p) => sum + p.totalValue, 0);
      const totalValue = profile.totalPortfolioValue || STARTING_CASH;
      const cash = profile.cash != null ? profile.cash : totalValue - investedValue;
      return Math.max(0, cash);
    } catch (error) {
      console.error('Error getting available cash:', error);
      return STARTING_CASH;
    }
  }

  // Get user's current position for a stock
  async getPosition(uid: string, symbol: string): Promise<PortfolioPosition | null> {
    try {
      const portfolio = await userService.getUserPortfolio(uid);
      return portfolio.find(p => p.symbol.toUpperCase() === symbol.toUpperCase()) || null;
    } catch (error) {
      console.error('Error getting position:', error);
      return null;
    }
  }

  // Buy stock
  async buyStock(
    uid: string,
    symbol: string,
    shares: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (shares <= 0 || !isFinite(shares) || isNaN(shares)) {
        return { success: false, message: 'Invalid number of shares' };
      }

      const symU = symbol.toUpperCase();

      // Price fetch and referral cash reconcile are independent - run together
      const [currentPrice] = await Promise.all([
        this.getCurrentPrice(symbol),
        referralService.reconcileReferralBonusCash(uid),
      ]);
      if (currentPrice == null) {
        return { success: false, message: 'Unable to load price. Please try again in a moment.' };
      }

      const [profile, oldPortfolio] = await Promise.all([
        userService.getUserProfile(uid),
        userService.getUserPortfolio(uid, false),
      ]);
      if (!profile) {
        return { success: false, message: 'User profile not found' };
      }

      const oldInvestedValue = oldPortfolio.reduce((sum, p) => sum + p.totalValue, 0);
      const oldTotal = profile.totalPortfolioValue || STARTING_CASH;
      const oldCash = profile.cash != null ? profile.cash : oldTotal - oldInvestedValue;
      const availableCash = Math.max(0, oldCash);

      const totalCost = currentPrice * shares + TRADING_FEE;
      if (totalCost > availableCash) {
        return {
          success: false,
          message: `Insufficient funds. Need ${totalCost.toFixed(2)}, have ${availableCash.toFixed(2)}`,
        };
      }

      const existingPosition =
        oldPortfolio.find((p) => p.symbol.toUpperCase() === symU) || null;

      if (existingPosition) {
        // Update existing position (calculate new average price)
        const totalShares = existingPosition.shares + shares;
        const totalCostBasis = existingPosition.shares * existingPosition.avgPrice + currentPrice * shares;
        const newAvgPrice = totalCostBasis / totalShares;
        const newTotalValue = totalShares * currentPrice;
        const newTotalReturn = newTotalValue - totalCostBasis;
        const newReturnPercentage = existingPosition.avgPrice > 0
          ? ((currentPrice - newAvgPrice) / newAvgPrice) * 100
          : 0;

        const updatedPosition: Omit<PortfolioPosition, 'lastUpdated'> = {
          symbol: symU,
          shares: totalShares,
          avgPrice: newAvgPrice,
          currentPrice: currentPrice,
          totalValue: newTotalValue,
          totalReturn: newTotalReturn,
          returnPercentage: newReturnPercentage,
        };

        await userService.addPortfolioPosition(uid, updatedPosition, true); // Skip auto-update, we'll update manually
      } else {
        // Create new position
        const newPosition: Omit<PortfolioPosition, 'lastUpdated'> = {
          symbol: symU,
          shares: shares,
          avgPrice: currentPrice,
          currentPrice: currentPrice,
          totalValue: shares * currentPrice,
          totalReturn: 0,
          returnPercentage: 0,
        };

        await userService.addPortfolioPosition(uid, newPosition, true); // Skip auto-update, we'll update manually
      }

      // Add to trading history
      await userService.addTradingHistory(uid, {
        symbol: symU,
        action: 'buy',
        shares: shares,
        price: currentPrice,
        totalAmount: currentPrice * shares,
        fees: TRADING_FEE,
      });

      const investedFromOthers = oldPortfolio
        .filter((p) => p.symbol.toUpperCase() !== symU)
        .reduce((sum, p) => sum + p.totalValue, 0);
      const newTradedValue = existingPosition
        ? (existingPosition.shares + shares) * currentPrice
        : shares * currentPrice;
      const investedValue = investedFromOthers + newTradedValue;
      const newCash = oldCash - totalCost;
      const totalPortfolioValue = Math.max(0, newCash) + investedValue;
      const allTimeReturn = totalPortfolioValue - STARTING_CASH;
      const currentTrades = profile.totalTrades || 0;
      await userService.updateUserProfile(uid, {
        totalPortfolioValue,
        totalReturn: allTimeReturn,
        cash: Math.max(0, newCash),
        totalTrades: currentTrades + 1,
      });
      userService.savePortfolioSnapshot(uid, totalPortfolioValue).catch(() => {});

      await Promise.all([
        gamificationService.awardXP(uid, 10, 'Trade executed'),
        gamificationService.updateStreak(uid),
      ]);

      return {
        success: true,
        message: `Successfully bought ${shares} shares of ${symbol.toUpperCase()} at $${currentPrice.toFixed(2)}`,
      };
    } catch (error) {
      console.error('Error buying stock:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to buy stock',
      };
    }
  }

  // Sell stock
  async sellStock(
    uid: string,
    symbol: string,
    shares: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (shares <= 0 || isNaN(shares) || !isFinite(shares)) {
        return { success: false, message: 'Invalid number of shares' };
      }

      const symU = symbol.toUpperCase();

      const [currentPrice] = await Promise.all([
        this.getCurrentPrice(symbol),
        referralService.reconcileReferralBonusCash(uid),
      ]);
      if (currentPrice == null) {
        return { success: false, message: 'Unable to load price. Please try again in a moment.' };
      }

      const [profile, oldPortfolio] = await Promise.all([
        userService.getUserProfile(uid),
        userService.getUserPortfolio(uid, false),
      ]);
      if (!profile) {
        return { success: false, message: 'User profile not found' };
      }

      const position = oldPortfolio.find((p) => p.symbol.toUpperCase() === symU) || null;
      if (!position) {
        return { success: false, message: `You don't own any ${symU}` };
      }

      if (shares > position.shares) {
        return {
          success: false,
          message: `You only own ${position.shares} shares of ${symU}`,
        };
      }

      const proceeds = currentPrice * shares - TRADING_FEE;

      const oldInvestedValue = oldPortfolio.reduce((sum, p) => sum + p.totalValue, 0);
      const oldTotal = profile.totalPortfolioValue || STARTING_CASH;
      const oldCash = profile.cash != null ? profile.cash : oldTotal - oldInvestedValue;

      // Update or remove position
      if (shares === position.shares) {
        // Selling all shares - delete position
        await userService.deletePortfolioPosition(uid, symU);
      } else {
        // Partial sale - update position
        const remainingShares = position.shares - shares;
        const updatedPosition: Omit<PortfolioPosition, 'lastUpdated'> = {
          symbol: symU,
          shares: remainingShares,
          avgPrice: position.avgPrice, // Keep same avg price
          currentPrice: currentPrice,
          totalValue: remainingShares * currentPrice,
          totalReturn: remainingShares * (currentPrice - position.avgPrice),
          returnPercentage: position.avgPrice > 0
            ? ((currentPrice - position.avgPrice) / position.avgPrice) * 100
            : 0,
        };
        await userService.addPortfolioPosition(uid, updatedPosition, true); // Skip auto-update, we'll update manually
      }

      // Add to trading history
      await userService.addTradingHistory(uid, {
        symbol: symU,
        action: 'sell',
        shares: shares,
        price: currentPrice,
        totalAmount: currentPrice * shares,
        fees: TRADING_FEE,
      });

      const investedFromOthers = oldPortfolio
        .filter((p) => p.symbol.toUpperCase() !== symU)
        .reduce((sum, p) => sum + p.totalValue, 0);
      const newTradedValue =
        shares === position.shares ? 0 : (position.shares - shares) * currentPrice;
      const investedValue = investedFromOthers + newTradedValue;
      const newCash = oldCash + proceeds;
      const totalPortfolioValue = Math.max(0, newCash) + investedValue;
      const allTimeReturn = totalPortfolioValue - STARTING_CASH;
      const profitPerShare = currentPrice - position.avgPrice;
      const isWin = profitPerShare > 0;
      const currentTrades = profile.totalTrades || 0;
      const currentWins = profile.totalWins || 0;
      await userService.updateUserProfile(uid, {
        totalPortfolioValue,
        totalReturn: allTimeReturn,
        cash: Math.max(0, newCash),
        totalTrades: currentTrades + 1,
        totalWins: isWin ? currentWins + 1 : currentWins,
      });
      userService.savePortfolioSnapshot(uid, totalPortfolioValue).catch(() => {});

      await gamificationService.awardXP(uid, 10, 'Trade executed');
      if (isWin) {
        await gamificationService.awardXP(uid, 25, 'Winning trade');
      }
      await gamificationService.updateStreak(uid);

      // Defer achievement stats (extra read) so the user sees success sooner
      void userService.getUserTradingHistory(uid, 100).then((tradingHistory) => {
        const sellTrades = tradingHistory.filter((t) => t.action === 'sell');
        const totalRealizedTrades = sellTrades.length;
        const winRate = computeWinRateFromTradingHistory(tradingHistory) ?? 0;
        return gamificationService.checkAchievements(uid, {
          winRate,
          totalRealizedTrades,
        });
      }).catch(console.error);

      return {
        success: true,
        message: `Successfully sold ${shares} shares of ${symbol.toUpperCase()} at $${currentPrice.toFixed(2)}`,
      };
    } catch (error) {
      console.error('Error selling stock:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to sell stock',
      };
    }
  }

  // Update portfolio value in user profile (recalculates total return, but keeps cash unchanged)
  private async updatePortfolioValue(uid: string): Promise<void> {
    try {
      const profile = await userService.getUserProfile(uid);
      if (!profile) return;

      const portfolio = await userService.getUserPortfolio(uid, false); // Don't refresh prices here
      
      // Calculate total return from all positions
      const totalReturn = portfolio.reduce((sum, p) => sum + p.totalReturn, 0);

      // Update total return only (totalPortfolioValue was already updated by buy/sell)
      await userService.updateUserProfile(uid, {
        totalReturn: totalReturn,
      });
    } catch (error) {
      console.error('Error updating portfolio value:', error);
    }
  }

  // Get popular stocks for trading
  async getPopularStocks(): Promise<Array<{ symbol: string; name: string; price: number }>> {
    const stockNames: Record<string, string> = {
      AAPL: 'Apple Inc.',
      MSFT: 'Microsoft Corporation',
      GOOGL: 'Alphabet Inc.',
      AMZN: 'Amazon',
      NVDA: 'Nvidia',
      META: 'Meta Platforms, Inc.',
      TSLA: 'Tesla, Inc.',
      NFLX: 'Netflix, Inc.',
      AMD: 'Advanced Micro Devices',
      INTC: 'Intel Corporation',
      SPY: 'SPDR S&P 500 ETF',
      QQQ: 'Invesco QQQ Trust',
    };

    const symbols = Object.keys(stockNames);
    const prices = await Promise.all(symbols.map(symbol => this.getCurrentPrice(symbol)));

    return symbols.map((symbol, index) => ({
      symbol,
      name: stockNames[symbol] || symbol,
      price: prices[index] ?? 0,
    }));
  }
}

export const tradingService = new TradingService();
export default tradingService;



