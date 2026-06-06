# App Review – What Else to Do

Based on your codebase and IMPROVEMENTS.md, here’s a prioritized list of what to do before and after launch.

---

## Critical (Do First – Launch Blockers)

### 1. Logout / Settings
- **Issue:** AuthContext has logout, but Profile has no Log out (or Settings). Users can’t sign out.
- **Do:** Add a **Log out** button on Profile (and ideally a simple **Settings** screen with Log out; later: notifications, theme, account).
- **Rough effort:** 1–2 hours.

### 2. Alerts / Notifications Tab ✅ DONE
- **Issue:** Alerts tab exists in nav flow but NotificationsScreen is a placeholder (“Alerts page - to be rebuilt”).
- **Done:** Built minimal Alerts screen (Option A): “Alerts” header with back button, **Price alerts** section (empty state + “Add price alert” → “Coming soon” alert), **Push notifications** card (“Coming soon – alerts, achievements, and comments”). Back button returns to Home.
- **Rough effort:** 2–4 hours for a minimal screen; ~1 hour to hide it.

### 3. Firebase Auth Persistence
- **Issue:** Console warns: “Auth state will default to memory persistence” (no AsyncStorage).
- **Do:** Use `initializeAuth` with `getReactNativePersistence(ReactNativeAsyncStorage)` so login survives app restarts. You already have AsyncStorage in the project.
- **Rough effort:** ~30 minutes.

### 4. Privacy Policy
- **Issue:** App Store (and good practice) expect a privacy policy URL.
- **Do:** Add a short privacy policy (what you collect, how you use it, Firebase/analytics). Host it (e.g. GitHub Pages, your site) and link from Profile or Settings.
- **Rough effort:** 1–2 hours.

---

## High Priority (Soon After)

### 5. Edit Profile
- **Issue:** Users can’t change display name, username, or photo.
- **Do:** Add “Edit profile” from Profile → edit display name, username (with uniqueness check), and optionally photo (e.g. Firebase Storage or a URL).
- **Rough effort:** 1–2 days.

### 6. Watchlist / Favorites
- **Issue:** No way to save favorite symbols for quick access.
- **Do:** “Add to watchlist” on Trade screen, persist in Firestore (e.g. `users/{uid}/watchlist`), and a Watchlist section on Trade (and maybe Portfolio).
- **Rough effort:** ~2 days.

### 7. Feed Infinite Scroll
- **Issue:** `hasMore` is set to false; feed is effectively capped (e.g. 20 posts).
- **Do:** Enable cursor-based pagination (e.g. `startAfter` with last doc), use `FlatList` `onEndReached`, and set `hasMore` from “there are more docs”.
- **Rough effort:** ~4 hours.

### 8. Comments
- **Issue:** Comment count exists; tapping comments shows “Coming soon”.
- **Do:** Add a comments subcollection per post, comment UI on PostDetail (and optionally on FeedCard), and update counts.
- **Rough effort:** 2–3 days.

### 9. User Profile from Feed
- **Issue:** Can’t tap username/avatar to see another user’s profile.
- **Do:** Make avatar/username pressable → navigate to a “User profile” screen (read-only: stats, portfolio value, recent posts). Reuse leaderboard “view user” if you have it.
- **Rough effort:** ~1 day.

---

## Medium Priority (Polish and Trust)

### 10. Portfolio Performance Chart
- **Status:** PortfolioPerformanceChart is implemented and used in the Performance tab. If it’s not visible or looks like a placeholder in the UI, fix that; otherwise this is done.

### 11. Error Handling and Retry
- **Issue:** Many failures only show an alert; no retry or “last updated” for market data.
- **Do:** Add retry buttons for failed loads; “Last updated at …” for prices; optional global “Offline” / “Connection lost” banner.

### 12. Loading States
- **Issue:** Mostly spinners.
- **Do:** Add skeleton loaders for feed, portfolio, and leaderboard so the app feels faster and more polished.

### 13. Code / Config Hygiene
- **Do:** Move API keys to env (e.g. `EXPO_PUBLIC_*`) and don’t commit secrets; reduce or guard `console.log` in production; ensure apiKeys/config are only used in a way that doesn’t leak keys in the client.

### 14. Leaderboard Time Periods
- **Issue:** Leaderboard is effectively “all time” only.
- **Do:** Add filters: **Today** / **This week** / **This month** / **All time** (store or compute portfolio value over time or snapshots if needed).

---

## Lower Priority (Later)

- Push notifications (price alerts, achievements, comments).
- Offline mode (cache portfolio/positions, queue trades).
- Chart upgrades (more timeframes, volume, simple indicators).
- Dark/light theme and accessibility (labels, contrast, touch targets).
- Export (e.g. trading history CSV).

---

## Suggested Order (Next 1–2 Weeks)

| Order | Task | Why |
|-------|------|-----|
| 1 | Logout button (+ Settings) | Required for a shippable app. |
| 2 | Firebase Auth + AsyncStorage | Stops session loss on restart. |
| 3 | Alerts: minimal screen or hide | No dead “to be rebuilt” screen. |
| 4 | Privacy policy + link | Needed for store and trust. |
| 5 | Edit profile | Basic user expectation. |
| 6 | Feed pagination | Quick win, better feed UX. |
| 7 | Watchlist | Core trading UX. |
| 8 | Comments or profile-from-feed | Pick one for v1.1. |

---

## Summary

- **Must fix for launch:** Logout (and ideally Settings), Auth persistence, Alerts (or remove from nav), and a privacy policy.
- **Strong next steps:** Edit profile, watchlist, feed pagination, then comments or clickable profiles.

If you have a target (e.g. “App Store in 1 week” vs “polish for 2 weeks”), this can be turned into a concrete task list with file names and small steps, or you can implement the critical items first (logout, Auth persistence, Alerts decision).
