# APK Build

## What changed
- Added Capacitor Android packaging.
- Added a static catalog path for APK export.
- Added a GitHub-backed catalog sync that runs once daily after 8am.
- Added a manual catalog sync button in the navbar.
- Replaced Android launcher icons with AniMythRo torii logo.
- Updated Android launcher icons from `logoapk.png`.
- Removed outer white background from launcher logo.
- Installed APK on connected Nubia device.
- Added VPN Settings shortcut for Android APK.

## Why it changed
- APK cannot run Next API routes locally.
- APK needs a bundled catalog plus a way to refresh from the GitHub catalog snapshots.

## Files edited
- package.json
- package-lock.json
- capacitor.config.ts
- next.config.js
- app/layout.tsx
- app/page.tsx
- app/browse/page.tsx
- app/watchlist/page.tsx
- app/anime/[id]/page.tsx
- app/anime/[id]/AnimeDetailClient.tsx
- components/providers/AppProvider.tsx
- components/ui/ContinueWatching.tsx
- components/ui/Navbar.tsx
- lib/static-catalog.ts
- lib/catalog-sync.ts
- scripts/build-apk-web.mjs
- capacitor.config.ts
- android/
- android/app/src/main/res/mipmap-*/ic_launcher*.png
- android/app/src/main/res/drawable-nodpi/animythro_launcher_clean.png
- android/app/src/main/res/values/ic_launcher_background.xml
- android/app/src/main/java/com/animythro/app/VpnSettingsPlugin.java
- android/app/src/main/java/com/animythro/app/MainActivity.java
- lib/vpn-settings.ts

## How it was tested
- `npm run build:apk-web`
- `npx cap sync android`
- `android/gradlew.bat assembleDebug`
- Static desktop browser check: home content, manual sync, console errors.
- Static mobile browser check: menu, sync entry, overflow, console errors.
- Static detail route check: `/anime/hunter-x-hunter`.
- Android debug APK rebuilt.
- APK installed with `adb install -r`.
- Updated APK reinstalled after logo change.
- Updated APK rebuilt/reinstalled after VPN shortcut.
- Package verified with `pm path`, launcher activity, and running process.

## Follow-ups or known issues
- Daily sync runs when the app is opened or brought foreground after 8am.
- Built APK is a debug APK.
- Installed device: Z2570N / Nubia Neo 5G.
- VPN shortcut opens Android VPN settings; Android/user handles actual on/off.
- Offline video downloads were not added because official YouTube embeds cannot be downloaded by this app.
