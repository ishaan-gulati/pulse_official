# App Store compliance checklist – avoid rejection

Based on [Apple’s App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), here’s what you need so Simvest/Pulse doesn’t get rejected at submission.

---

## 1. Safety (Guidelines 1.x)

### 1.1 Objectionable content
- [ ] **No offensive/illegal content** – Ensure feed/posts can’t be used for harassment, hate, porn, or illegal content. You already have Report; add moderation (manual or automated) and remove violating content.
- [ ] **No fake/dangerous features** – Your app is a simulator (no real money); don’t claim real trading or real payouts. Descriptions and in-app text should say “simulated” / “virtual” / “practice” where relevant.

### 1.2 User-generated content (Guideline 1.2) – **Required for your app**
Apps with UGC (e.g. posts) must have:

| Requirement | Status | Action |
|-------------|--------|--------|
| **Filter objectionable material** | ⚠️ Partial | Add content moderation: pre-filter (e.g. blocklist) and/or post-report review. Document in Review notes. |
| **Report offensive content** | ✅ Done | You have “Report” on posts. Ensure reports are stored (e.g. Firestore) and you actually review them. |
| **Timely response to concerns** | ❌ | Define process (e.g. respond/act within 24–48 hours) and state it in Support/Privacy or Review notes. |
| **Block abusive users** | ❌ | Add “Block user” (e.g. from profile or post menu) and hide blocked users’ content from the blocker. |
| **Published contact information** | ❌ | Add Support/Contact (email or URL) in app (e.g. Settings / About) and in App Store Connect. |

**Action:** Implement block user, add Support/Contact in app and metadata, and ensure report flow writes to your backend and is reviewed.

### 1.5 Developer / contact information (Guideline 1.5)
- [ ] **Support URL** – In app (e.g. Settings → “Help” or “Contact” opening a URL) and in App Store Connect.
- [ ] **Contact email** – Visible in app (e.g. About/Support) and in App Store Connect so users and App Review can reach you.

### 1.6 Data security (Guideline 1.6)
- [ ] **Secure handling of user data** – Use HTTPS, secure Firebase rules, no plaintext passwords. Avoid logging PII.
- [ ] **API keys** – Don’t ship production secrets in the binary. Use env/build config or backend proxy for sensitive keys.

---

## 2. Performance (Guidelines 2.x)

### 2.1 App completeness (Guideline 2.1)
- [ ] **No placeholders** – Remove or replace “Coming soon”, empty screens, placeholder text. Every screen should do something or be clearly temporary (e.g. “Alerts – coming soon” with no broken flows).
- [ ] **Tested and stable** – Test on a real device; fix crashes and major bugs before submit.
- [ ] **Demo account for App Review** – Provide a working demo account (email + password) in App Store Connect “App Review Information”, or a built-in demo mode. Backend must be **on and reachable** during review.
- [ ] **URLs work** – All in-app links (Privacy, Support, etc.) must resolve; no broken or “example.com” links in production.

### 2.3 Accurate metadata (Guideline 2.3)
- [ ] **Description matches the app** – No claims about features you don’t have (e.g. real-money trading).
- [ ] **Screenshots from the app** – Show real UI (e.g. feed, portfolio, trade), not only logos or marketing art.
- [ ] **Age rating** – Answer the questionnaire honestly (e.g. no gambling, no unrestricted web). For simulated trading + social, often 12+ or 17+ depending on content.
- [ ] **No hidden features** – Don’t hide major functionality from Review; describe non-obvious features in “Notes for Review”.

### 2.4 Hardware / behavior
- [ ] **No excessive battery/heat** – No crypto mining, heavy background work, or constant location in the background unless justified.
- [ ] **No encouraging dangerous use** – Don’t encourage reckless trading in real life; keep framing as “simulation” / “practice”.

---

## 3. Business (Guidelines 3.x)

### 3.1 Payments
- [ ] **Virtual currency** – Your in-app “cash” is simulated and not purchased with real money; no IAP required for that. If you later add **real-money** purchases (e.g. premium features, real tips), use **In-App Purchase** for digital goods/services.
- [ ] **No external paywalls for digital features** – Unlocking app features (e.g. “premium” feed) with payments outside the app is not allowed; use IAP.

---

## 4. Design (Guidelines 4.x)

### 4.1 Copycats
- [ ] **Original experience** – Your concept and UI should be your own; avoid copying another app’s name, icon, or look.

### 4.2 Minimum functionality
- [ ] **More than a web wrapper** – App should feel native (you’re using React Native/Expo), with real functionality (trading sim, feed, portfolio). No “shell” that only opens a website.

### 4.3 Spam
- [ ] **One app, one purpose** – Don’t submit multiple similar apps (e.g. many “Pulse” clones) to game the store.

---

## 5. Legal (Guidelines 5.x) – **Critical**

### 5.1 Privacy (Guideline 5.1) – **Must have**

| Requirement | Status | Action |
|-------------|--------|--------|
| **Privacy policy URL** | ❌ | **Required.** Publish a real policy (hosted URL). Add link in app (e.g. Settings → “Privacy Policy” opens URL) and in App Store Connect. |
| **Policy content** | ❌ | Policy must clearly state: what data you collect, how you collect it, how you use it, who you share it with (e.g. Firebase, analytics), retention/deletion, and how users can delete data or revoke consent. |
| **In-app access** | ⚠️ | Replace the placeholder Alert with a real link (e.g. `Linking.openURL(PRIVACY_POLICY_URL)`). |
| **Account deletion** | ❌ | **Required** (5.1.1(v)). Add “Delete account” in Settings. It must: delete or anonymize user data (Firestore profile, portfolio, posts, etc.) and delete the Firebase Auth account. Document in policy and in Review notes. |
| **Data minimization** | ✅ | Only request data needed for the app (e.g. email for auth, display name). |
| **Permission strings** | N/A | If you add camera/mic/location later, use clear purpose strings and request only when needed. |

**Action:**  
1. Write and host a privacy policy (e.g. GitHub Pages or your site).  
2. Add “Privacy Policy” link in app that opens that URL.  
3. Implement “Delete account” in Settings and backend (Firebase Auth + Firestore).  
4. Add the policy URL in App Store Connect.

### 5.2 Intellectual property
- [ ] **No third-party IP without permission** – No copied logos, brand names, or content you don’t have rights to.
- [ ] **No misleading “Apple” or “App Store” branding** – Don’t imply Apple endorses your app.

### 5.6 Developer code of conduct
- [ ] **No manipulation** – No fake reviews, incentivized ratings, or chart manipulation. Use only Apple’s review prompt API if you ask for ratings.

---

## 6. Before you submit (Apple’s checklist)

- [ ] **Test for crashes and bugs** on a physical device.
- [ ] **Complete, accurate metadata** (name, description, keywords, screenshots, age rating).
- [ ] **Contact info** so App Review can reach you (and so can users).
- [ ] **Full access for review**: demo account **or** demo mode, with backend **on**.
- [ ] **Backend live** during review (Firebase, APIs, etc.).
- [ ] **Notes for Review**: explain non-obvious features (e.g. “Virtual trading only – no real money”), and if you use a demo account, provide credentials there.
- [ ] **No placeholder or “under construction” as main experience** – Either ship working flows or remove/hide incomplete parts.

---

## 7. App-specific summary – Simvest/Pulse

### Must do before first submit
1. **Privacy policy** – Real URL, linked in app and in App Store Connect; content as in 5.1 above.
2. **Account deletion** – “Delete account” in Settings; deletes/anonymizes data and Firebase Auth account.
3. **Support / contact** – Support URL and/or contact email in app (Settings/About) and in App Store Connect.
4. **User-generated content** – Block user + documented report/moderation process; published contact info.
5. **Replace Privacy Policy placeholder** – Open real URL instead of Alert.
6. **Demo account** – Create a test account and add it in App Review Information (or implement demo mode).
7. **Remove or fix placeholders** – No broken or empty main flows (e.g. Alerts/Chats either working or clearly “Coming soon” without breaking the app).

### Should do (reduce rejection risk)
- Move API keys out of the client (env or backend).
- Reduce or guard `console.log` in production (no sensitive data).
- Ensure Report actually creates a record (e.g. in Firestore) and you review it.
- Add “Terms of Service” URL (recommended; link from Settings or policy page).

### App Store Connect
- Fill all required fields (description, keywords, screenshots, age rating, pricing).
- Set Privacy Policy URL and Support URL.
- Provide demo account (or explain demo mode) in App Review notes.
- Export compliance / encryption: answer honestly (e.g. “No” if you don’t use custom encryption for regulated data).

---

## 8. Quick reference – guideline links

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Before You Submit](https://developer.apple.com/app-store/review/guidelines/#before-you-submit) (common rejections)
- [Guideline 1.2 User-Generated Content](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)
- [Guideline 5.1 Privacy](https://developer.apple.com/app-store/review/guidelines/#privacy)

If you implement the **Must do** items and follow the **Before you submit** list, you significantly reduce the chance of rejection. For any gray area (e.g. age rating, financial disclaimers), describe your approach clearly in the Notes for Review.
