import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Line, G, Circle, Text as SvgText, Path } from 'react-native-svg';
import { TradingHistory } from '../services/userService';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64; // Account for padding
const CHART_HEIGHT = 200;
const PADDING = 40;

type TimePeriod = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

type PortfolioPerformanceChartProps = {
  trades: TradingHistory[];
  currentPortfolioValue: number;
  startingCash: number;
};

const PortfolioPerformanceChart: React.FC<PortfolioPerformanceChartProps> = ({
  trades,
  currentPortfolioValue,
  startingCash,
}) => {
  const [selectedPeriod, setSelectedPeriod] = React.useState<TimePeriod>('1M');

  // Calculate portfolio value over time
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) {
      // If no trades, return single point at starting cash
      return [{
        date: new Date(),
        value: startingCash,
        timestamp: Date.now(),
      }];
    }

    // Filter trades by selected period
    const now = new Date();
    const periodStart = new Date();
    
    switch (selectedPeriod) {
      case '1D':
        periodStart.setDate(now.getDate() - 1);
        break;
      case '1W':
        periodStart.setDate(now.getDate() - 7);
        break;
      case '1M':
        periodStart.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        periodStart.setMonth(now.getMonth() - 3);
        break;
      case '1Y':
        periodStart.setFullYear(now.getFullYear() - 1);
        break;
      case 'ALL':
        periodStart.setFullYear(2020); // Start from 2020
        break;
    }

    // Sort trades by timestamp
    const sortedTrades = [...trades].sort((a, b) => {
      const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
      const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
      return aTime - bTime;
    });

    // Filter trades by period
    const filteredTrades = sortedTrades.filter(trade => {
      const tradeTime = trade.timestamp?.toDate ? trade.timestamp.toDate() : new Date(trade.timestamp);
      return tradeTime >= periodStart;
    });

    // Calculate portfolio value at each trade point
    let runningCash = startingCash;
    const positions = new Map<string, { shares: number; avgPrice: number }>();
    const dataPoints: Array<{ date: Date; value: number; timestamp: number }> = [];

    // Add starting point
    dataPoints.push({
      date: periodStart,
      value: startingCash,
      timestamp: periodStart.getTime(),
    });

    // Process each trade
    filteredTrades.forEach(trade => {
      const tradeTime = trade.timestamp?.toDate ? trade.timestamp.toDate() : new Date(trade.timestamp);
      const symbol = trade.symbol;
      const position = positions.get(symbol) || { shares: 0, avgPrice: 0 };

      if (trade.action === 'buy') {
        const totalCost = trade.totalAmount + (trade.fees || 0);
        const newShares = position.shares + trade.shares;
        const newAvgPrice = newShares > 0
          ? ((position.avgPrice * position.shares) + (trade.price * trade.shares)) / newShares
          : trade.price;
        
        positions.set(symbol, { shares: newShares, avgPrice: newAvgPrice });
        runningCash -= totalCost;
      } else if (trade.action === 'sell') {
        const totalReceived = trade.totalAmount - (trade.fees || 0);
        const newShares = position.shares - trade.shares;
        
        if (newShares <= 0) {
          positions.delete(symbol);
        } else {
          positions.set(symbol, { shares: newShares, avgPrice: position.avgPrice });
        }
        runningCash += totalReceived;
      }

      // Calculate current portfolio value (cash + positions at trade price)
      const positionsValue = Array.from(positions.values()).reduce((sum, pos) => {
        return sum + (pos.shares * trade.price); // Use trade price as approximation
      }, 0);
      
      const portfolioValue = runningCash + positionsValue;
      
      dataPoints.push({
        date: tradeTime,
        value: portfolioValue,
        timestamp: tradeTime.getTime(),
      });
    });

    // Add current point
    dataPoints.push({
      date: now,
      value: currentPortfolioValue,
      timestamp: now.getTime(),
    });

    // Group by time period for cleaner chart
    const grouped: Map<string, { date: Date; value: number; timestamp: number }> = new Map();
    
    dataPoints.forEach(point => {
      let key: string;
      const date = point.date;
      
      switch (selectedPeriod) {
        case '1D':
          key = `${date.getHours()}:${Math.floor(date.getMinutes() / 15) * 15}`;
          break;
        case '1W':
          key = `${date.getMonth()}-${date.getDate()}`;
          break;
        case '1M':
        case '3M':
          key = `${date.getMonth()}-${date.getDate()}`;
          break;
        case '1Y':
        case 'ALL':
          key = `${date.getMonth()}-${Math.floor(date.getDate() / 7) * 7}`;
          break;
        default:
          key = `${date.getMonth()}-${date.getDate()}`;
      }
      
      const existing = grouped.get(key);
      if (!existing || point.timestamp > existing.timestamp) {
        grouped.set(key, point);
      }
    });

    return Array.from(grouped.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [trades, currentPortfolioValue, startingCash, selectedPeriod]);

  // Calculate chart dimensions
  const chartMetrics = useMemo(() => {
    if (chartData.length === 0) return null;

    const values = chartData.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;
    const padding = valueRange * 0.1; // 10% padding

    const chartMin = minValue - padding;
    const chartMax = maxValue + padding;
    const chartRange = chartMax - chartMin;

    const chartWidth = CHART_WIDTH - PADDING * 2;
    const chartHeight = CHART_HEIGHT - PADDING * 2;

    const valueToY = (value: number) => {
      const normalized = (value - chartMin) / chartRange;
      return PADDING + chartHeight - (normalized * chartHeight);
    };

    const timeToX = (index: number) => {
      return PADDING + (index / (chartData.length - 1 || 1)) * chartWidth;
    };

    // Generate line path
    let path = '';
    chartData.forEach((point, index) => {
      const x = timeToX(index);
      const y = valueToY(point.value);
      if (index === 0) {
        path = `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });

    return {
      path,
      valueToY,
      timeToX,
      chartMin,
      chartMax,
      minValue,
      maxValue,
    };
  }, [chartData]);

  const periods: TimePeriod[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

  if (!chartMetrics || chartData.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.periodSelector}>
          {periods.map(period => (
            <TouchableOpacity
              key={period}
              style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}>
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.emptyChart}>
          <Text style={styles.emptyText}>No data available</Text>
        </View>
      </View>
    );
  }

  const { path, valueToY, timeToX, minValue, maxValue } = chartMetrics;
  
  // Calculate change based on the first data point in the chart (period start), not original starting cash
  const periodStartValue = chartData.length > 0 ? chartData[0].value : startingCash;
  const isPositive = currentPortfolioValue >= periodStartValue;
  const change = currentPortfolioValue - periodStartValue;
  const changePercent = periodStartValue > 0 ? (change / periodStartValue) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {periods.map(period => (
          <TouchableOpacity
            key={period}
            style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}>
              {period}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart Stats */}
      <View style={styles.statsRow}>
        <View>
          <Text style={styles.statsLabel}>Current Value</Text>
          <Text style={styles.statsValue}>{formatCurrency(currentPortfolioValue)}</Text>
        </View>
        <View style={styles.statsRight}>
          <Text style={styles.statsLabel}>Change</Text>
          <Text style={[styles.statsValue, { color: isPositive ? Colors.success : Colors.error }]}>
            {isPositive ? '+' : ''}{formatCurrency(change)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
          </Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          <G>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = PADDING + (CHART_HEIGHT - PADDING * 2) * (1 - ratio);
              const value = chartMetrics.chartMin + (chartMetrics.chartMax - chartMetrics.chartMin) * ratio;
              return (
                <G key={i}>
                  <Line
                    x1={PADDING}
                    y1={y}
                    x2={CHART_WIDTH - PADDING}
                    y2={y}
                    stroke={Colors.border}
                    strokeWidth={0.5}
                    strokeDasharray="2,2"
                    opacity={0.3}
                  />
                  <SvgText
                    x={PADDING - 5}
                    y={y + 4}
                    fontSize={10}
                    fill={Colors.textTertiary}
                    textAnchor="end"
                  >
                    {value > 1000 ? `$${(value / 1000).toFixed(1)}k` : formatCurrency(value)}
                  </SvgText>
                </G>
              );
            })}

            {/* Line */}
            <Line
              x1={PADDING}
              y1={PADDING}
              x2={PADDING}
              y2={CHART_HEIGHT - PADDING}
              stroke={Colors.border}
              strokeWidth={1}
            />
            <Line
              x1={PADDING}
              y1={CHART_HEIGHT - PADDING}
              x2={CHART_WIDTH - PADDING}
              y2={CHART_HEIGHT - PADDING}
              stroke={Colors.border}
              strokeWidth={1}
            />

            {/* Data line */}
            <Path
              d={path}
              stroke={isPositive ? Colors.success : Colors.error}
              strokeWidth={2}
              fill="none"
            />

            {/* Data points */}
            {chartData.map((point, index) => {
              const x = timeToX(index);
              const y = valueToY(point.value);
              return (
                <Circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={3}
                  fill={isPositive ? Colors.success : Colors.error}
                />
              );
            })}
          </G>
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.md,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  periodButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  periodText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  periodTextActive: {
    color: Colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  statsLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    marginBottom: Spacing.xs,
  },
  statsValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  statsRight: {
    alignItems: 'flex-end',
  },
  chartContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyChart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
  },
});

export default PortfolioPerformanceChart;

