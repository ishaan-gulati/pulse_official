/**
 * Utility functions for formatting data
 */

export const formatCurrency = (value: number): string => {
  if (value < 0) {
    return `-$${Math.abs(value).toFixed(2)}`;
  }
  return `$${value.toFixed(2)}`;
};

export const formatPercentage = (value: number, showSign: boolean = true): string => {
  if (showSign) {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}${Math.abs(value).toFixed(2)}%`;
  }
  return `${value.toFixed(2)}%`;
};

export const formatNumber = (value: number): string => {
  return value.toLocaleString();
};

export const formatTimeAgo = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

