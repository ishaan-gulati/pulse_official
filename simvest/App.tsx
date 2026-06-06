import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, AppState, AppStateStatus, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { stockPriceService } from './src/services/stockPriceService';
import { resetFinnhubRateLimit } from './src/services/finnhubRateLimit';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import PortfolioScreen from './src/screens/PortfolioScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import BottomNavbar from './src/components/BottomNavbar';
import ComposeModal from './src/components/ComposeModal';
import { Colors } from './src/constants/theme';
import { TabKey, FeedPost } from './src/types';
import { referralService } from './src/services/referralService';
import { priceAlertsService } from './src/services/priceAlertsService';
import { friendService } from './src/services/friendService';
import VersionGate from './src/components/VersionGate';
import PostSignupOnboardingScreen from './src/screens/PostSignupOnboardingScreen';
import { userService } from './src/services/userService';

const PRICE_ALERT_POLL_MS = 50_000;

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [priceAlertsUnread, setPriceAlertsUnread] = useState(0);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const [priceAlertSyncKey, setPriceAlertSyncKey] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [searchSymbol, setSearchSymbol] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [portfolioRootKey, setPortfolioRootKey] = useState(0);
  const [homeRootKey, setHomeRootKey] = useState(0);
  const [searchRootKey, setSearchRootKey] = useState(0);
  const [profileRootKey, setProfileRootKey] = useState(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const leaderboardListRef = useRef<FlatList | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  const runPriceAlertsPoll = React.useCallback(async (uid: string) => {
    try {
      const { unreadExecutedCount } = await priceAlertsService.checkAndExecutePriceAlerts(uid);
      setPriceAlertsUnread(unreadExecutedCount);
      setPriceAlertSyncKey((k) => k + 1);
    } catch (e) {
      console.warn('Price alert poll failed:', e);
    }
  }, []);

  const refreshPriceAlertUnread = React.useCallback(() => {
    if (!user?.uid) return;
    void priceAlertsService.getUnreadExecutedAlertCount(user.uid).then(setPriceAlertsUnread);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setPriceAlertsUnread(0);
      return;
    }
    void runPriceAlertsPoll(user.uid);
    const t = setInterval(() => void runPriceAlertsPoll(user.uid), PRICE_ALERT_POLL_MS);
    return () => clearInterval(t);
  }, [user?.uid, runPriceAlertsPoll]);

  useEffect(() => {
    if (!user?.uid) {
      setPendingFriendRequests(0);
      return;
    }
    const unsub = friendService.subscribeToPendingRequestCount(user.uid, setPendingFriendRequests);
    return () => unsub();
  }, [user?.uid]);

  // On mount and when app comes to foreground: reset API state so real-time prices load
  useEffect(() => {
    resetFinnhubRateLimit();
    stockPriceService.clearCache();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        resetFinnhubRateLimit();
        stockPriceService.clearCache();
        if (user?.uid) {
          referralService.processPendingReferralClaims(user.uid).catch(() => {});
          void runPriceAlertsPoll(user.uid);
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [user?.uid, runPriceAlertsPoll]);

  // Referrer payouts: process immediately when a claim appears (listener), on a timer, and on foreground.
  useEffect(() => {
    if (!user?.uid) return;
    referralService.processPendingReferralClaims(user.uid).catch(() => {});
    const unsubClaims = referralService.subscribeReferralClaimsForReferrer(user.uid);
    const t = setInterval(() => {
      referralService.processPendingReferralClaims(user.uid).catch(() => {});
    }, 60000);
    return () => {
      clearInterval(t);
      unsubClaims();
    };
  }, [user?.uid]);

  // When leaving Profile tab, close Settings so Profile shows first next time
  useEffect(() => {
    if (activeTab !== 'profile') {
      setShowSettings(false);
    }
  }, [activeTab]);

  // Reset to home tab and clear all overlays whenever the user signs in
  const prevUserRef = useRef<string | null>(null);
  useEffect(() => {
    const currentUid = user?.uid ?? null;
    if (currentUid && currentUid !== prevUserRef.current) {
      // A new user just signed in - always land on the home tab fresh
      setActiveTab('home');
      setSelectedPost(null);
      setViewingUserId(null);
      setShowSettings(false);
      setSearchSymbol(null);
    }
    prevUserRef.current = currentUid;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setNeedsOnboarding(null);
      return;
    }
    let cancelled = false;
    userService
      .getUserProfile(user.uid)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          setNeedsOnboarding(false);
          return;
        }
        setNeedsOnboarding(p.onboardingCompleted === false);
      })
      .catch(() => {
        if (!cancelled) setNeedsOnboarding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const scrollLeaderboardToTop = () => {
    setTimeout(() => {
      leaderboardListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    }, 50);
  };

  const handleTabPress = (tab: TabKey) => {
    if (activeTab === tab) {
      // Already on this tab: go back to this tab's "home" / root or refresh
      if (tab === 'home') {
        setSelectedPost(null);
        setHomeRootKey((k) => k + 1);
      } else if (tab === 'search') {
        setSearchSymbol(null);
        setSearchRootKey((k) => k + 1);
      } else if (tab === 'profile') {
        setShowSettings(false);
        setProfileRootKey((k) => k + 1); // refresh profile when already there
      } else if (tab === 'portfolio') {
        setPortfolioRootKey((k) => k + 1);
      } else if (tab === 'leaderboard') {
        scrollLeaderboardToTop();
      }
      return;
    }
    // Switching to another tab: clear overlays so we actually land on the tab
    setViewingUserId(null);
    setSelectedPost(null);
    setActiveTab(tab);
    if (tab !== 'search') setSearchSymbol(null);
    if (tab !== 'profile') setShowSettings(false);
    if (tab === 'leaderboard') scrollLeaderboardToTop();
  };

  if (loading) {
    return <View style={styles.loadingContainer} />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (needsOnboarding) {
    return <PostSignupOnboardingScreen onFinished={() => setNeedsOnboarding(false)} />;
  }

  const handlePostCreated = () => {
    // Trigger refresh of HomeScreen
    setRefreshKey(prev => prev + 1);
  };

  const handleNavigateToPost = (post: FeedPost) => {
    setSelectedPost(post);
  };

  const handleNavigateToStock = (symbol: string) => {
    setSearchSymbol(symbol);
    setActiveTab('search');
  };

  const handleViewUser = (uid: string) => {
    if (uid === user?.uid) {
      setSelectedPost(null);
      setViewingUserId(null);
      setActiveTab('profile');
    } else {
      setViewingUserId(uid);
    }
  };

  const renderScreen = () => {
    if (viewingUserId) {
      return (
        <UserProfileScreen
          userId={viewingUserId}
          onBack={() => setViewingUserId(null)}
        />
      );
    }
    if (selectedPost) {
      return (
        <PostDetailScreen
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onNavigateToStock={handleNavigateToStock}
          onPostDeleted={() => setRefreshKey(prev => prev + 1)}
          onViewUser={handleViewUser}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            key={`home-${homeRootKey}`}
            refreshKey={refreshKey}
            onCompose={() => setComposeOpen(true)}
            onNavigateToAlerts={() => setActiveTab('alerts')}
            onNavigateToPost={handleNavigateToPost}
            onNavigateToStock={handleNavigateToStock}
            onViewUser={handleViewUser}
            priceAlertsUnreadCount={priceAlertsUnread}
          />
        );
      case 'search':
        return (
          <SearchScreen
            key={`search-${searchRootKey}`}
            initialSymbol={searchSymbol || undefined}
          />
        );
      case 'leaderboard':
        return (
          <LeaderboardScreen
            onViewUser={handleViewUser}
            listRef={leaderboardListRef}
          />
        );
      case 'portfolio':
        return (
          <PortfolioScreen
            key={`portfolio-${portfolioRootKey}`}
            onNavigateToProfile={() => setActiveTab('profile')}
            onNavigateToStock={handleNavigateToStock}
          />
        );
      case 'profile':
        if (showSettings) {
          return <SettingsScreen onBack={() => setShowSettings(false)} />;
        }
        return (
          <ProfileScreen
            key={`profile-${profileRootKey}`}
            onOpenSettings={() => setShowSettings(true)}
            onViewUser={handleViewUser}
            pendingFriendRequests={pendingFriendRequests}
          />
        );
      case 'alerts':
        return (
          <NotificationsScreen
            onBack={() => setActiveTab('home')}
            alertSyncKey={priceAlertSyncKey}
            onAcknowledgedExecutedAlert={refreshPriceAlertUnread}
          />
        );
      default:
        return (
          <HomeScreen
            refreshKey={refreshKey}
            onCompose={() => setComposeOpen(true)}
            priceAlertsUnreadCount={priceAlertsUnread}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.screenContainer}>{renderScreen()}</View>
      <BottomNavbar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        profileBadgeCount={pendingFriendRequests}
      />
      <ComposeModal 
        visible={composeOpen} 
        onClose={() => setComposeOpen(false)}
        onPostCreated={handlePostCreated}
      />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <VersionGate>
          <AppContent />
        </VersionGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
