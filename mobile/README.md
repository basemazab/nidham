# Nidham Mobile · تطبيق نِظام للموظفين

React Native + Expo client for Nidham. Targets Android + iPhone with one
codebase. Talks to the **same** Supabase the Cloud (Vercel) and Enterprise
(Docker) deployments use — every request goes through the standard
PostgREST / GoTrue endpoints and is gated by the same RLS the web app
relies on. No service-role key, no separate backend.

## Project layout

```
mobile/
├── app.json                      Expo config (name, icon, splash, perms)
├── app/                          expo-router routes (file = screen)
│   ├── _layout.tsx               root: SafeArea + AuthProvider + RTL setup
│   ├── index.tsx                 splash gate: redirect by session
│   ├── (auth)/login.tsx          email + password
│   ├── (auth)/claim.tsx          invite-token signup
│   └── (employee)/index.tsx      home (Phase 2 stub)
├── src/
│   ├── lib/
│   │   ├── theme.ts              brand colors / spacing / type scale
│   │   ├── supabase.ts           Supabase client (SecureStore-backed)
│   │   └── auth.tsx              <AuthProvider> + useAuth() hook
│   └── components/
│       ├── Brand.tsx             logo + product mark
│       ├── Input.tsx             labelled RTL text input
│       └── Button.tsx            primary / secondary / ghost buttons
└── assets/                       icon.png, adaptive-icon.png, splash-icon.png
```

## First-time setup (Windows / macOS / Linux)

```bash
cd mobile
npm install        # ~3 min, pulls Expo + RN
```

## Run it on your phone (Expo Go — the fast path)

1. Install **Expo Go** from the Play Store or App Store.
2. Make sure your phone and the dev computer are on the **same Wi-Fi**.
3. In the repo:
   ```bash
   cd mobile
   npm start
   ```
4. Expo prints a QR code in the terminal.
5. **Android**: open Expo Go → scan the QR.
   **iPhone**: open the system Camera app → scan the QR → tap the banner.

The app boots in Expo Go in a few seconds. Hot reload picks up any file
you save in `app/` or `src/`.

## Run on an emulator

If you have Android Studio's emulator running:
```bash
npm run android
```
If you have Xcode + iOS Simulator on macOS:
```bash
npm run ios
```

## What works in Phase 2

- ✅ Login with email + password (uses the same accounts as the web app)
- ✅ Claim an HR-issued invitation token → creates the auth user, links
  it to the `employees` row, sets the `employees` profile role
- ✅ Session persists across app restarts (expo-secure-store / Keychain
  on iOS, Keystore on Android)
- ✅ Logout
- ✅ Arabic RTL throughout
- ✅ Splash screen + branded icon

## What's NEXT (Phase 3)

- GPS clock-in / clock-out via the `mobile_clock_in` / `mobile_clock_out`
  RPCs we shipped in migration 015
- Today's attendance status
- Office geofence indicator

## What's NEXT (Phase 4)

- Leave / advance / permission request forms
- Push notifications when HR approves or rejects

## Building a production APK / IPA (Phase 5)

This will use Expo Application Services (EAS Build) so we don't need a
Mac to build for iOS. Setup happens later — for now `npm start` + Expo
Go covers all development.
