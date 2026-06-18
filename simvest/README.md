# Pulse

**Social paper trading for the next generation.** Pulse is a mobile-first app where you practice investing with $10,000 in virtual cash, follow real market prices, and compete with friends — no real money, no risk.

[Download on the App Store](https://apps.apple.com/us/app/pulse-social-paper-trading/id6760734269)

---

## What you can do

### Trade with real market data
- Start with **$10,000** in simulated cash (commission-free trades)
- Search stocks, ETFs, crypto, and commodities with live quotes
- View candlestick charts (1D / 1W / 1M / 1Y), company details, and market news
- Set **price alerts** that trigger when a symbol crosses your target
- Get **AI-powered explanations** of stocks and your portfolio (Groq)

### Social & community
- **Feed** with For You and Following tabs — post trade ideas, react, comment, save, and repost
- **Follow** traders and send **friend requests**
- Join **groups** via invite code and chat with members
- View other users' profiles, badges, and (optionally) their portfolios

### Compete & level up
- **Leaderboard** ranked by total portfolio value
- **XP, levels, and achievements** earned from trading and milestones
- **Referral program** — invite friends and earn bonus virtual cash when they sign up

### Your portfolio
- Track holdings, cost basis, unrealized/realized P/L, win rate, and streaks
- Portfolio performance chart over time
- **Reset portfolio** to $10k anytime from Settings (practice mode)

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Mobile app | React Native, Expo 54, TypeScript |
| Auth & database | Firebase Authentication, Cloud Firestore |
| Cloud functions | Firebase Functions (referral payout automation) |
| Market data | Finnhub (primary), Alpha Vantage, Financial Modeling Prep, Yahoo Finance |
| AI | Groq (Llama 3.1) for stock/portfolio explain |
| UI | Custom dark theme, glass surfaces, Expo Vector Icons |

---

## Project structure

```
simvest/
├── App.tsx                    # Root navigation & tab shell
├── src/
│   ├── screens/               # Home, Search, Portfolio, Leaderboard, Profile, …
│   ├── components/            # Feed cards, trade modal, charts, modals
│   ├── services/              # Trading, posts, groups, gamification, market data
│   ├── contexts/              # AuthContext (persistent RN sessions)
│   ├── config/                # Firebase & API key wiring (from env vars)
│   ├── constants/             # Theme, URLs, onboarding options
│   └── types/                 # Shared TypeScript types
├── functions/                 # Cloud Functions (referral payouts)
├── scripts/                   # Admin/maintenance scripts (Firebase Admin)
├── firestore.rules            # Firestore security rules
├── firebase.json              # Firebase deploy config
└── .env.example               # Environment variable template
```

---

## Getting started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm**
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (included via `npx expo`)
- **iOS**: Xcode + CocoaPods (for `npm run ios`)
- **Android**: Android Studio + SDK (for `npm run android`)
- A **Firebase project** with Email/Password auth and Firestore enabled

### 1. Clone and install

```bash
git clone https://github.com/ishaan-gulati/pulse_official.git
cd pulse_official/simvest
npm install
```

For iOS native builds, install pods:

```bash
cd ios && pod install && cd ..
```

### 2. Configure environment variables

Copy the template and fill in your keys. **Never commit `.env`.**

```bash
cp .env.example .env
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_FINNHUB_API_KEY` | Yes | Real-time quotes & search ([Finnhub](https://finnhub.io/register)) |
| `EXPO_PUBLIC_FIREBASE_*` | Yes | Firebase client config (Console → Project settings) |
| `EXPO_PUBLIC_GROQ_API_KEY` | For AI explain | Groq API ([console.groq.com](https://console.groq.com/keys)) |
| `EXPO_PUBLIC_ALPHA_VANTAGE_API_KEY` | Optional | Fallback market data |
| `EXPO_PUBLIC_FMP_API_KEY` | Optional | Fallback market data |
| `EXPO_PUBLIC_USE_REAL_NEWS` | Optional | Set to `true` for live news feed |

Firebase config is read from env vars in `src/config/firebase.ts` — no credentials are hardcoded in source.

### 3. Firebase setup

1. Create a project in the [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication → Email/Password**
3. Create a **Firestore** database
4. Deploy security rules:

   ```bash
   npm run deploy:firestore-rules
   ```

5. (Optional) Deploy Cloud Functions for server-side referral payouts:

   ```bash
   cd functions && npm install && cd ..
   npx firebase deploy --only functions
   ```

Admin scripts (`scripts/`) require a service account JSON via `GOOGLE_APPLICATION_CREDENTIALS`. Never commit `*-firebase-adminsdk-*.json` or `serviceAccount*.json`.

### 4. Run the app

```bash
npm start          # Expo dev server (scan QR or press i/a)
npm run ios        # iOS simulator / device
npm run android    # Android emulator / device
npm run web        # Web (limited; mobile is the primary target)
```

---

## Available scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start Expo dev server |
| `npm run ios` / `android` | Run native dev build |
| `npm run deploy:firestore-rules` | Deploy `firestore.rules` to Firebase |
| `npm run export:users` | Export Auth users to CSV (requires service account) |
| `npm run backfill:login-usernames` | Backfill username → email login mapping |
| `npm run revoke:all-sessions` | Revoke all Firebase refresh tokens |
| `npm run reset:referral-stats` | Reset referral stats (admin) |

---

## Security & privacy

- User **emails are not stored** on public Firestore profile documents; sign-in uses a separate `loginUsernames` collection
- API keys and Firebase config live in `.env` only (see `.env.example`)
- Firestore rules enforce per-user writes
- Auth user exports (`pulse-auth-users*.csv`) and service account keys are gitignored

---

## Links

- **App Store**: [Pulse — Social Paper Trading](https://apps.apple.com/us/app/pulse-social-paper-trading/id6760734269)
- **Privacy policy**: [ishaan-gulati.github.io/Pulse/privacy.html](https://ishaan-gulati.github.io/Pulse/privacy.html)
- **Terms of service**: [ishaan-gulati.github.io/Pulse/terms.html](https://ishaan-gulati.github.io/Pulse/terms.html)
- **Support**: [ishaan-gulati.github.io/Pulse/support.html](https://ishaan-gulati.github.io/Pulse/support.html)

---

## License

MIT
