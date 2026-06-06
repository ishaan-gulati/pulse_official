import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBXgM-_AQsvPJ8Obvj6k-JPw2ZD2Fwjt5o",
  authDomain: "pulse-app-real.firebaseapp.com",
  projectId: "pulse-app-real",
  storageBucket: "pulse-app-real.firebasestorage.app",
  messagingSenderId: "733574590887",
  appId: "1:733574590887:web:6652e90dec8ce32a85c682",
  measurementId: "G-Z4M6GKZMB2"
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * React Native: `getAuth` alone uses in-memory persistence - sessions disappear when the app is
 * backgrounded or the OS reclaims memory (feels like "logged out every ~15 min").
 * `initializeAuth` + `getReactNativePersistence(AsyncStorage)` keeps the Firebase session on disk
 * like a normal app. Web keeps default browser persistence via `getAuth`.
 */
function createAuth(): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }

  const nativeAuth = require('firebase/auth') as typeof import('firebase/auth') & {
    getReactNativePersistence: (storage: typeof AsyncStorage) => import('firebase/auth').Persistence;
  };

  try {
    return nativeAuth.initializeAuth(app, {
      persistence: nativeAuth.getReactNativePersistence(AsyncStorage),
    });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw e;
  }
}

export const auth = createAuth();
export const db = getFirestore(app);

// If you used a custom database ID, uncomment and update this line:
// export const db = getFirestore(app, 'your-custom-database-id');

export default app;
