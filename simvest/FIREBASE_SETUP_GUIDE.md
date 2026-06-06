# Firebase Setup Guide for Pulse App

## Step 1: Get Your Firebase Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Click the gear icon ⚙️ next to "Project Overview"
4. Select "Project settings"
5. Scroll down to "Your apps" section
6. Click the web app icon (</>) to add a web app
7. Register your app with a nickname (e.g., "Pulse Web")
8. Copy the config object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 2: Update Firebase Config

Replace the placeholder values in `src/config/firebase.ts` with your actual Firebase config:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_ACTUAL_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_ACTUAL_PROJECT_ID",
  storageBucket: "YOUR_ACTUAL_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_ACTUAL_SENDER_ID",
  appId: "YOUR_ACTUAL_APP_ID"
};
```

## Step 3: Enable Authentication Methods

1. In Firebase Console, go to "Authentication" → "Sign-in method"
2. Enable these providers:
   - **Email/Password** (for testing)
   - **Phone** (for phone auth)
   - **Google** (for Google sign-in)
   - **Apple** (for Apple sign-in)

### For Email/Password:
- Just enable it - no additional setup needed

### For Phone Authentication:
- Enable it
- Add your phone number for testing

### For Google Sign-In:
- Enable it
- Add your domain to authorized domains

### For Apple Sign-In:
- Enable it
- Add your domain to authorized domains

## Step 4: Test the Authentication

Once you've updated the Firebase config, the buttons should work:

- **Phone**: Will show "Verification code sent!" (requires phone setup)
- **Apple**: Will try to sign in with `apple@example.com` (for testing)
- **Google**: Will try to sign in with `google@example.com` (for testing)

## Step 5: Create Test Users (Optional)

For testing, you can create users in Firebase Console:

1. Go to "Authentication" → "Users"
2. Click "Add user"
3. Create these test accounts:
   - Email: `apple@example.com`, Password: `applepass123`
   - Email: `google@example.com`, Password: `googlepass123`

## Current Status

✅ **What's Working:**
- Firebase configuration structure
- Authentication context
- Basic sign-in/sign-up functions
- UI components

❌ **What Needs Setup:**
- Real Firebase config values
- Authentication providers enabled
- Test users created

## Next Steps

1. **Update Firebase config** with your real values
2. **Enable authentication providers** in Firebase Console
3. **Create test users** for the demo accounts
4. **Test the buttons** - they should work!

Once you do this, your authentication will be fully functional! 🚀 