import { userService } from './userService';

// Demo data to populate the database
export const demoPortfolioPositions = [
  {
    symbol: 'AAPL',
    shares: 10,
    avgPrice: 150.00,
    currentPrice: 175.50,
    totalValue: 1755.00,
    totalReturn: 255.00,
    returnPercentage: 17.0
  },
  {
    symbol: 'TSLA',
    shares: 5,
    avgPrice: 200.00,
    currentPrice: 220.00,
    totalValue: 1100.00,
    totalReturn: 100.00,
    returnPercentage: 10.0
  },
  {
    symbol: 'NVDA',
    shares: 8,
    avgPrice: 300.00,
    currentPrice: 450.00,
    totalValue: 3600.00,
    totalReturn: 1200.00,
    returnPercentage: 50.0
  }
];

export const demoTradingHistory = [
  {
    symbol: 'AAPL',
    action: 'buy' as const,
    shares: 10,
    price: 150.00,
    totalAmount: 1500.00,
    fees: 9.99
  },
  {
    symbol: 'TSLA',
    action: 'buy' as const,
    shares: 5,
    price: 200.00,
    totalAmount: 1000.00,
    fees: 9.99
  },
  {
    symbol: 'NVDA',
    action: 'buy' as const,
    shares: 8,
    price: 300.00,
    totalAmount: 2400.00,
    fees: 9.99
  }
];

// Function to populate demo data for a user
export const populateDemoData = async (uid: string) => {
  try {
    console.log('Populating demo data for user:', uid);
    
    // Add portfolio positions
    for (const position of demoPortfolioPositions) {
      await userService.addPortfolioPosition(uid, position);
    }
    
    // Add trading history
    for (const trade of demoTradingHistory) {
      await userService.addTradingHistory(uid, trade);
    }
    
    console.log('Demo data populated successfully!');
  } catch (error) {
    console.error('Error populating demo data:', error);
    throw error;
  }
};

// Function to clear demo data (for testing)
export const clearDemoData = async (uid: string) => {
  try {
    console.log('Clearing demo data for user:', uid);
    
    // Note: This would require additional methods in userService
    // For now, we'll just log the intention
    console.log('Demo data clear functionality would be implemented here');
  } catch (error) {
    console.error('Error clearing demo data:', error);
    throw error;
  }
};
