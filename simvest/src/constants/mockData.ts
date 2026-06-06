/**
 * Mock data for development and testing
 * TODO: Replace with real data from Firestore/API
 */

import { FeedPost, Holding, Trade, Notification, Chat } from '../types';

export const MOCK_FEED: FeedPost[] = [
  {
    id: '1',
    user: {
      name: 'Ishaan Gulati',
      handle: 'ishaan1gulati',
      tags: ['founder', 'admin', 'verified'],
    },
    topic: 'Welcome',
    title: 'Welcome to Pulse - The Future of Social Trading! 🚀',
    body: 'Excited to launch this platform where traders can compete, share insights, and build their portfolios together. Let\'s make trading social and fun!',
    minutesAgo: 5,
    stats: { likes: 25, comments: 8, reposts: 12, saves: 15 },
  },
  {
    id: '2',
    user: {
      name: 'Ecaz',
      handle: 'ecaz',
    },
    topic: 'Chart',
    title: 'The Rogue VIX Story - 7/29',
    body: 'Sharing my theory of tomorrow\'s movements…',
    minutesAgo: 28,
    stats: { likes: 10, comments: 5, reposts: 1, saves: 2 },
  },
  {
    id: '3',
    user: {
      name: 'WarrenBuffett',
      handle: 'wbuffett',
    },
    topic: 'Earnings',
    title: 'Big earnings coming up! $META $MSFT',
    minutesAgo: 120,
    stats: { likes: 44, comments: 12 },
  },
];

export const MOCK_HOLDINGS: Holding[] = [
  { symbol: 'AAPL', shares: 10, price: 190.12, changePct: 0.8, avgCost: 175.0 },
  { symbol: 'MSFT', shares: 5, price: 425.75, changePct: -0.4, avgCost: 410.0 },
  { symbol: 'NVDA', shares: 2, price: 119.3, changePct: 1.6, avgCost: 130.0 },
];

export const MOCK_TRADES: Trade[] = [
  { id: 't1', symbol: 'AAPL', side: 'BUY', shares: 5, price: 170.0, time: '2d' },
  { id: 't2', symbol: 'MSFT', side: 'SELL', shares: 2, price: 430.0, pnl: 40.0, time: '1d' },
  { id: 't3', symbol: 'NVDA', side: 'SELL', shares: 1, price: 115.0, pnl: -10.0, time: '20h' },
  { id: 't4', symbol: 'AAPL', side: 'BUY', shares: 5, price: 180.0, time: '10h' },
  { id: 't5', symbol: 'TSLA', side: 'SELL', shares: 1, price: 250.0, pnl: 30.0, time: '3h' },
];

export const MOCK_NOTIFICATIONS: Notification[] = Array.from({ length: 6 }).map((_, i) => ({
  id: `n-${i}`,
  title: i % 2 === 0 ? 'New comment on your post' : 'Price alert triggered',
  body: i % 2 === 0 ? 'Nice take on $NVDA' : '$AAPL crossed $190',
  time: `${i + 1}h`,
}));

export const MOCK_CHATS: Chat[] = [
  { id: '1', name: 'BTBT', last: 'njt: https://afterhour.com/FerrariFund/…', unread: 99 },
  { id: '2', name: 'BMNR', last: 'thanks.', unread: 64 },
  { id: '3', name: 'BTCS', last: 'I WILL WAIT', unread: 99 },
  { id: '4', name: 'SBET', last: 'That\'s crazy', unread: 99 },
];

export const STOCK_SUGGESTIONS = [
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'US Equity', logo: 'https://logo.clearbit.com/apple.com' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'US Equity', logo: 'https://logo.clearbit.com/microsoft.com' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', type: 'US Equity', logo: 'https://logo.clearbit.com/abc.xyz' },
  { symbol: 'AMZN', name: 'Amazon', type: 'US Equity', logo: 'https://logo.clearbit.com/amazon.com' },
  { symbol: 'NVDA', name: 'Nvidia', type: 'US Equity', logo: 'https://logo.clearbit.com/nvidia.com' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', type: 'US Equity', logo: 'https://logo.clearbit.com/meta.com' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', type: 'US Equity', logo: 'https://logo.clearbit.com/tesla.com' },
];

