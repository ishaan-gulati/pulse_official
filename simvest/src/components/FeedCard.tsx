import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import UserBadges from './UserBadges';
import GlassSurface from './GlassSurface';
import UserAvatar from './UserAvatar';
import { FeedPost } from '../types';
import { Colors, Spacing, BorderRadius, Typography, Glass } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { postsService } from '../services/postsService';
import { parseTextWithStocks, getPrimaryStockSymbol, extractStockSymbols } from '../utils/stockParser';
import PostLikesModal from './PostLikesModal';

type FeedCardProps = {
  post: FeedPost;
  onUpdate?: () => void;
  onPress?: () => void;
  onStockPress?: (symbol: string) => void;
  onViewUser?: (uid: string) => void;
};

const FeedCard: React.FC<FeedCardProps> = ({ post, onUpdate, onPress, onStockPress, onViewUser }) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [isReposted, setIsReposted] = useState(false);
  const [likesCount, setLikesCount] = useState(post.stats?.likes || 0);
  const [savesCount, setSavesCount] = useState(post.stats?.saves || 0);
  const [repostsCount, setRepostsCount] = useState(post.stats?.reposts || 0);
  const [likesModalVisible, setLikesModalVisible] = useState(false);

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

  const handleLike = async () => {
    if (!user?.uid) {
      Alert.alert('Sign In Required', 'Please sign in to like posts');
      return;
    }

    try {
      await postsService.likePost(post.id, user.uid);
      setIsLiked(!isLiked);
      setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
      onUpdate?.();
    } catch (error: any) {
      console.error('Error liking post:', error);
      Alert.alert('Error', error?.message || 'Failed to like post');
    }
  };

  const handleSave = async () => {
    if (!user?.uid) {
      Alert.alert('Sign In Required', 'Please sign in to save posts');
      return;
    }

    try {
      await postsService.savePost(post.id, user.uid);
      setIsSaved(!isSaved);
      setSavesCount(isSaved ? savesCount - 1 : savesCount + 1);
      onUpdate?.();
    } catch (error: any) {
      console.error('Error saving post:', error);
      Alert.alert('Error', error?.message || 'Failed to save post');
    }
  };

  const handleRepost = async () => {
    if (!user?.uid) {
      Alert.alert('Sign In Required', 'Please sign in to repost');
      return;
    }

    try {
      await postsService.repost(post.id, user.uid);
      setIsReposted(!isReposted);
      setRepostsCount(isReposted ? repostsCount - 1 : repostsCount + 1);
      onUpdate?.();
    } catch (error: any) {
      console.error('Error reposting:', error);
      Alert.alert('Error', error?.message || 'Failed to repost');
    }
  };

  const handleComment = () => {
    onPress?.();
  };

  const formatTime = (minutes: number) => {
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const renderTextWithStocks = (text: string, textStyle: any) => {
    if (!text || text.trim() === '') {
      return <Text style={textStyle}></Text>;
    }
    const segments = parseTextWithStocks(text);
    if (segments.length === 0) {
      return <Text style={textStyle}>{text}</Text>;
    }
    
    // Filter out empty segments but keep at least one
    const validSegments = segments.filter(seg => seg.text && seg.text.trim() !== '');
    if (validSegments.length === 0) {
      return <Text style={textStyle}>{text}</Text>;
    }
    
    return (
      <Text style={textStyle}>
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

  // Get all stock symbols mentioned in the post
  const allSymbols = post.stockSymbols && post.stockSymbols.length > 0
    ? post.stockSymbols
    : extractStockSymbols(post.title + ' ' + (post.body || ''));

  const handleStockPress = (symbol: string) => {
    // Navigate to stock - this will be handled by the parent
    onStockPress?.(symbol);
  };

  const handleCardPress = () => {
    onPress?.();
  };

  return (
    <>
    <TouchableOpacity onPress={handleCardPress} activeOpacity={0.85}>
      <GlassSurface
        style={styles.card}
        borderRadius={BorderRadius.xxl}
        variant="subtle"
        glow="purple"
        borderColor={Glass.postBorder}
        borderWidth={StyleSheet.hairlineWidth}
        tintColor="rgba(0, 0, 0, 0.92)"
        intensity={Glass.blurIntensityLight}
      >
        <View style={styles.cardInner}>
      <View style={styles.headerRow}>
        {post.userId && onViewUser ? (
          <TouchableOpacity
            style={styles.headerAuthorTouchable}
            onPress={() => onViewUser(post.userId!)}
            activeOpacity={0.7}
          >
            <View style={styles.avatarContainer}>
              <UserAvatar
                photoURL={post.user.avatar}
                displayName={post.user.name}
                username={post.user.handle}
                size={44}
              />
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
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.avatarContainer}>
              <UserAvatar
                photoURL={post.user.avatar}
                displayName={post.user.name}
                username={post.user.handle}
                size={44}
              />
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
          </>
        )}
        {post.topic && (
          <View style={styles.topicPill}>
            <Text style={styles.topicText}>{post.topic}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {renderTextWithStocks(post.title, styles.title)}
        {post.body && renderTextWithStocks(post.body, styles.body)}
      </View>

      {/* Stock Price Indicator - All Stocks */}
      {allSymbols.length > 0 && (
        <View style={styles.stockIndicator}>
          <View style={styles.stockPillsContainer}>
            {allSymbols.map((symbol, index) => (
              <TouchableOpacity
                key={symbol}
                style={styles.stockPill}
                onPress={() => handleStockPress(symbol)}
                activeOpacity={0.7}
              >
                <Text style={styles.stockPillText}>{symbol}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <Action 
          icon="heart" 
          count={likesCount} 
          active={isLiked}
          onPress={handleLike}
          onCountPress={() => setLikesModalVisible(true)}
        />
        <Action 
          icon="chatbubble" 
          count={post.stats?.comments} 
          onPress={handleComment}
        />
        <Action 
          icon="repeat" 
          count={repostsCount} 
          active={isReposted}
          onPress={handleRepost}
        />
        <Action 
          icon="bookmark" 
          count={savesCount} 
          active={isSaved}
          onPress={handleSave}
        />
      </View>
        </View>
      </GlassSurface>
    </TouchableOpacity>
    <PostLikesModal
      visible={likesModalVisible}
      postId={post.id}
      onClose={() => setLikesModalVisible(false)}
      onViewUser={onViewUser}
    />
    </>
  );
};

const Action: React.FC<{ 
  icon: any; 
  count?: number;
  active?: boolean;
  onPress?: () => void;
  onCountPress?: () => void;
}> = ({ icon, count, active, onPress, onCountPress }) => {
  const iconName = active 
    ? icon === 'heart' ? 'heart' : icon === 'bookmark' ? 'bookmark' : icon === 'repeat' ? 'repeat' : `${icon}-outline`
    : `${icon}-outline`;
  
  const iconColor = active && (icon === 'heart' || icon === 'bookmark' || icon === 'repeat')
    ? icon === 'heart' ? Colors.error : icon === 'bookmark' ? Colors.warning : Colors.primary
    : Colors.textTertiary;

  return (
    <View style={styles.actionBtn}>
      <TouchableOpacity 
        style={styles.actionIconBtn}
        onPress={onPress}
        activeOpacity={0.6}
      >
        <Ionicons name={iconName as any} size={20} color={iconColor} />
      </TouchableOpacity>
      {typeof count === 'number' && count > 0 ? (
        <TouchableOpacity
          onPress={onCountPress ?? onPress}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        >
          <Text style={[styles.actionCount, active && icon === 'heart' && styles.actionCountActive]}>
            {count > 999 ? `${(count / 1000).toFixed(1)}k` : String(count)}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default FeedCard;

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  cardInner: {
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerAuthorTouchable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: Spacing.md,
  },
  avatarContainer: {
    width: 44,
    height: 44,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
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
    marginTop: 1,
  },
  topicPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderColor: Glass.postBorder,
    borderWidth: StyleSheet.hairlineWidth,
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
    paddingLeft: Spacing.xs,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    lineHeight: 28,
    marginBottom: Spacing.xs,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.md,
    lineHeight: 22,
    marginTop: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    minHeight: 36,
  },
  actionIconBtn: {
    padding: 2,
  },
  actionCount: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    minWidth: 16,
  },
  actionCountActive: {
    color: Colors.error,
    fontWeight: Typography.fontWeight.bold,
  },
  stockLink: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  stockIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  stockPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  stockPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderColor: Glass.postBorder,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  stockPillText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
});


