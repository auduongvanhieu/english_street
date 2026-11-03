# English Street — mobile app (Android & iOS)

`apps/mobile` is a **Flutter shell** around the web game: a full-screen WebView of
https://englishstreet.coffeesos.online plus the native pieces a WebView cannot provide.

```
Flutter app
 ├─ GamePage  (flutter_inappwebview → the web client)
 │    └─ NativeBridge: JS handlers  stt.start/stop/abort · tts.speak/stop · haptic
 │         web ← events: window.__esNativeEvent({type: 'stt.final' | 'tts.end' | 'push.token' …})
 ├─ NotebookPage  (native, works offline: cached /me/vocab)
 └─ SettingsPage  (keep awake, game server URL, privacy, version)
```

Why a shell and not a rewrite: the 3D scene (three.js), Colyseus networking and WebRTC voice are web
technologies with no mature Flutter equivalent. The shell adds what the store rules and iOS need:

| Need | Where |
|---|---|
| Speech recognition on iOS (WKWebView has no Web Speech API) | `speech_to_text` via `stt.*` handlers; the web client prefers the native path when `window.esNative.stt` is true (`apps/web/src/native/bridge.ts`, `voice/stt.ts`) |
| Reliable TTS voices | `flutter_tts` via `tts.*` handlers (`voice/tts.ts`) |
| Microphone for voice chat (WebRTC inside the WebView) | `onPermissionRequest` grants after the OS permission (`permission_handler`) |
| Haptics on incoming talk requests | `haptic` handler → `HapticFeedback` |
| Offline value (App Store guideline 4.2) | native Notebook with cached vocabulary |
| Screen staying on while playing | `wakelock_plus` |
| Push reminders | API `POST /me/push-token` stores device tokens (`PushToken` table); the app forwards tokens through the `push.token` event once Firebase Messaging is added (see below) |

## Build

```bash
cd apps/mobile
flutter pub get
flutter analyze
flutter build apk --release            # build/app/outputs/flutter-apk/app-release.apk
flutter build appbundle --release      # Play Console upload
flutter build ios --release            # on macOS with Xcode + signing
```

Point the app at another server (staging) with `--dart-define=ES_GAME_URL=https://…/` or from the
in-app Settings page. CI: `.github/workflows/mobile.yml` builds the APK/AAB on every push touching
`apps/mobile` (artifact `english-street-android`); the iOS job runs on demand (`workflow_dispatch`) on a macOS runner.

The VPS used for development has Flutter 3.47.9 + JDK 17 + Android SDK under `~/sdk`
(`scratchpad/install-toolchain.sh`); `flutter build apk --release` was verified there.

## Store checklist (not done by the code)

1. **Accounts**: Google Play Console (25 USD once), Apple Developer Program (99 USD/year).
2. **Signing**: Android upload key (`keytool -genkey …`, `android/key.properties`); iOS certificates/profiles in Xcode.
3. **Firebase push** (optional): create a Firebase project, add `google-services.json` / `GoogleService-Info.plist`,
   add `firebase_core` + `firebase_messaging`, call `NativeBridge.emit({'type': 'push.token', 'token': t, 'platform': …})`
   after `FirebaseMessaging.instance.getToken()`. A reminder job (19:00 VN time: streak / daily quest) then reads `PushToken` rows.
4. **Sign in with Apple** is required only if a third-party login (Google) is offered in the app — email/password only is fine.
5. **Privacy**: the app records audio for speech recognition and voice chat and lets strangers chat; keep
   https://englishstreet.coffeesos.online/privacy.html current, fill the Play "Data safety" and App Store "App Privacy" forms,
   rate 12+ (user interaction). Report/block exists in-game (⚑ next to chat lines, Report in the player popup).
6. **Screenshots / listing**: phone screenshots from `docs/screenshots/mobile-*.png` are a starting point.

## Testing on a device

```bash
flutter devices
flutter run -d <device>            # debug build, hot reload
```

Checks: join the street, talk to an NPC with 🎤 (native recogniser), hear the NPC (native TTS), enable
voice chat (mic permission prompt once), receive a talk request (phone vibrates), open the Notebook in
airplane mode.
