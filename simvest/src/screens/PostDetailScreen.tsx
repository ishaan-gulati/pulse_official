import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { FeedPost } from '../types';
import { Colors, Spacing, BorderRadius, Typography, Shadows, Glass } from '../constants/theme';
import { postsService, PostComment } from '../services/postsService';
import { blockService } from '../services/blockService';
import { extractStockSymbols, getPrimaryStockSymbol, parseTextWithStocks } from '../utils/stockParser';
import { tradingService } from '../services/tradingService';
import { stockPriceService } from '../services/stockPriceService';
import { formatPercentage, formatCurrency } from '../utils/formatters';
import UserBadges from '../components/UserBadges';
import UserAvatar from '../components/UserAvatar';
import PostLikesModal from '../components/PostLikesModal';
import { STOCK_SUGGESTIONS } from '../constants/mockData';

type PostDetailScreenProps = {
  post: FeedPost;
  onClose: () => void;
  onNavigateToStock?: (symbol: string) => void;
  onPostDeleted?: () => void; // Called after owner deletes the post (so feed can refresh)
  onViewUser?: (uid: string) => void;
};

const PostDetailScreen: React.FC<PostDetailScreenProps> = ({ post, onClose, onNavigateToStock, onPostDeleted, onViewUser }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [isReposted, setIsReposted] = useState(false);
  const [likesCount, setLikesCount] = useState(post.stats?.likes || 0);
  const [savesCount, setSavesCount] = useState(post.stats?.saves || 0);
  const [repostsCount, setRepostsCount] = useState(post.stats?.reposts || 0);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.stats?.comments ?? 0);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  const isOwner = !!user?.uid && !!post.userId && user.uid === post.userId;

  const handleDeletePost = () => {
    setMoreMenuVisible(false);
    Alert.alert(
      'Delete post',
      'Are you sure you want to delete this post? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.uid) return;
            try {
              await postsService.deletePost(post.id, user.uid);
              onPostDeleted?.();
              onClose();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    setMoreMenuVisible(false);
    if (!user?.uid || !post.userId || post.userId === user.uid) return;
    Alert.alert(
      'Block user',
      `Block @${post.user.handle}? You won't see their posts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockService.blockUser(user.uid, post.userId!);
              onClose();
              Alert.alert('User blocked', 'You won\'t see their posts.');
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to block user.');
            }
          },
        },
      ]
    );
  };

  const handleReportPost = () => {
    setMoreMenuVisible(false);
    if (!user?.uid) return;
    Alert.alert(
      'Report post',
      'Report this post for review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await postsService.submitReport(post.id, user.uid);
              Alert.alert('Report post', 'Thanks. We\'ll review this post.', [{ text: 'OK' }]);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to submit report. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Stock tracking - get all symbols from post
  const allSymbols = post.stockSymbols || (post.stockSymbol ? [post.stockSymbol] : extractStockSymbols(post.title + ' ' + (post.body || '')));
  const primarySymbol = allSymbols.length > 0 ? allSymbols[0] : null;
  
  // State for tracking all stocks
  const [stockData, setStockData] = useState<Record<string, {
    price: number | null;
    change: number | null;
    changePct: number | null;
    name: string | null;
    logo: string | null;
    loading: boolean;
  }>>({});
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [selectedStockForModal, setSelectedStockForModal] = useState<string | null>(null);

  // Get post creation timestamp and prices at creation
  const postTimestamp = post.createdAt || (Date.now() - (post.minutesAgo * 60 * 1000));
  const pricesAtCreation = post.stockPricesAtCreation || (post.stockPriceAtCreation && post.stockSymbol ? { [post.stockSymbol]: post.stockPriceAtCreation } : {});

  // Check repost status on mount
  useEffect(() => {
    const checkRepostStatus = async () => {
      if (user?.uid) {
        try {
          const reposted = await postsService.isPostReposted(post.id, user.uid);
          setIsReposted(reposted);
        } catch (error) {
          console.error('Error checking repost status:', error);
        }
      }
    };
    checkRepostStatus();
  }, [post.id, user?.uid]);

  // Load comments
  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const list = await postsService.getComments(post.id);
      setComments(list);
      setCommentsCount(list.length);
    } catch (e) {
      console.error('Error loading comments:', e);
    } finally {
      setCommentsLoading(false);
    }
  }, [post.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleAddComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || !user?.uid) return;
    setCommentSubmitting(true);
    try {
      await postsService.addComment(post.id, user.uid, trimmed);
      setCommentText('');
      setCommentsCount((c) => c + 1);
      await loadComments();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to post comment');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = (c: PostComment) => {
    if (!user?.uid) return;
    Alert.alert('Delete comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingCommentId(c.id);
          try {
            await postsService.deleteComment(post.id, c.id);
            await loadComments();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not delete comment');
          } finally {
            setDeletingCommentId(null);
          }
        },
      },
    ]);
  };

  // Initialize stock data state
  useEffect(() => {
    const initialData: Record<string, {
      price: number | null;
      change: number | null;
      changePct: number | null;
      name: string | null;
      logo: string | null;
      loading: boolean;
    }> = {};
    
    allSymbols.forEach(symbol => {
      const stockInfo = STOCK_SUGGESTIONS.find(s => s.symbol === symbol);
      initialData[symbol] = {
        price: null,
        change: null,
        changePct: null,
        name: stockInfo?.name || null,
        logo: stockInfo?.logo || null,
        loading: false,
      };
    });
    
    setStockData(initialData);
  }, [allSymbols.join(',')]);

  // Fetch stock prices for all symbols and calculate changes since post
  useEffect(() => {
    if (allSymbols.length === 0) return;
    
    loadAllStockPrices();
    // Refresh prices every 20 seconds
    const interval = setInterval(loadAllStockPrices, 20000);
    return () => clearInterval(interval);
  }, [allSymbols.join(','), JSON.stringify(pricesAtCreation)]);

  const loadAllStockPrices = async () => {
    if (allSymbols.length === 0) return;
    
    // Set all to loading
    setStockData(prev => {
      const updated = { ...prev };
      allSymbols.forEach(symbol => {
        updated[symbol] = {
          ...(updated[symbol] || {
            price: null,
            change: null,
            changePct: null,
            name: null,
            logo: null,
          }),
          loading: true,
        };
      });
      return updated;
    });
    
    // Fetch prices for all stocks in parallel
    await Promise.all(
      allSymbols.map(async (symbol) => {
        try {
          const quote = await stockPriceService.getQuote(symbol);
          if (quote) {
            const currentPrice = quote.currentPrice;
            const priceAtCreation = pricesAtCreation[symbol];
            
            let change: number | null = null;
            let changePct: number | null = null;
            
            if (priceAtCreation && priceAtCreation > 0) {
              change = currentPrice - priceAtCreation;
              changePct = (change / priceAtCreation) * 100;
            } else if (quote.previousClose && quote.previousClose > 0) {
              change = currentPrice - quote.previousClose;
              changePct = (change / quote.previousClose) * 100;
            }
            
            setStockData(prev => ({
              ...prev,
              [symbol]: {
                price: currentPrice,
                change,
                changePct,
                name: quote.name || prev[symbol]?.name || null,
                logo: quote.logo || prev[symbol]?.logo || null,
                loading: false,
              },
            }));
          }
        } catch (error) {
          console.error(`Error loading stock price for ${symbol}:`, error);
          setStockData(prev => ({
            ...prev,
            [symbol]: {
              price: null,
              change: null,
              changePct: null,
              name: null,
              logo: null,
              loading: false,
            },
          }));
        }
      })
    );
  };

  const handleLike = async () => {
    if (!user?.uid) return;
    try {
      await postsService.likePost(post.id, user.uid);
      setIsLiked(!isLiked);
      setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    try {
      await postsService.savePost(post.id, user.uid);
      setIsSaved(!isSaved);
      setSavesCount(isSaved ? savesCount - 1 : savesCount + 1);
    } catch (error) {
      console.error('Error saving post:', error);
    }
  };

  const handleRepost = async () => {
    if (!user?.uid) return;
    try {
      await postsService.repost(post.id, user.uid);
      setIsReposted(!isReposted);
      setRepostsCount(isReposted ? repostsCount - 1 : repostsCount + 1);
    } catch (error) {
      console.error('Error reposting:', error);
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const handleStockPress = (symbol: string) => {
    // Close the post detail screen and navigate to stock immediately
    onClose();
    // Small delay to ensure screen closes before navigation
    setTimeout(() => {
      onNavigateToStock?.(symbol);
    }, 100);
  };

  const renderTextWithStocks = (text: string, textStyle?: object) => {
    if (!text || text.trim() === '') return null;
    const segments = parseTextWithStocks(text);
    if (segments.length === 0) return null;
    
    // Filter out empty segments
    const validSegments = segments.filter(seg => seg.text && seg.text.trim() !== '');
    if (validSegments.length === 0) return null;
    
    const baseStyle = textStyle ?? styles.postText;
    return (
      <Text style={baseStyle}>
        {validSegments.map((segment, index) => {
          if (segment.isStock && segment.symbol) {
            return (
              <Text
                key={`stock-${index}`}
                style={styles.stockLink}
                onPress={() => handleStockPress(segment.symbol!)}
              >
                {segment.text}
              </Text>
            );
          }
          return <Text key={`text-${index}`}>{segment.text}</Text>;
        })}
      </Text>
    );
  };

  const avatarEl = (
    <UserAvatar
      photoURL={post.user.avatar}
      displayName={post.user.name}
      username={post.user.handle}
      size={48}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thread</Text>
        <TouchableOpacity style={styles.moreButton} onPress={() => setMoreMenuVisible(true)}>
          <Ionicons name="ellipsis-horizontal" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Thread overflow menu: owner sees Delete + Report; others see Block + Report */}
      <Modal visible={moreMenuVisible} transparent animationType="fade">
        <Pressable style={styles.moreMenuOverlay} onPress={() => setMoreMenuVisible(false)}>
          <View style={styles.moreMenuCard}>
            {isOwner && (
              <TouchableOpacity style={styles.moreMenuItem} onPress={handleDeletePost}>
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
                <Text style={[styles.moreMenuText, { color: Colors.error }]}>Delete post</Text>
              </TouchableOpacity>
            )}
            {!isOwner && post.userId && (
              <TouchableOpacity style={styles.moreMenuItem} onPress={handleBlockUser}>
                <Ionicons name="ban-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.moreMenuText}>Block @{post.user.handle}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.moreMenuItem} onPress={handleReportPost}>
              <Ionicons name="flag-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.moreMenuText}>Report</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        {/* Post Card */}
        <View style={styles.postCard}>
          {post.userId && onViewUser ? (
            <TouchableOpacity
              style={styles.postHeader}
              onPress={() => onViewUser(post.userId!)}
              activeOpacity={0.7}
            >
              <View style={styles.avatarContainer}>
                {avatarEl}
              </View>
              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{post.user.name}</Text>
                  {post.user.tags && post.user.tags.length > 0 && (
                    <UserBadges tags={post.user.tags} size="small" maxBadges={1} />
                  )}
                </View>
                <Text style={styles.meta}>@{post.user.handle} • {formatTime(post.minutesAgo)}</Text>
              </View>
              {post.topic && (
                <View style={styles.topicPill}>
                  <Text style={styles.topicText}>{post.topic}</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.postHeader}>
              <View style={styles.avatarContainer}>
                {avatarEl}
              </View>
              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{post.user.name}</Text>
                  {post.user.tags && post.user.tags.length > 0 && (
                    <UserBadges tags={post.user.tags} size="small" maxBadges={1} />
                  )}
                </View>
                <Text style={styles.meta}>@{post.user.handle} • {formatTime(post.minutesAgo)}</Text>
              </View>
              {post.topic && (
                <View style={styles.topicPill}>
                  <Text style={styles.topicText}>{post.topic}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.content}>
            {renderTextWithStocks(post.title)}
            {post.body && renderTextWithStocks(post.body)}
          </View>

          {/* Stock Price Change Section - All Stocks */}
          {allSymbols.length > 0 && (
            <View style={styles.stockSection}>
              <View style={styles.stockSectionHeader}>
                <Text style={styles.stockSectionLabel}>Since Post</Text>
                <TouchableOpacity 
                  onPress={() => {
                    setPriceModalVisible(true);
                  }}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={styles.stockSectionDetailsLink}>Full Details </Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <View style={styles.stockPillsContainer}>
                {allSymbols.map((symbol) => {
                  const data = stockData[symbol];
                  
                  return (
                    <TouchableOpacity
                      key={symbol}
                      style={styles.stockPill}
                      onPress={() => handleStockPress(symbol)}
                      activeOpacity={0.7}
                    >
                      {!data || data.loading ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : data.price !== null && data.changePct !== null ? (
                        <>
                          <Text style={styles.stockPillSymbol}>{symbol}</Text>
                          <Text style={[styles.stockPillChange, { color: data.changePct >= 0 ? Colors.success : Colors.error }]}>
                            {data.changePct >= 0 ? '+' : ''}{formatPercentage(data.changePct, false)}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.stockUnavailable}>Loading...</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <View style={styles.actionBtn}>
              <TouchableOpacity onPress={handleLike} activeOpacity={0.6}>
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={22} 
                  color={isLiked ? Colors.error : Colors.textTertiary} 
                />
              </TouchableOpacity>
              {likesCount > 0 && (
                <TouchableOpacity
                  onPress={() => setLikesModalVisible(true)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                >
                  <Text style={[styles.actionCount, isLiked && styles.actionCountActive]}>
                    {likesCount > 999 ? `${(likesCount / 1000).toFixed(1)}k` : String(likesCount)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={22} color={Colors.textTertiary} />
              {commentsCount > 0 && (
                <Text style={styles.actionCount}>{commentsCount > 999 ? `${(commentsCount / 1000).toFixed(1)}k` : String(commentsCount)}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleRepost}>
              <Ionicons 
                name={isReposted ? "repeat" : "repeat-outline"} 
                size={22} 
                color={isReposted ? Colors.primary : Colors.textTertiary} 
              />
              {repostsCount > 0 && (
                <Text style={[styles.actionCount, isReposted && { color: Colors.primary }]}>{repostsCount}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleSave}>
              <Ionicons 
                name={isSaved ? "bookmark" : "bookmark-outline"} 
                size={22} 
                color={isSaved ? Colors.warning : Colors.textTertiary} 
              />
              {savesCount > 0 && (
                <Text style={styles.actionCount}>{savesCount}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <View style={styles.commentsSectionHeader}>
            <Text style={styles.commentsSectionTitle}>Comments</Text>
          </View>
          {commentsLoading ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.commentsLoadingText}>Loading comments...</Text>
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.commentsEmpty}>
              <Ionicons name="chatbubble-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.commentsEmptyTitle}>No comments yet</Text>
              <Text style={styles.commentsEmptySubtext}>Be the first to comment</Text>
            </View>
          ) : (
            comments.map((c, idx) => {
              const commentMinutes = Math.max(0, Math.floor((Date.now() - c.createdAt) / 60000));
              const canTap = !!(c.userId && onViewUser);
              const canDeleteComment =
                !!user?.uid &&
                !!c.userId &&
                String(user.uid) === String(c.userId);
              const avatarEl = (
                <UserAvatar
                  photoURL={c.photoURL}
                  displayName={c.displayName}
                  username={c.username}
                  size={32}
                />
              );
              const headerEl = (
                <View style={styles.commentMeta}>
                  <Text style={styles.commentName}>{c.displayName}</Text>
                  <Text style={styles.commentHandle}>@{c.username}</Text>
                  <Text style={styles.commentDot}>·</Text>
                  <Text style={styles.commentTime}>{formatTime(commentMinutes)}</Text>
                </View>
              );
              return (
                <View key={c.id} style={[styles.commentCard, idx === comments.length - 1 && { borderBottomWidth: 0 }]}>
                  {canTap ? (
                    <TouchableOpacity
                      style={styles.commentAvatarWrap}
                      onPress={() => onViewUser!(c.userId!)}
                      activeOpacity={0.7}
                    >
                      {avatarEl}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.commentAvatarWrap}>{avatarEl}</View>
                  )}
                  <View style={styles.commentContent}>
                    {canTap ? (
                      <TouchableOpacity onPress={() => onViewUser!(c.userId!)} activeOpacity={0.7}>
                        {headerEl}
                      </TouchableOpacity>
                    ) : headerEl}
                    <View style={styles.commentTextWrap}>
                      {renderTextWithStocks(c.text, styles.commentText) ?? (
                        <Text style={styles.commentText}>{c.text}</Text>
                      )}
                    </View>
                  </View>
                  {canDeleteComment && (
                    <TouchableOpacity
                      style={styles.commentDeleteBtn}
                      onPress={() => handleDeleteComment(c)}
                      disabled={deletingCommentId === c.id}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Delete comment"
                    >
                      {deletingCommentId === c.id ? (
                        <ActivityIndicator size="small" color={Colors.error} />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
        </ScrollView>

        {/* Comment input */}
        <View
          style={[
            styles.commentInputContainer,
            {
              paddingLeft: Spacing.lg + insets.left,
              paddingRight: Spacing.lg + insets.right,
              paddingTop: Spacing.md,
              paddingBottom: Math.max(Spacing.xs, insets.bottom),
            },
          ]}
        >
          <View style={styles.commentInputInner}>
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment..."
              placeholderTextColor={Colors.textTertiary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
              editable={!commentSubmitting}
            />
            <TouchableOpacity
              style={[styles.commentPostBtn, (!commentText.trim() || commentSubmitting) && styles.commentPostBtnDisabled]}
              onPress={handleAddComment}
              disabled={!commentText.trim() || commentSubmitting}
            >
              {commentSubmitting ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="send" size={18} color={Colors.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Price Change Modal */}
      <Modal
        visible={priceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPriceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Price Change</Text>
              <TouchableOpacity onPress={() => setPriceModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {allSymbols.length === 0 ? (
                <View style={styles.modalBody}>
                  <Text style={styles.modalNote}>No stocks mentioned in this post</Text>
                </View>
              ) : (
                allSymbols.map((symbol, index) => {
                  const data = stockData[symbol];
                  const priceAtCreation = pricesAtCreation[symbol];
                  
                  if (!data) {
                    return (
                      <View key={symbol} style={[styles.modalBody, index > 0 && styles.modalStockItemSeparator]}>
                        <Text style={styles.modalSymbol}>{symbol}</Text>
                        <Text style={styles.modalNote}>Loading price...</Text>
                      </View>
                    );
                  }
                  
                  return (
                    <View key={symbol} style={[styles.modalBody, index > 0 && styles.modalStockItemSeparator]}>
                      <Text style={styles.modalSymbol}>{symbol}</Text>
                      {data.price !== null && data.price !== undefined ? (
                        <>
                          <Text style={styles.modalPrice}>{formatCurrency(data.price)}</Text>
                          {data.changePct !== null && data.changePct !== undefined && (
                            <>
                              <Text style={[styles.modalChange, { color: data.changePct >= 0 ? Colors.success : Colors.error }]}>
                                {formatPercentage(data.changePct)}
                              </Text>
                              {priceAtCreation && (
                                <View style={styles.modalPriceRow}>
                                  <View style={styles.modalPriceItem}>
                                    <Text style={styles.modalPriceLabel}>At Post</Text>
                                    <Text style={styles.modalPriceValue}>{formatCurrency(priceAtCreation)}</Text>
                                  </View>
                                  <Ionicons name="arrow-forward" size={16} color={Colors.textTertiary} />
                                  <View style={styles.modalPriceItem}>
                                    <Text style={styles.modalPriceLabel}>Now</Text>
                                    <Text style={styles.modalPriceValue}>{formatCurrency(data.price)}</Text>
                                  </View>
                                </View>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <Text style={styles.modalNote}>Loading price...</Text>
                      )}
                    </View>
                  );
                })
              )}
              {allSymbols.length > 0 && (
                <Text style={styles.modalTime}>
                  {formatTime(post.minutesAgo)} ago
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <PostLikesModal
        visible={likesModalVisible}
        postId={post.id}
        onClose={() => setLikesModalVisible(false)}
        onViewUser={onViewUser}
      />
    </View>
  );
};

export default PostDetailScreen;

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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  moreButton: {
    padding: Spacing.xs,
  },
  moreMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: Spacing.md,
  },
  moreMenuCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 180,
    ...Shadows.medium,
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  moreMenuText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.small,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  avatarContainer: {
    width: 48,
    height: 48,
  },
  userInfo: {
    flex: 1,
    paddingTop: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  meta: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  topicPill: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary + '60',
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  topicText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  content: {
    marginBottom: Spacing.md,
  },
  postText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    lineHeight: 28,
    fontWeight: Typography.fontWeight.normal,
  },
  stockLink: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  stockSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  stockSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  stockSectionLabel: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  stockSectionDetailsLink: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.normal,
  },
  stockPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  stockPillSymbol: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  stockPillChange: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  stockUnavailable: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  actionCount: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  actionCountActive: {
    color: Colors.error,
    fontWeight: Typography.fontWeight.bold,
  },
  commentsSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  commentsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  commentsSectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  commentsCount: {
    backgroundColor: Colors.primary + '20',
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  commentsLoading: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  commentsLoadingText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  commentsEmpty: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  commentsEmptyTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  commentsEmptySubtext: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  commentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Glass.postBorder,
  },
  commentAvatarWrap: {
    paddingTop: 2,
  },
  commentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary + '35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  commentContent: {
    flex: 1,
    gap: 4,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  commentName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  commentHandle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
  commentDot: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
  commentTime: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
  },
  commentTextWrap: {
    marginTop: 2,
  },
  commentText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    lineHeight: 22,
  },
  commentDeleteBtn: {
    paddingTop: 4,
    paddingLeft: Spacing.xs,
  },
  commentInputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  commentInputInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  commentInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    lineHeight: 22,
    paddingTop: 0,
    paddingBottom: 0,
  },
  commentPostBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  commentPostBtnDisabled: {
    opacity: 0.4,
  },
  commentPostBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '90%',
    maxWidth: 450,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  modalScroll: {
    maxHeight: 500,
  },
  modalBody: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  modalStockItemSeparator: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  modalSymbol: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing.sm,
  },
  modalPrice: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.extrabold,
    marginBottom: Spacing.xs,
  },
  modalChange: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  modalNote: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  modalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalPriceItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  modalPriceLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalPriceValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  modalTime: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
