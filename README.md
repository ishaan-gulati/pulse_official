# Pulse — Social Paper Trading

**Gamified investing, made social.**

Pulse is a mobile app for paper trading with virtual money, live market data, leaderboards, and a social feed — learn how markets work without risking real cash.

[![App Store](https://img.shields.io/badge/App_Store-Download-blue?logo=apple)](https://apps.apple.com/us/app/pulse-social-paper-trading/id6760734269)

---

## Highlights

- **Paper trade** with a $10,000 virtual portfolio and live quotes
- **Leaderboard** ranked by portfolio return
- **Social feed** — post ideas, tag tickers, follow friends, join groups
- **Portfolio analytics** — P/L, charts, price alerts, and AI stock summaries
- **XP & achievements** — level up as you trade and hit milestones
- **Referrals** — invite friends for bonus virtual cash

---

## Tech stack

| Layer | Tech |
|-------|------|
| App | React Native, Expo SDK 54, TypeScript |
| Backend | Firebase Auth, Cloud Firestore, Cloud Functions |
| Market data | Yahoo Finance (quotes), Finnhub / Alpha Vantage / FMP (optional) |
| AI | Groq (optional) |
| Release | EAS Build → App Store |

---

## Getting started

The app lives in **`simvest/`**. See **[simvest/README.md](./simvest/README.md)** for full setup: environment variables, Firebase config, Firestore rules, admin scripts, and project structure.

Quick start:

```bash
git clone https://github.com/ishaan-gulati/pulse_official.git
cd pulse_official/simvest
cp .env.example .env   # fill in Firebase + optional API keys
npm install
npm start
```

---

## About

Built by **Ishaan Gulati**.

- App: [App Store](https://apps.apple.com/us/app/pulse-social-paper-trading/id6760734269)
- Instagram: [@investingwithishaan](https://instagram.com/investingwithishaan)

---

## License

MIT
