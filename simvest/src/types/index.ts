/**
 * Centralized type definitions for the Pulse app
 */

// Navigation types
export type TabKey = 'home' | 'search' | 'alerts' | 'leaderboard' | 'portfolio' | 'profile';

export type FeedTab = 'foryou' | 'following';

export type NotificationFilter = 'all' | 'alerts' | 'posts' | 'comments' | 'mentions' | 'news';

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  createdAt: any;
  /** Set when alert triggered; then shown in "Alerts executed" */
  executedAt?: any;
  executedPrice?: number;
  /** User tapped to acknowledge executed alert; clears bell badge for this item */
  seenAt?: any;
}

// Feed types
export interface FeedPost {
  id: string;
  userId?: string; // Owner's uid (set when loaded from backend)
  user: {
    name: string;
    handle: string;
    avatar?: string;
    tags?: string[];
  };
  topic?: string;
  title: string;
  body?: string;
  minutesAgo: number;
  createdAt?: number; // Timestamp in milliseconds
  stockSymbol?: string; // Primary stock symbol mentioned (deprecated, use stockSymbols)
  stockPriceAtCreation?: number; // Price when post was created (deprecated, use stockPricesAtCreation)
  stockSymbols?: string[]; // All stock symbols mentioned in post
  stockPricesAtCreation?: Record<string, number>; // Prices of all stocks when post was created (symbol -> price)
  stats?: {
    likes?: number;
    comments?: number;
    reposts?: number;
    saves?: number;
  };
  // Interaction status (optional, set by components)
  isLiked?: boolean;
  isSaved?: boolean;
}

// Portfolio types
export interface Holding {
  symbol: string;
  shares: number;
  price: number;
  changePct: number;
  avgCost: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  shares: number;
  price: number;
  pnl?: number;
  time: string;
}

export interface PortfolioMetrics {
  marketValue: number;
  dayChangePct: number;
  unrealized: number;
  unrealizedPct: number;
  realized: number;
  allTime: number;
  winRate: number;
  streak: number;
  totalTrades: number;
  costBasis: number;
}

// Search types
export interface StockSuggestion {
  symbol: string;
  name: string;
  type: string;
  logo: string;
}

export interface StockDetails {
  label: string;
  value: string;
}

// Notification types
export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
}

// Chat types
export interface Chat {
  id: string;
  name: string;
  last: string;
  unread: number;
}

// Badge types
export type BadgeSize = 'small' | 'medium' | 'large';

// Social graph types
export interface Follow {
  followerId: string;
  followedId: string;
  createdAt: any;
}

export type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  /** Display name of the sender (denormalized for UI) */
  fromDisplayName?: string;
  fromUsername?: string;
  fromPhotoURL?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: any;
}

// Group types
export interface Group {
  id: string;
  name: string;
  createdBy: string;
  joinCode: string;
  members: string[];
  createdAt: any;
}

export interface GroupMessage {
  id: string;
  userId: string;
  /** Display name of sender (denormalized) */
  displayName?: string;
  username?: string;
  photoURL?: string;
  text: string;
  createdAt: any;
}

