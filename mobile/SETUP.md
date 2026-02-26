# The Murderer's Lock - Mobile App Setup

React Native (Expo) app for iOS and Android. Matches desktop aesthetic with neon cyberpunk theme.

## Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- **Expo Go** app on your phone (for quick testing)
- **Xcode** (for iOS simulator) or **Android Studio** (for Android emulator)

## Quick Start

```bash
cd ~/Downloads/"files (93)"/murderers-lock-demo/mobile
npm install
npm start
```

Then:
- **iOS**: Press `i` in terminal or scan QR code with Camera app → opens in Expo Go
- **Android**: Press `a` in terminal or scan QR code with Expo Go app

## Assets (Required)

Create or add these in `mobile/assets/`:

- `icon.png` — 1024×1024 app icon
- `splash.png` — 1284×2778 splash screen
- `adaptive-icon.png` — 1024×1024 (Android)

Or run `npx expo prebuild` and replace placeholders. For quick testing, Expo will use defaults if assets are missing.

## Project Structure

```
mobile/
├── App.js                 # Root component, navigation
├── app.json               # Expo config (bundle ID, permissions)
├── src/
│   ├── theme.js           # Colors, fonts (matches web)
│   ├── api/
│   │   └── vaultApi.js    # Backend API (create, unlock, encrypt)
│   ├── auth/
│   │   └── BiometricAuth.js  # Face ID, Touch ID, fingerprint
│   ├── autofill/          # iOS/Android autofill (see README)
│   └── screens/
│       ├── LoginScreen.js
│       ├── CreateAccountScreen.js
│       ├── DashboardScreen.js
│       ├── VaultScreen.js
│       ├── UnlockScreen.js
│       └── CreateVaultScreen.js
└── assets/
```

## Features

| Feature | Status |
|---------|--------|
| Login / Create account | ✅ |
| Dashboard (vault list) | ✅ |
| Create vault | ✅ |
| Unlock vault | ✅ |
| Biometric (Face ID / Touch ID) | ✅ |
| Vault contents (secrets) | ✅ MVP |
| Sync with web backend | 🔄 API wired, set API_BASE |
| Autofill (iOS/Android) | 📋 Requires native build |

## Backend / Sync

Set your API base URL in `src/api/vaultApi.js`:

```js
const API_BASE = 'https://your-app.vercel.app';  // or http://localhost:54040 for dev
```

The web app runs at `http://localhost:54040` (or whatever port `npm start` picks). For mobile to talk to localhost, use your machine's LAN IP, e.g. `http://192.168.1.222:54040`.

## Build for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build
eas build --platform ios
eas build --platform android
```

## Biometric Permissions

- **iOS**: `NSFaceIDUsageDescription` and `NSBiometricUsageDescription` in app.json
- **Android**: `USE_BIOMETRIC`, `USE_FINGERPRINT` in app.json

These are already configured.
