import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, Dimensions, ScrollView, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AuthModal from '../components/AuthModal';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../constants/urls';

const { width, height } = Dimensions.get('window');

const LoginScreen: React.FC = () => {
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Use useRef to store animation references and prevent recreation
  const animationRefs = useRef({
    // Logo animations
    logoRotate: new Animated.Value(0),
    logoScale: new Animated.Value(0),
    bottomEnter: new Animated.Value(0),
  });

  // Destructure for easier access
  const {
    logoRotate, logoScale, bottomEnter
  } = animationRefs.current;

  // Flag to ensure animations only start once
  const animationsStarted = useRef(false);

  useEffect(() => {
    // Prevent multiple animation starts
    if (animationsStarted.current) return;
    animationsStarted.current = true;

    // Start logo rotation - faster and seamless
    Animated.loop(
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 2000, // Faster rotation (was 5000)
        useNativeDriver: true,
        easing: (t) => t, // Linear easing for constant speed
      }),
      { iterations: -1 } // Infinite iterations
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.timing(bottomEnter, {
      toValue: 1,
      duration: 520,
      delay: 180,
      useNativeDriver: true,
    }).start();

    // Cleanup function to stop animations when component unmounts
    return () => {
      animationsStarted.current = false;
      // Stop logo animations
      [logoRotate, logoScale, bottomEnter].forEach(anim => anim.stopAnimation());
    };
  }, []);


  return (
    <View style={styles.container}>
      {/* Main Content */}
      <View style={styles.mainContainer}>
        {/* Top Section - Logo and Title */}
        <View style={styles.topSection}>
          <Animated.Image
            source={require('../../assets/icon.png')}
            style={useMemo(() => [styles.logo, {
              transform: [
                { 
                  rotate: logoRotate.interpolate({ 
                    inputRange: [0, 1], 
                    outputRange: ['0deg', '360deg'],
                    extrapolate: 'clamp', // Prevent going beyond 360deg
                  }) 
                },
                { scale: logoScale.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) },
              ],
            }], [logoRotate, logoScale])}
          />
          
          {/* App Title and Slogan */}
          <Text style={styles.title}>Pulse</Text>
          <Text style={styles.slogan}>Trade. Compete. Win.</Text>
        </View>

        {/* Bottom Section - Sign In/Sign Up */}
        <Animated.View
          style={{
            width: '100%',
            opacity: bottomEnter,
            transform: [
              {
                translateY: bottomEnter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [22, 0],
                }),
              },
            ],
          }}
        >
        <View style={styles.bottomSection}>
          {/* Paper trading disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              Paper trading only - no real money is ever used or at risk.
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.button} 
            onPress={() => {
              setAuthMode('signin');
              setAuthModalVisible(true);
            }}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toggleButton}
            onPress={() => {
              setAuthMode('signup');
              setAuthModalVisible(true);
            }}
          >
            <Text style={styles.toggleText}>
              Don't have an account? Sign Up
            </Text>
          </TouchableOpacity>

          {/* Legal links */}
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}>
              <Text style={styles.legalLink}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Animated.View>
      </View>
      
      {/* Auth Modal */}
      <AuthModal 
        visible={authModalVisible} 
        onClose={() => setAuthModalVisible(false)}
        mode={authMode}
      />
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mainContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 32,
  },
  topSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  bottomSection: {
    width: '100%',
    gap: 16,
    paddingBottom: 20,
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  slogan: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '500',
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  input: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(11, 15, 20, 0.8)',
    borderWidth: 1,
    borderColor: '#1C2430',
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    height: 56,
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  disclaimerText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    flex: 1,
    lineHeight: 18,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  legalLink: {
    color: '#4B5563',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalDot: {
    color: '#4B5563',
    fontSize: 12,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    backgroundColor: '#0B0F14',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  rememberMeText: {
    color: '#9AA4B2',
    fontSize: 14,
    fontWeight: '500',
  },
  quickLoginInfo: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 24,
    width: '100%',
  },
  quickLoginText: {
    color: '#9AA4B2',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  quickLoginHighlight: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  error: {
    color: '#F87171',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});


