# Stampd

Your onchain loyalty passport, built for Seeker.

Stampd is an Android-first Expo and React Native app. This initial milestone contains only the
stable application shell and the branded landing screen. Wallet connection, QR scanning, Solana
transactions, Seeker Genesis Token verification, and SKR rewards are intentionally not implemented.

## Prerequisites

- A supported Node.js LTS release
- Android Studio with an Android SDK, platform tools, and an emulator (or a physical Android device)
- A Java Development Kit compatible with the installed Android Gradle plugin

Run the Solana Mobile environment check after installing the Android tools:

```bash
npx --yes solana-mobile@latest doctor
```

## Run the app

The first Android launch creates the native project and installs the custom development client:

```bash
npm run android
```

For later launches, start the Expo development server:

```bash
npm run dev
```

Mobile Wallet Adapter uses native Android modules, so wallet work will use this custom development
build rather than Expo Go when it is added in a later phase.

## Project layout

```text
app/                  Expo Router screens and navigation
src/features/         Boundaries for future product modules
src/theme/            Shared visual tokens
assets/images/        App icon and splash assets
app.json              Expo and Android application configuration
index.js              Expo Router entry point
```

## Quality checks

```bash
npm run check
npm run doctor
npm run android:prebuild
```

The generated `android/` directory is intentionally ignored. Expo can regenerate it from `app.json`
and the installed native packages.
