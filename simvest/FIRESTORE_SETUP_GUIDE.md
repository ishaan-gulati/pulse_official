# 🔥 Firestore Database Setup Guide

## 🚨 **Current Issue: Permission Errors**
Your app is getting these errors because Firestore security rules aren't set up yet:
```
ERROR Error creating user profile: [FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined]
ERROR Error getting leaderboard: [FirebaseError: Missing or insufficient permissions.]
```

## 📋 **Step-by-Step Setup:**

### **1. Go to Firebase Console**
- Open [Firebase Console](https://console.firebase.google.com/)
- Select your "pulse-app-real" project

### **2. Enable Firestore Database**
- Click **"Firestore Database"** in the left sidebar
- Click **"Create database"**
- Choose **"Start in test mode"** (we'll secure it later)
- Select a location (choose closest to your users)
- Click **"Done"**

### **3. Set Up Security Rules**
- In Firestore Database, click the **"Rules"** tab
- Replace the default rules with these secure ones:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      // Allow reading other users' public profile data for leaderboard
      allow read: if request.auth != null;
    }
    
    // Users can manage their own portfolio
    match /users/{userId}/portfolio/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can manage their own trading history
    match /users/{userId}/tradingHistory/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Default: deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- Click **"Publish"**

### **4. Create Indexes (Optional but Recommended)**
- Click the **"Indexes"** tab
- Click **"Create index"**
- Add these indexes for better performance:

**Collection:** `users`
**Fields:**
- `totalReturn` (Ascending)
- `createdAt` (Descending)

**Collection:** `users`
**Fields:**
- `username` (Ascending)

### **5. Test Your App**
- Run your app: `npx expo start`
- Create a new account
- Check the Firebase console to see data being created!

## 🎯 **What This Will Create:**

### **Users Collection Structure:**
```
users/
  {uid}/
    username: "ishaan123"
    displayName: "Ishaan Gulati"
    email: "ishaan@example.com"
    createdAt: [timestamp]
    lastLoginAt: [timestamp]
    lastActive: [timestamp]
    totalPortfolioValue: 10000
    totalReturn: 0
    isVerified: false
    rank: 0
```

### **Portfolio Subcollection:**
```
users/{uid}/portfolio/
  AAPL/
    symbol: "AAPL"
    shares: 10
    avgPrice: 150.00
    currentPrice: 175.50
    totalValue: 1755.00
    totalReturn: 255.00
    returnPercentage: 17.0
    lastUpdated: [timestamp]
```

### **Trading History Subcollection:**
```
users/{uid}/tradingHistory/
  {tradeId}/
    symbol: "AAPL"
    action: "buy"
    shares: 10
    price: 150.00
    totalAmount: 1500.00
    fees: 9.99
    timestamp: [timestamp]
```

## ✅ **After Setup, You'll See:**

1. **No more permission errors**
2. **User profiles created automatically**
3. **Real-time data sync**
4. **Personalized home screen**
5. **Working leaderboard**

## 🔒 **Security Features:**

- ✅ **User Isolation**: Users can only access their own data
- ✅ **Public Read**: Leaderboard data is readable by all users
- ✅ **Authenticated Only**: Must be logged in to access data
- ✅ **No Public Write**: Users can't modify others' data

## 🚀 **Next Steps After Setup:**

1. **Test user creation** - Sign up with a new account
2. **Check Firebase console** - See data being created
3. **Test leaderboard** - Should show real user data
4. **Add portfolio positions** - Use the demo data functions
5. **Build trading interface** - Buy/sell stocks

## 🆘 **If You Still Get Errors:**

1. **Check Firebase Console** - Make sure Firestore is enabled
2. **Verify Rules** - Rules should be published
3. **Check Network** - Make sure you have internet connection
4. **Restart App** - Sometimes need to restart after rule changes

---

**Once this is set up, your app will have a fully functional, secure database that stores personalized data for every user!** 🎉
