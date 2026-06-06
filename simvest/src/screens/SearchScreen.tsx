import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ScrollView, RefreshControl, Linking, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StockSuggestion, StockDetails } from '../types';
import { Colors, Spacing, BorderRadius, Typography, Shadows, Glass } from '../constants/theme';
import { STOCK_SUGGESTIONS } from '../constants/mockData';
import { tradingService } from '../services/tradingService';
import { marketDataService, MarketNews } from '../services/marketDataService';
import { stockPriceService } from '../services/stockPriceService';
import { chartDataService, CandlestickData } from '../services/chartDataService';
import { stockSearchService } from '../services/stockSearchService';
import TradeModal from '../components/TradeModal';
import NewsArticleModal from '../components/NewsArticleModal';
import CandlestickChart from '../components/CandlestickChart';
import AIExplainModal, { AIExplainStatus } from '../components/AIExplainModal';
import { aiExplainService, AI_EXPLAIN_ERRORS } from '../services/aiExplainService';
import { useAuth } from '../contexts/AuthContext';
import { userService, PortfolioPosition } from '../services/userService';
import { formatCurrency, formatPercentage, formatNumber } from '../utils/formatters';

// Popular stocks shown in "Start here" when no search
const START_HERE_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN'];

type SearchScreenProps = {
  initialSymbol?: string;
};

const SearchScreen: React.FC<SearchScreenProps> = ({ initialSymbol }) => {
  const { user } = useAuth();
  const [query, setQuery] = useState(initialSymbol || '');
  const [selected, setSelected] = useState<string | null>(initialSymbol || null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [position, setPosition] = useState<PortfolioPosition | null>(null);
  const [positionFetched, setPositionFetched] = useState(false); // true once getPosition has settled (so "Your position" box is ready or known empty)
  const [priceFetched, setPriceFetched] = useState(false); // true once first price fetch for selected symbol has completed
  const [boughtThisSymbolToday, setBoughtThisSymbolToday] = useState(false);
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const listScrollRef = useRef<ScrollView>(null);
  const selectedRef = useRef<string | null>(selected);
  selectedRef.current = selected;
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');
  const [refreshing, setRefreshing] = useState(false);
  
  // Market data
  const [marketNews, setMarketNews] = useState<MarketNews[]>([]);
  const [startHerePrices, setStartHerePrices] = useState<Map<string, { price: number; changePercent: number }>>(new Map());
  const [logoLoadFailed, setLogoLoadFailed] = useState<Set<string>>(new Set());
  const [selectedArticle, setSelectedArticle] = useState<MarketNews | null>(null);
  const [newsModalVisible, setNewsModalVisible] = useState(false);
  const [suggestionPrices, setSuggestionPrices] = useState<Map<string, { price: number; changePercent: number }>>(new Map());
  const [chartData, setChartData] = useState<CandlestickData[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<'1D' | '1W' | '1M' | '1Y'>('1D');
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [aiExplainVisible, setAiExplainVisible] = useState(false);
  const [aiExplainStatus, setAiExplainStatus] = useState<AIExplainStatus>('idle');
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiErrorCode, setAiErrorCode] = useState<string | null>(null);

  // Handle initial symbol
  useEffect(() => {
    if (initialSymbol && !selected) {
      setQuery(initialSymbol);
      setSelected(initialSymbol);
    }
  }, [initialSymbol]);

  // Update price when symbol changes - clear first so we never show previous symbol's price
  useEffect(() => {
    if (selected) {
      setCurrentPrice(null);
      setPriceFetched(false);
      const sym = selected;
      const fetchPrice = async () => {
        const price = await tradingService.getCurrentPrice(sym);
        if (selectedRef.current === sym) {
          setCurrentPrice(price);
          setPriceFetched(true);
        }
      };
      fetchPrice();
      const interval = setInterval(fetchPrice, 30000);
      return () => clearInterval(interval);
    } else {
      setCurrentPrice(null);
      setPriceFetched(false);
    }
  }, [selected]);

  // Fetch user's position and whether they bought this symbol today (for correct Today's P/L).
  // Only show "Your position" box when user actually has a position (no loading state).
  useEffect(() => {
    if (!selected) {
      setPosition(null);
      setPositionFetched(false);
      setBoughtThisSymbolToday(false);
      return;
    }
    if (!user?.uid) {
      setPosition(null);
      setPositionFetched(true); // no user → nothing to fetch, consider "ready"
      setBoughtThisSymbolToday(false);
      return;
    }
    const sym = selected;
    setPosition(null);
    setPositionFetched(false);
    tradingService.getPosition(user.uid, sym).then((pos) => {
      if (selectedRef.current === sym) {
        setPosition(pos);
        setPositionFetched(true);
      }
    }).catch(() => {
      if (selectedRef.current === sym) {
        setPosition(null);
        setPositionFetched(true);
      }
    });
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();
    userService.getUserTradingHistory(user.uid, 50).then((history) => {
      if (selected !== sym) return;
      const boughtToday = (history || []).some(
        (t) =>
          t.action === 'buy' &&
          t.symbol.toUpperCase() === sym.toUpperCase() &&
          (t.timestamp?.toMillis ? t.timestamp.toMillis() : typeof t.timestamp === 'number' ? t.timestamp : 0) >= startMs
      );
      setBoughtThisSymbolToday(boughtToday);
    });
  }, [selected, user?.uid]);

  // Load market data once on mount, then update every 60 seconds (1 minute)
  // CHECKPOINT: Changed from 10 seconds to 60 seconds to stay well under rate limit
  // To revert: change 60000 back to 10000
  useEffect(() => {
    loadMarketData();
    // Update every 60 seconds (1 minute) - slower to avoid rate limits
    const interval = setInterval(() => {
      loadMarketData(); // This will update prices, or freeze if rate limited
    }, 60000); // 60 seconds = 1 minute
    return () => clearInterval(interval);
  }, []);

  const loadMarketData = async () => {
    try {
      const [news, quotes] = await Promise.all([
        marketDataService.getMarketNews(3),
        stockPriceService.getQuotes(START_HERE_SYMBOLS),
      ]);
      setMarketNews(news);
      const priceMap = new Map<string, { price: number; changePercent: number }>();
      quotes.forEach((q, symbol) => {
        priceMap.set(symbol, { price: q.currentPrice, changePercent: q.changePercent });
      });
      setStartHerePrices(priceMap);
    } catch (error) {
      console.error('Error loading market data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMarketData();
    if (selected) {
      const price = await tradingService.getCurrentPrice(selected);
      setCurrentPrice(price);
    }
    setRefreshing(false);
  };

  const handleNewsPress = async (article: MarketNews) => {
    // Open the article URL instead of showing modal
    if (article.url) {
      try {
        const canOpen = await Linking.canOpenURL(article.url);
        if (canOpen) {
          await Linking.openURL(article.url);
        } else {
          Alert.alert('Error', 'Cannot open this article URL');
        }
      } catch (error) {
        console.error('Error opening article URL:', error);
        Alert.alert('Error', 'Failed to open article');
      }
    } else {
      // Fallback: show modal if no URL
      setSelectedArticle(article);
      setNewsModalVisible(true);
    }
  };

  const [stockDetails, setStockDetails] = useState<StockDetails[]>([]);

  // Fetch real stock details and chart data when symbol is selected
  useEffect(() => {
    if (selected) {
      const fetchDetails = async () => {
        try {
          const quote = await stockPriceService.getQuote(selected);
          if (quote) {
            const changeStr = quote.changePercent >= 0 
              ? `+${quote.changePercent.toFixed(2)}% ▲` 
              : `${quote.changePercent.toFixed(2)}% ▼`;
            const volumeStr = quote.volume > 0 
              ? `${(quote.volume / 1000000).toFixed(1)}M` 
              : 'N/A';
            
            setStockDetails([
              { label: 'Price', value: `$${quote.currentPrice.toFixed(2)}` },
              { label: 'Day Change', value: changeStr },
              { label: 'Volume', value: volumeStr },
              { label: 'Open', value: `$${quote.open.toFixed(2)}` },
              { label: 'High', value: `$${quote.high.toFixed(2)}` },
              { label: 'Low', value: `$${quote.low.toFixed(2)}` },
              { label: 'Previous Close', value: `$${quote.previousClose.toFixed(2)}` },
            ]);
          }
        } catch (error) {
          console.error('Error fetching stock details:', error);
        }
      };
      fetchDetails();
      // Update every 30 seconds instead of 5 seconds
      const interval = setInterval(fetchDetails, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [selected]);

  // Fetch chart data when symbol or timeframe changes
  useEffect(() => {
    if (selected) {
      const fetchChartData = async () => {
        setChartLoading(true);
        try {
          let data: CandlestickData[] = [];
          
          switch (chartTimeframe) {
            case '1D':
              data = await chartDataService.getIntradayData(selected, 4); // Last 4 hours, 1-min candles
              break;
            case '1W':
              data = await chartDataService.getCandlestickData(selected, '15m', '5d'); // Last 7 days, 15-min candles
              break;
            case '1M':
              data = await chartDataService.getDailyData(selected, 30); // Last 30 days
              break;
            case '1Y':
              data = await chartDataService.getDailyData(selected, 365); // Last year
              break;
          }
          
          setChartData(data);
        } catch (error) {
          console.error('Error fetching chart data:', error);
          setChartData([]);
        } finally {
          setChartLoading(false);
        }
      };
      
      fetchChartData();
      // Refresh chart data every 60 seconds (1 minute) to reduce API calls
      const interval = setInterval(fetchChartData, 60000); // 60 seconds
      return () => clearInterval(interval);
    } else {
      setChartData([]);
    }
  }, [selected, chartTimeframe]);

  // Fetch prices for search suggestions
  useEffect(() => {
    if (suggestions.length > 0) {
      const fetchPrices = async () => {
        const prices = new Map<string, { price: number; changePercent: number }>();
        const quotes = await stockPriceService.getQuotes(suggestions.map(s => s.symbol));
        quotes.forEach((quote, symbol) => {
          prices.set(symbol, {
            price: quote.currentPrice,
            changePercent: quote.changePercent,
          });
        });
        setSuggestionPrices(prices);
      };
      fetchPrices();
    }
  }, [suggestions]);

  // Search for stocks when query changes (debounced)
  useEffect(() => {
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery || trimmedQuery.length < 1) {
      setSuggestions([]);
      return;
    }

    // Debounce search (wait 300ms after user stops typing)
    const timeoutId = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await stockSearchService.searchStocks(trimmedQuery, 10);
        setSuggestions(results);
        
        // If API search returns no results, fallback to local suggestions
        if (results.length === 0) {
          const localResults = STOCK_SUGGESTIONS.filter((i) => 
            i.symbol.includes(trimmedQuery.toUpperCase()) || 
            i.name.toUpperCase().includes(trimmedQuery.toUpperCase())
          ).slice(0, 10);
          setSuggestions(localResults);
        }
      } catch (error) {
        console.error('Error searching stocks:', error);
        // Fallback to local suggestions on error
        const localResults = STOCK_SUGGESTIONS.filter((i) => 
          i.symbol.includes(trimmedQuery.toUpperCase()) || 
          i.name.toUpperCase().includes(trimmedQuery.toUpperCase())
        ).slice(0, 10);
        setSuggestions(localResults);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // When user is searching, scroll to top so search results are visible (not hidden below the fold)
  useEffect(() => {
    if (!selected && query.trim().length > 0) {
      const t = setTimeout(() => {
        listScrollRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [query, selected]);

  // When search results load, scroll to top so they're not below the fold
  useEffect(() => {
    if (!selected && query.trim().length > 0 && suggestions.length > 0) {
      const t = setTimeout(() => {
        listScrollRef.current?.scrollTo({ y: 0, animated: true });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [suggestions.length, query, selected]);

  const showPopular = !selected && !query;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trade</Text>
        {selected && (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              setSelected(null);
              setQuery('');
            }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textTertiary} style={styles.searchIcon} />
      <TextInput
        value={query}
        onChangeText={(t) => { setQuery(t); setSelected(null); }}
        onFocus={() => {
          if (selected) {
            setQuery('');
            setSelected(null);
          }
          listScrollRef.current?.scrollTo({ y: 0, animated: true });
        }}
        style={styles.input}
          placeholder="Search stocks (AAPL, TSLA, NVDA...)"
          placeholderTextColor={Colors.textTertiary}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setSelected(null); }}>
            <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {!selected ? (
        <ScrollView
          ref={listScrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {showPopular && (
            <>
              {/* Market News Section - on top */}
              {marketNews.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="newspaper" size={20} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>Market News</Text>
                  </View>
                  <View style={styles.newsList}>
                    {marketNews.slice(0, 3).map((article) => (
                      <TouchableOpacity
                        key={article.id}
                        style={styles.newsCard}
                        onPress={() => handleNewsPress(article)}
                        activeOpacity={0.7}
                      >
                        {article.imageUrl && article.imageUrl.trim() !== '' && (
                          <Image source={{ uri: article.imageUrl }} style={styles.newsImage} resizeMode="cover" />
                        )}
                        <View style={styles.newsContent}>
                          <Text style={styles.newsTitle} numberOfLines={2}>{article.title}</Text>
                          <View style={styles.newsMeta}>
                            <Text style={styles.newsSource}>{article.source}</Text>
                            <Text style={styles.newsTime}>{article.publishedAt}</Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Popular stocks */}
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-up" size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Popular</Text>
              </View>
              <View style={styles.startHereList}>
                {START_HERE_SYMBOLS.map((symbol) => {
                  const item = STOCK_SUGGESTIONS.find(s => s.symbol === symbol);
                  const priceData = startHerePrices.get(symbol);
                  const price = priceData?.price ?? 0;
                  const changePercent = priceData?.changePercent ?? 0;
                  const isPositive = changePercent >= 0;
                  return (
                    <TouchableOpacity
                      key={symbol}
                      style={styles.startHereCard}
                      onPress={() => setSelected(symbol)}
                      activeOpacity={0.7}
                    >
                      {item?.logo && item.logo.trim() !== '' && !logoLoadFailed.has(symbol) ? (
                        <Image
                          source={{ uri: item.logo }}
                          style={styles.startHereLogo}
                          onError={() => setLogoLoadFailed(prev => new Set(prev).add(symbol))}
                        />
                      ) : null}
                      <View style={styles.startHereInfo}>
                        <Text style={styles.startHereSymbol}>{symbol}</Text>
                        <Text style={styles.startHereName} numberOfLines={1}>{item?.name ?? symbol}</Text>
                      </View>
                      <View style={styles.startHerePrice}>
                        <Text style={styles.startHerePriceText}>${price > 0 ? price.toFixed(2) : '-'}</Text>
                        {price > 0 && (
                          <View style={[styles.startHereChange, { backgroundColor: isPositive ? Colors.success + '20' : Colors.error + '20' }]}>
                            <Ionicons name={isPositive ? 'arrow-up' : 'arrow-down'} size={10} color={isPositive ? Colors.success : Colors.error} />
                            <Text style={[styles.startHereChangeText, { color: isPositive ? Colors.success : Colors.error }]}>
                              {Math.abs(changePercent).toFixed(2)}%
                            </Text>
                          </View>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
                  );
                })}
              </View>

            </>
          )}

          {query.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Ionicons name="search" size={20} color={Colors.textPrimary} />
                <Text style={styles.sectionTitle}>Search Results</Text>
              </View>
              {suggestions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color={Colors.textDisabled} />
                  <Text style={styles.emptyText}>No stocks found</Text>
                  <Text style={styles.emptySubtext}>Try searching for AAPL, TSLA, or NVDA</Text>
                </View>
              ) : (
                <View style={styles.suggestionsList}>
                  {suggestions.map((item, index) => {
                    const priceData = suggestionPrices.get(item.symbol);
                    const price = priceData?.price || 0;
                    const changePercent = priceData?.changePercent || 0;
                    const isPositive = changePercent >= 0;
                    return (
                      <TouchableOpacity
                        key={`${item.symbol}-${index}`}
                        style={styles.suggestionCard}
                        onPress={() => setSelected(item.symbol)}
                        activeOpacity={0.7}
                      >
                        {item.logo && item.logo.trim() !== '' && !logoLoadFailed.has(item.symbol) ? (
                          <Image
                            source={{ uri: item.logo }}
                            style={styles.suggestionLogo}
                            onError={() => setLogoLoadFailed(prev => new Set(prev).add(item.symbol))}
                          />
                        ) : null}
                        <View style={styles.suggestionInfo}>
                          <Text style={styles.suggestionSymbol}>{item.symbol}</Text>
                          <Text style={styles.suggestionName} numberOfLines={1}>{item.name}</Text>
                        </View>
                        <View style={styles.suggestionPrice}>
                          <Text style={styles.suggestionPriceText}>${price.toFixed(2)}</Text>
                          <View style={[styles.suggestionChange, { backgroundColor: isPositive ? Colors.success + '20' : Colors.error + '20' }]}>
                            <Ionicons 
                              name={isPositive ? 'arrow-up' : 'arrow-down'} 
                              size={10} 
                              color={isPositive ? Colors.success : Colors.error} 
                            />
                            <Text style={[styles.suggestionChangeText, { color: isPositive ? Colors.success : Colors.error }]}>
                              {Math.abs(changePercent).toFixed(2)}%
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : !priceFetched ? (
        <View style={styles.stockDetailLoadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.stockDetailLoadingText}>Loading {selected}...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Stock Header */}
          <View style={styles.stockHeader}>
            <View style={styles.stockHeaderLeft}>
          <Text style={styles.symbolTitle}>{selected}</Text>
              <Text style={styles.stockName}>
                {STOCK_SUGGESTIONS.find(s => s.symbol === selected)?.name || 'Stock'}
              </Text>
            </View>
            <View style={styles.stockHeaderRight}>
              <Text style={styles.currentPrice}>
                ${currentPrice ? currentPrice.toFixed(2) : '...'}
              </Text>
              {stockDetails.length > 0 && (() => {
                const changeDetail = stockDetails.find(d => d.label === 'Day Change');
                if (changeDetail) {
                  const isPositive = changeDetail.value.includes('+');
                  return (
                    <View style={[styles.priceChange, { backgroundColor: isPositive ? Colors.success + '20' : Colors.error + '20' }]}>
                      <Ionicons 
                        name={isPositive ? 'arrow-up' : 'arrow-down'} 
                        size={14} 
                        color={isPositive ? Colors.success : Colors.error} 
                      />
                      <Text style={[styles.priceChangeText, { color: isPositive ? Colors.success : Colors.error }]}>
                        {changeDetail.value.replace(/[▲▼]/g, '').trim()}
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}
            </View>
          </View>

          {/* Chart */}
          <View style={styles.chartContainer}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Price Chart</Text>
              <View style={styles.chartTimeframes}>
                {(['1D', '1W', '1M', '1Y'] as const).map((tf) => (
                  <TouchableOpacity 
                    key={tf} 
                    style={[
                      styles.timeframeButton,
                      chartTimeframe === tf && styles.timeframeButtonActive
                    ]}
                    onPress={() => setChartTimeframe(tf)}
                  >
                    <Text style={[
                      styles.timeframeText,
                      chartTimeframe === tf && styles.timeframeTextActive
                    ]}>
                      {tf}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {chartLoading ? (
              <View style={styles.chartLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.chartLoadingText}>Loading chart...</Text>
              </View>
            ) : chartData.length > 0 ? (
              <CandlestickChart data={chartData} />
            ) : (
              <View style={styles.chartEmpty}>
                <Text style={styles.chartEmptyText}>No chart data available</Text>
              </View>
            )}
          </View>

          {/* Stats Grid - explicit rows so High/Low align perfectly */}
          <View style={styles.statsGrid}>
            {[0, 2, 4].map((startIdx) => (
              <View key={startIdx} style={styles.statsGridRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>{stockDetails[startIdx]?.label}</Text>
                  <Text style={styles.statValue}>{stockDetails[startIdx]?.value ?? '-'}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>{stockDetails[startIdx + 1]?.label}</Text>
                  <Text style={styles.statValue}>{stockDetails[startIdx + 1]?.value ?? '-'}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Your position - placeholder while loading, then full box if user has a position */}
          {selected && user?.uid && !positionFetched && (
            <View style={styles.positionSummaryBox}>
              <View style={styles.positionLoadingPlaceholder}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.positionLoadingText}>Retrieving your position...</Text>
              </View>
            </View>
          )}
          {selected && position && (
            <View style={styles.positionSummaryBox}>
              <Text style={styles.positionSummaryTitle}>Your position</Text>
              {/* Day's P/L and Total P/L at top (like inspiration) */}
              {(position.previousClose != null && position.previousClose > 0) || boughtThisSymbolToday ? (
                <View style={styles.positionSummaryRow}>
                  <Text style={styles.positionSummaryLabel}>Day's P/L</Text>
                  <Text style={[styles.positionSummaryValue, {
                    color: boughtThisSymbolToday
                      ? (position.totalReturn >= 0 ? Colors.success : Colors.error)
                      : currentPrice != null
                        ? (currentPrice - position.previousClose! >= 0 ? Colors.success : Colors.error)
                        : Colors.textSecondary,
                  }]}>
                    {boughtThisSymbolToday
                      ? `${position.totalReturn >= 0 ? '+' : ''}${formatCurrency(position.totalReturn)} (${position.returnPercentage >= 0 ? '+' : ''}${position.returnPercentage.toFixed(2)}%)`
                      : position.previousClose != null && position.previousClose > 0 && currentPrice != null
                        ? `${(currentPrice - position.previousClose) >= 0 ? '+' : ''}${formatCurrency((currentPrice - position.previousClose) * position.shares)} (${formatPercentage((currentPrice - position.previousClose) / position.previousClose * 100)})`
                        : '-'}
                  </Text>
                </View>
              ) : null}
              <View style={styles.positionSummaryRow}>
                <Text style={styles.positionSummaryLabel}>Total P/L</Text>
                <Text style={[styles.positionSummaryValue, {
                  color: (currentPrice != null ? (currentPrice - position.avgPrice) * position.shares : position.totalReturn) >= 0 ? Colors.success : Colors.error,
                }]}>
                  {currentPrice != null
                    ? (() => {
                        const pl = (currentPrice - position.avgPrice) * position.shares;
                        const pct = position.avgPrice > 0 ? ((currentPrice - position.avgPrice) / position.avgPrice) * 100 : 0;
                        return `${pl >= 0 ? '+' : ''}${formatCurrency(pl)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
                      })()
                    : `${position.totalReturn >= 0 ? '+' : ''}${formatCurrency(position.totalReturn)} (${position.returnPercentage >= 0 ? '+' : ''}${position.returnPercentage.toFixed(2)}%)`}
                </Text>
              </View>
              <View style={styles.positionSummaryDivider} />
              <View style={styles.positionSummaryRow}>
                <Text style={styles.positionSummaryLabel}>Shares</Text>
                <Text style={styles.positionSummaryValue}>{formatNumber(position.shares)}</Text>
              </View>
              <View style={styles.positionSummaryRow}>
                <Text style={styles.positionSummaryLabel}>Average cost</Text>
                <Text style={styles.positionSummaryValue}>{formatCurrency(position.avgPrice)}</Text>
              </View>
              <View style={styles.positionSummaryRow}>
                <Text style={styles.positionSummaryLabel}>Market value</Text>
                <Text style={styles.positionSummaryValue}>
                  {currentPrice != null ? formatCurrency(currentPrice * position.shares) : formatCurrency(position.totalValue)}
                </Text>
              </View>
            </View>
          )}
          
          {/* Buy/Sell Buttons */}
          <View style={styles.tradeButtons}>
            <TouchableOpacity
              style={[styles.tradeButton, styles.buyButton]}
              onPress={() => {
                setTradeAction('buy');
                setTradeModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={24} color={Colors.white} />
              <Text style={styles.tradeButtonText}>Buy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tradeButton, styles.sellButton]}
              onPress={() => {
                setTradeAction('sell');
                setTradeModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="remove-circle" size={24} color={Colors.white} />
              <Text style={styles.tradeButtonText}>Sell</Text>
            </TouchableOpacity>
          </View>

          {/* Explain with AI */}
          <TouchableOpacity
            style={styles.aiExplainButton}
            onPress={async () => {
              if (!selected) return;
              setAiExplainVisible(true);
              setAiExplainStatus('loading');
              setAiExplanation(null);
              setAiErrorCode(null);
              try {
                const text = await aiExplainService.explainStock(selected);
                setAiExplanation(text);
                setAiExplainStatus('success');
              } catch (err: any) {
                setAiExplainStatus('error');
                setAiErrorCode(err?.message ?? AI_EXPLAIN_ERRORS.UNKNOWN);
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={20} color={Colors.primary} />
            <Text style={styles.aiExplainButtonText}>Explain with AI</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      
      {/* Trade Modal */}
      <TradeModal
        visible={tradeModalVisible}
        onClose={() => setTradeModalVisible(false)}
        symbol={selected || undefined}
        action={tradeAction}
        onTradeComplete={() => {
          if (!selected || !user?.uid) return;
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          const startMs = startOfToday.getTime();
          Promise.all([
            tradingService.getPosition(user.uid, selected),
            userService.getUserTradingHistory(user.uid, 50),
          ]).then(([pos, history]) => {
            setPosition(pos);
            const boughtToday = (history || []).some(
              (t) =>
                t.action === 'buy' &&
                t.symbol.toUpperCase() === selected.toUpperCase() &&
                (t.timestamp?.toMillis ? t.timestamp.toMillis() : typeof t.timestamp === 'number' ? t.timestamp : 0) >= startMs
            );
            setBoughtThisSymbolToday(boughtToday);
          });
        }}
      />

      {/* News Article Modal */}
      <NewsArticleModal
        visible={newsModalVisible}
        article={selectedArticle}
        onClose={() => {
          setNewsModalVisible(false);
          setSelectedArticle(null);
        }}
      />

      {/* AI Explain Modal (stock) */}
      <AIExplainModal
        visible={aiExplainVisible}
        title={selected ? `Explain: ${selected}` : 'Explain'}
        status={aiExplainStatus}
        explanation={aiExplanation}
        errorCode={aiErrorCode}
        onClose={() => {
          setAiExplainVisible(false);
          setAiExplainStatus('idle');
          setAiExplanation(null);
          setAiErrorCode(null);
        }}
      />
    </View>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.bold,
  },
  backButton: {
    padding: Spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.sm,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  popularCard: {
    width: '47%',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadows.small,
  },
  popularCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  popularLogo: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.xs,
  },
  popularSymbol: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  popularPrice: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing.xs,
  },
  popularChange: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  popularChangeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  quickActionCard: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    ...Shadows.small,
  },
  quickActionText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  suggestionsList: {
    gap: Spacing.md,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.small,
  },
  suggestionLogo: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionSymbol: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 2,
  },
  suggestionName: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  suggestionPrice: {
    alignItems: 'flex-end',
    gap: 4,
  },
  suggestionPriceText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  suggestionChange: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  suggestionChangeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  emptySubtext: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  stockHeaderLeft: {
    flex: 1,
  },
  symbolTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing.xs,
  },
  stockName: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
  },
  stockHeaderRight: {
    alignItems: 'flex-end',
  },
  currentPrice: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing.xs,
  },
  priceChange: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  priceChangeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  chartContainer: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chartTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  chartTimeframes: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  timeframeButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.backgroundTertiary,
  },
  timeframeText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  timeframeButtonActive: {
    backgroundColor: Colors.primary,
  },
  timeframeTextActive: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
  },
  stockDetailLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stockDetailLoadingText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
  },
  chartLoading: {
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  chartLoadingText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  chartEmpty: {
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartEmptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.md,
  },
  statsGrid: {
    marginBottom: Spacing.lg,
  },
  statsGridRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    minHeight: 64,
    backgroundColor: Glass.fillSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Glass.postBorder,
    padding: Spacing.md,
    ...Shadows.small,
  },
  statLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.xs,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  positionSummaryBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  positionLoadingPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  positionLoadingText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  positionSummaryTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  positionSummaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  positionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  positionSummaryLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  positionSummaryValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  tradeButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  tradeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    ...Shadows.medium,
  },
  buyButton: {
    backgroundColor: Colors.success,
  },
  sellButton: {
    backgroundColor: Colors.error,
  },
  tradeButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
  },
  aiExplainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  aiExplainButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  // News styles
  newsList: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  newsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.small,
  },
  newsImage: {
    width: 100,
    height: 100,
    backgroundColor: Colors.backgroundTertiary,
  },
  newsContent: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  newsTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
    lineHeight: 20,
  },
  newsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  newsSource: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  newsTime: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
  // Start here (popular stocks)
  startHereList: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  startHereCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadows.small,
  },
  startHereLogo: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
  },
  startHereInfo: {
    flex: 1,
  },
  startHereSymbol: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 2,
  },
  startHereName: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  startHerePrice: {
    alignItems: 'flex-end',
    marginRight: Spacing.sm,
  },
  startHerePriceText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  startHereChange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  startHereChangeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
});


