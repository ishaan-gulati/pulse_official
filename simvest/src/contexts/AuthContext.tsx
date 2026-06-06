import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  User as FirebaseUser 
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { userService, UsernameLookupError } from '../services/userService';
import { referralService } from '../services/referralService';
import { deleteAllUserData } from '../services/accountDeletionService';

type AuthUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string, displayName: string, referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (email: string, password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Referrer payout: process any pending referralClaims as soon as session is ready (cold open).
        referralService.processPendingReferralClaims(firebaseUser.uid).catch(() => {});
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (emailInput: string, password: string) => {
    const identifier = emailInput.trim();
    try {
      let email = identifier;
      if (!identifier.includes('@')) {
        const userProfile = await userService.getUserByUsername(identifier);
        email = userProfile.email.trim();
      } else {
        email = identifier;
      }

      const credentialEmail = email.trim().toLowerCase();
      const result = await signInWithEmailAndPassword(auth, credentialEmail, password);

      userService.syncLoginUsernameLookup(result.user.uid).catch(() => {});

      referralService.getReferralCode(result.user.uid).catch(() => {});

      referralService.processPendingReferralClaims(result.user.uid).catch(() => {});

      try {
        await userService.updateUserProfile(result.user.uid, {
          lastLoginAt: new Date(),
        });
      } catch {
        // User is signed in; profile touch is best-effort
      }
    } catch (error: unknown) {
      if (error instanceof UsernameLookupError) {
        throw error;
      }
      const err = error as { code?: string; message?: string };
      const code = err?.code;

      if (code === 'auth/user-not-found') {
        throw new Error('No account found with this email');
      }
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        throw new Error('Incorrect email or password');
      }
      if (code === 'auth/invalid-email') {
        throw new Error('Invalid email address');
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Try again later');
      }
      if (code?.startsWith('auth/')) {
        throw new Error(err.message || 'Failed to sign in');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to sign in');
    }
  };

  const signup = async (email: string, password: string, username: string, displayName: string, referralCode?: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user profile in Firestore
      await userService.createUserProfile(result.user.uid, {
        username,
        displayName,
        email,
        totalPortfolioValue: 10000, // Start with $10k
        totalReturn: 0
      });

      referralService.getReferralCode(result.user.uid).catch(() => {});

      if (referralCode?.trim()) {
        try {
          const applied = await referralService.applyReferralCode(result.user.uid, referralCode.trim());
          if (!applied.success) {
            console.warn('Referral apply:', applied.message);
          }
        } catch (refErr) {
          console.warn('Referral code could not be applied:', refErr);
        }
      }
      
      console.log('User account and profile created successfully!');
    } catch (error: any) {
      let message = 'Failed to create account';
      if (error.code === 'auth/email-already-in-use') {
        message = 'An account with this email already exists';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      }
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const deleteAccount = async (email: string, password: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== user?.uid) {
      throw new Error('You must be signed in to delete your account.');
    }
    const credential = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(currentUser, credential);
    await deleteAllUserData(currentUser.uid);
    await deleteUser(currentUser);
  };

  const value = useMemo<AuthContextValue>(() => ({ 
    user, 
    loading, 
    login, 
    signup, 
    logout,
    deleteAccount,
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

