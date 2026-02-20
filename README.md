# Recipe Organizer — Mobile App

Production-grade, offline-first recipe organizer built with Expo + React Native + TypeScript.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo ~52 + expo-router |
| Language | TypeScript (strict) |
| State | Zustand |
| Local DB | SQLite via expo-sqlite |
| Styling | NativeWind (Tailwind) |
| Animations | React Native Reanimated |
| Backend | Supabase |
| OCR | ML Kit (on-device) + Tesseract Edge Function fallback |
| Lists | @shopify/flash-list |

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI (optional, for builds): `npm install -g eas-cli`
- iOS Simulator or Android Emulator, or Expo Go

## Setup

### 1. Clone and install

```bash
git clone <repo-url> recipe-organizer-mobile
cd recipe-organizer-mobile
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Or update `app.json` → `extra.supabaseUrl` and `extra.supabaseAnonKey`.

### 3. Install ML Kit (OCR — native only)

```bash
npx expo install @react-native-ml-kit/text-recognition
```

> ML Kit requires a custom development client (not compatible with Expo Go).

### 4. Start development

```bash
# Standard Expo Go (no ML Kit OCR)
npm start

# With native ML Kit OCR
npx expo run:ios
npx expo run:android

# Web
npm run web
```

### 5. Scan QR code

After running `npm start`, the Expo CLI will print a QR code in your terminal.
Scan it with the Expo Go app (iOS/Android) to open on device.

To generate a shareable QR code PNG:

```bash
node scripts/generate-qr.js
```

This creates `qr-code.png` in the project root.

## Project Structure

```
app/                    expo-router screens
  (tabs)/               bottom tab screens
  auth/                 login, callback
  recipe/               detail, new, edit
  ocr/                  review screen
  group/                group detail, new
components/
  RecipeCard.tsx
  ui/SkeletonCard.tsx
features/
  auth/authStore.ts
  recipes/recipeStore.ts
  groups/groupStore.ts
services/
  ocrService.ts         on-device + server OCR
  parsingService.ts     rule-based recipe parser
  syncService.ts        offline-first sync queue
  supabaseClient.ts
  imageService.ts
db/
  schema.ts             SQLite table definitions
  client.ts             DB singleton
  migrations/           migration runner
  repositories/         data access layer
types/index.ts          all domain types
tests/
  unit/                 Jest unit tests
```

## Key Features

- **Offline-first**: all data stored in SQLite, synced to Supabase in background
- **OCR**: capture recipe from photo → parse with rule-based engine (no AI tokens)
- **Groups**: share recipes with family/friends, strict or collaborative editing
- **Cooking Mode**: large text, screen-awake, ingredient checklist
- **Accessibility**: 44px touch targets, screen reader labels, dynamic fonts

## Running Tests

```bash
npm test
npm run test:ci
```

## Build for Production

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android

# Web
npx expo export --platform web
```

## Deep Linking

The app registers the `recipeorganizer://` scheme.

| Route | URL |
|-------|-----|
| Login | `recipeorganizer://auth/login` |
| Recipe detail | `recipeorganizer://recipe/:id` |
| Group | `recipeorganizer://group/:id` |
| Auth callback | `recipeorganizer://auth/callback` |
