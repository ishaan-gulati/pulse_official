# Pulse - Social Mock Trading App

A mobile-first, social mock trading app designed for teens and Gen Z users who want to engage with investing in a fun, risk-free environment.

## Features

- **Virtual Trading**: Start with $10,000 virtual cash
- **Real-time Stock Data**: Trade with current market prices
- **Social Feed**: Share trades, strategies, and updates
- **Leaderboard System**: Compete in weekly/monthly seasons
- **Practice Mode**: Unlimited resets for learning
- **Modern UI**: Beautiful, mobile-first design

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Firebase (Authentication, Firestore)
- **Stock Data**: Alpha Vantage API
- **UI Components**: React Native Elements, Expo Vector Icons

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development) or Android Studio (for Android development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pulse
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Firebase Setup**
   
   You need to set up a Firebase project:
   
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Get your Firebase config

4. **Configure Firebase**
   
   Update `src/config/firebase.ts` with your Firebase credentials:
   ```typescript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "your-sender-id",
     appId: "your-app-id"
   };
   ```

5. **Run the app**
   ```bash
   # Start the development server
   npm start
   
   # Run on iOS
   npm run ios
   
   # Run on Android
   npm run android
   
   # Run on web
   npm run web
   ```

## Project Structure

```
pulse/
├── src/
│   ├── config/
│   │   └── firebase.ts          # Firebase configuration
│   ├── contexts/
│   │   └── AuthContext.tsx      # Authentication context
│   └── screens/
│       ├── LoginScreen.tsx      # Login/Signup screen
│       └── HomeScreen.tsx       # Main home screen
├── App.tsx                      # Main app component
└── package.json
```

## Current Features

### Authentication
- Email/password sign up and sign in
- Persistent authentication state
- Loading states and error handling
- Modern, mobile-first UI design

### UI Components
- Beautiful login screen with form validation
- Home screen with feature cards
- Responsive design for different screen sizes
- Icon integration with Expo Vector Icons

## Next Steps

The following features are planned for implementation:

1. **Stock Trading Interface**
   - Real-time stock search
   - Buy/sell functionality
   - Portfolio management

2. **Social Features**
   - Post creation and sharing
   - Emoji reactions (fire, W, L)
   - User profiles

3. **Leaderboard System**
   - Seasonal competitions
   - Portfolio tracking
   - Rankings

4. **Practice Mode**
   - Unlimited portfolio resets
   - Learning tools

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, email support@simvest.com or create an issue in the repository. 