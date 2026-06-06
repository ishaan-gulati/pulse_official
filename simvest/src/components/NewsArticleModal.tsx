import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { MarketNews } from '../services/marketDataService';
import { summaryService } from '../services/summaryService';

type NewsArticleModalProps = {
  visible: boolean;
  article: MarketNews | null;
  onClose: () => void;
};

const NewsArticleModal: React.FC<NewsArticleModalProps> = ({ visible, article, onClose }) => {
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && article) {
      setLoading(true);
      // Generate AI summary from the article
      summaryService.generateSummary(article.title, article.summary, article.url)
        .then((summary) => {
          setAiSummary(summary);
          setLoading(false);
        })
        .catch((error) => {
          console.error('Error generating summary:', error);
          setAiSummary(article.summary); // Fallback to original summary
          setLoading(false);
        });
    } else {
      // Reset when modal closes
      setAiSummary('');
      setLoading(false);
    }
  }, [visible, article]);

  if (!article) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Market News</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Image */}
          {article.imageUrl && article.imageUrl.trim() !== '' && (
            <Image source={{ uri: article.imageUrl }} style={styles.image} resizeMode="cover" />
          )}

          {/* Article Content */}
          <View style={styles.content}>
            <Text style={styles.title}>{article.title}</Text>
            
            <View style={styles.meta}>
              <Text style={styles.source}>{article.source}</Text>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.time}>{article.publishedAt}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summarySection}>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={16} color={Colors.primary} />
                <Text style={styles.aiBadgeText}>AI Summary</Text>
              </View>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.loadingText}>Generating summary...</Text>
                </View>
              ) : (
                <Text style={styles.summary}>{aiSummary || article.summary}</Text>
              )}
            </View>

            {/* Related Stocks */}
            {article.relatedStocks && article.relatedStocks.length > 0 && (
              <View style={styles.relatedSection}>
                <Text style={styles.relatedTitle}>Related Stocks</Text>
                <View style={styles.relatedStocks}>
                  {article.relatedStocks.map((symbol) => (
                    <View key={symbol} style={styles.stockBadge}>
                      <Text style={styles.stockSymbol}>{symbol}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default NewsArticleModal;

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
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.backgroundSecondary,
  },
  content: {
    padding: Spacing.lg,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
    lineHeight: 32,
    marginBottom: Spacing.md,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  source: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  separator: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  time: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  summarySection: {
    marginBottom: Spacing.xl,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  aiBadgeText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  summary: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xl,
    lineHeight: 32,
    marginBottom: Spacing.xl,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
  },
  relatedSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  relatedTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
  },
  relatedStocks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  stockBadge: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  stockSymbol: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
});

