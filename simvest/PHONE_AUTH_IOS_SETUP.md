# 📱 Phone Authentication Setup for iOS

## Step 1: Firebase Console Setup

1. **Go to Firebase Console**
   - Visit [console.firebase.google.com](https://console.firebase.google.com)
   - Select your Pulse project

2. **Enable Phone Authentication**
   - Go to **Authentication** → **Sign-in method**
   - Click on **Phone**
   - Toggle **Enable** to ON
   - Click **Save**

3. **Add Test Phone Numbers (Optional)**
   - In the same Phone settings page
   - Scroll down to **Phone numbers for testing**
   - Click **Add phone number**
   - Add your phone number (e.g., +1234567890)
   - This allows testing without real SMS costs

## Step 2: Update Firebase Config

Replace the placeholder values in `src/config/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 3: Test Phone Authentication

1. **Run your app**: `npm start`
2. **Press 'r'** to reload
3. **Tap "Continue with Phone"** button
4. **Enter your phone number** (include country code: +1 for US)
5. **Tap "Send Verification Code"**
6. **Check your phone** for the SMS code
7. **Enter the 6-digit code** in the app
8. **Tap "Verify Code"**

## Step 4: What You'll See

### ✅ Success Flow:
- Phone number input screen
- "Verification code sent!" alert
- Code input screen
- "Phone verification successful!" alert
- "Welcome to Pulse! 🚀" alert

### ❌ Error Scenarios:
- **Invalid phone number**: "Please enter a valid phone number"
- **Network error**: "Failed to send verification code"
- **Invalid code**: "Invalid verification code"

## Step 5: Troubleshooting

### Common Issues:

1. **"Failed to send verification code"**
   - Check your Firebase config is correct
   - Ensure Phone auth is enabled in Firebase Console
   - Verify your phone number format (+1XXXXXXXXXX)

2. **"Invalid verification code"**
   - Make sure you enter the exact 6-digit code
   - Codes expire after 10 minutes
   - Use "Resend Code" if needed

3. **No SMS received**
   - Check your phone number is correct
   - Add your number to Firebase test numbers
   - Check spam folder

## Step 6: Production Setup

For production, you'll need:

1. **Firebase Phone Auth enabled**
2. **Real phone numbers** (no test numbers)
3. **SMS costs** (Firebase charges per SMS)
4. **App verification** (for high-volume usage)

## Current Status

✅ **What's Working:**
- Phone auth modal UI
- Firebase integration structure
- Error handling
- Success flow

❌ **What Needs Setup:**
- Real Firebase config values
- Phone auth enabled in Firebase Console
- Test phone number added

## Next Steps

1. **Update Firebase config** with your real values
2. **Enable Phone auth** in Firebase Console
3. **Add your phone number** to test numbers
4. **Test the flow** - it should work perfectly!

Once you complete these steps, phone authentication will be fully functional! 🚀 