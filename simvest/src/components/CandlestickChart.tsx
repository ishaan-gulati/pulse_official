/**
 * Custom Candlestick Chart Component
 * Built with react-native-svg for real-time, delay-free charts
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Rect, G } from 'react-native-svg';
import { CandlestickData } from '../services/chartDataService';
import { Colors } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64; // Account for padding
const CHART_HEIGHT = 300;
const PADDING = 20;

type CandlestickChartProps = {
  data: CandlestickData[];
  width?: number;
  height?: number;
};

const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  width = CHART_WIDTH,
  height = CHART_HEIGHT,
}) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Calculate price range
    const allPrices = data.flatMap(d => [d.high, d.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;
    const pricePadding = priceRange * 0.1; // 10% padding

    const chartMinPrice = minPrice - pricePadding;
    const chartMaxPrice = maxPrice + pricePadding;
    const chartPriceRange = chartMaxPrice - chartMinPrice;

    // Calculate dimensions - fill full width so no empty strip on the right
    const chartWidth = width - PADDING * 2;
    const chartHeight = height - PADDING * 2;
    const n = data.length;
    const slotWidth = n > 0 ? chartWidth / n : 0;
    const candleWidth = slotWidth * 0.82;
    const candleSpacing = slotWidth - candleWidth;
    // Stretch so last candle's right edge hits width - PADDING (removes right gap)
    const dataSpan = n > 0 ? (n - 1) * slotWidth + candleWidth : 0;
    const xScale = dataSpan > 0 ? chartWidth / dataSpan : 1;

    // Price to Y coordinate conversion
    const priceToY = (price: number) => {
      const normalized = (price - chartMinPrice) / chartPriceRange;
      return PADDING + chartHeight - (normalized * chartHeight);
    };

    // Index to X: position in slot, then scale so chart fills width
    const indexToX = (index: number) => {
      const rawX = index * slotWidth + candleSpacing / 2;
      return PADDING + rawX * xScale;
    };

    return {
      candles: data.map((candle, index) => {
        const x = indexToX(index);
        const openY = priceToY(candle.open);
        const closeY = priceToY(candle.close);
        const highY = priceToY(candle.high);
        const lowY = priceToY(candle.low);
        
        const isGreen = candle.close >= candle.open;
        const color = isGreen ? Colors.success : Colors.error;
        
        const bodyTop = Math.min(openY, closeY);
        const bodyBottom = Math.max(openY, closeY);
        const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

        return {
          x,
          openY,
          closeY,
          highY,
          lowY,
          bodyTop,
          bodyHeight,
          color,
          candleWidth: candleWidth * xScale,
        };
      }),
      minPrice: chartMinPrice,
      maxPrice: chartMaxPrice,
    };
  }, [data, width, height]);

  if (!chartData || chartData.candles.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <View style={styles.emptyState}>
          {/* Empty state - could add loading or message */}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        {/* Grid lines (optional) */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = PADDING + (height - PADDING * 2) * (1 - ratio);
          return (
            <Line
              key={ratio}
              x1={PADDING}
              y1={y}
              x2={width - PADDING}
              y2={y}
              stroke={Colors.border}
              strokeWidth={0.5}
              strokeDasharray="2,2"
              opacity={0.3}
            />
          );
        })}

        {/* Candlesticks */}
        {chartData.candles.map((candle, index) => (
          <G key={index}>
            {/* Wick (high-low line) */}
            <Line
              x1={candle.x + candle.candleWidth / 2}
              y1={candle.highY}
              x2={candle.x + candle.candleWidth / 2}
              y2={candle.lowY}
              stroke={candle.color}
              strokeWidth={1.5}
            />
            
            {/* Body (open-close rectangle) */}
            <Rect
              x={candle.x}
              y={candle.bodyTop}
              width={candle.candleWidth}
              height={candle.bodyHeight}
              fill={candle.color}
              opacity={0.8}
            />
          </G>
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CandlestickChart;





