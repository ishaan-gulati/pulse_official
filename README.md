# 📈 Pulse — Social Paper Trading

**Gamified investing, made social.**

Pulse is an iOS app that lets you trade stocks with virtual money, compete with friends, and actually learn how the market works — without risking real cash. Built with React Native + Expo, live market data, and a leaderboard-driven social layer.

[![App Store](https://img.shields.io/badge/App_Store-Download-blue?logo=apple)](https://apps.apple.com/us/app/pulse-social-paper-trading/id6760734269)

---

## 🚀 What It Does

- **Paper trade** any stock in real-time with a virtual $10,000 portfolio
- **Leaderboard** — see how your returns stack up against other users
- **Social feed** — follow friends, react to trades, share plays
- **Portfolio analytics** — track P&L, holdings breakdown, and performance over time
- **Gamified XP system** — earn points for trades, streaks, and hitting milestones

---

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React Native + Expo |
| Backend / Auth | Firebase (Firestore, Auth, Storage) |
| Market Data | Polygon.io API |
| Deployment | EAS Build → App Store |

---

## 📱 Screenshots

> Coming soon — see the live app on the [App Store](https://apps.apple.com/us/app/pulse-social-paper-trading/id6760734269)

---

## 🏗 Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- A Firebase project with Firestore + Auth enabled
- A Polygon.io API key

### Install & Run

```bash
git clone https://github.com/YOUR_USERNAME/pulse.git
cd pulse
npm install
```

Create a `.env` file in the root:

```
EXPO_PUBLIC_FIREBASE_API_KEY=your_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_POLYGON_API_KEY=your_polygon_key
```

Then start the dev server:

```bash
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or run on a simulator.

---

## 🗺 Roadmap

- [x] Core paper trading engine
- [x] Real-time leaderboard
- [x] App Store launch
- [ ] Friends / following system
- [ ] Group portfolios & challenges
- [ ] Profile pictures & customization
- [ ] Push notifications for price alerts

---

## 👤 About

Built by **Ishaan** — high school developer and investor.

- App: [apps.apple.com/us/app/pulse-social-paper-trading/id6760734269](https://apps.apple.com/us/app/pulse-social-paper-trading/id6760734269)
- Instagram: [@investingwithishaan](https://instagram.com/investingwithishaan)

Made as part of **Hack Club Stardance** 🚀

---

## 📄 License

MIT
