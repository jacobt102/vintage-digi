# Vintage Digi

A local-only vintage/nostalgic camera app for iPhone. No backend, no accounts, no network calls.

**Current state: Phase 1 spike (go/no-go).** The app is a single camera screen with one
hardcoded grade, a frame-time readout, and a capture button that saves a graded still to
Photos. The look system, night vision, video, and editor are not built yet.

---

## Stack

| Area | Choice |
|---|---|
| Framework | Expo SDK 57 (RN 0.86.2, React 19.2.3), New Architecture |
| Camera | `react-native-vision-camera` **5.2.1** |
| Real-time render | `react-native-vision-camera-skia` 5.2.1 + `@shopify/react-native-skia` 2.10.1 |
| Worklets | `react-native-worklets` 0.11.3 + `react-native-reanimated` 4.5.3 |
| Photos | `expo-media-library` 57.0.3 |
| Min target | iOS 17 |

All versions are pinned exactly (no `^`). `react-native-vision-camera-skia` is young — 28
published versions — and moves fast, so the lockfile is committed deliberately.

> **VisionCamera v5 is a Nitro Modules rewrite and a hard break from v4.** Almost every
> tutorial online is v4 and will not work. Trust the bundled `.d.ts` docblocks over the web.
> Notably: `capturePhoto()` takes **two** required arguments, photo/video outputs come from
> `usePhotoOutput()` / `useVideoOutput()` rather than boolean props, and `constraints`
> replaces `useCameraFormat`.

---

## Developing on Windows

There is no Mac in this workflow, so there is no Xcode, no iOS Simulator, and no Instruments.

**Android is the fast lane.** Everything that is not iOS-camera-specific — the shader math, the
grade correctness, the offscreen render, saving to the media library — iterates locally in
seconds on an Android emulator or device:

```bash
npm install
npx expo run:android      # requires Android Studio + a device/emulator
```

Verify on Android first, then spend an iOS build. **Emulator frame rate is not a valid
performance signal** — it proves correctness only. Real fps and thermals require the iPhone.

Useful checks that need no device at all:

```bash
npm run typecheck              # tsc against the real v5 typings
npx expo export --platform android --output-dir /tmp/exporttest   # proves the bundle resolves
```

---

## Building for iOS

`.github/workflows/ios-build.yml` builds an **unsigned** `.ipa` on a GitHub-hosted macOS runner.

It is `workflow_dispatch` only — deliberately not on push, so a stray commit cannot burn a
build. Trigger it from the Actions tab, download the `VintageDigi-unsigned-ipa` artifact, then
install with [Sideloadly](https://sideloadly.io) or [AltStore](https://altstore.io) over USB
using a free Apple ID.

### Keep this repository public

macOS runners bill at a **~10× minute multiplier**. GitHub Free's 2,000 minutes/month is only
about **200 effective macOS minutes** on a private repo — roughly **8–20 builds/month**, which
Phase 0 alone can consume on CocoaPods and signing failures. **Public repositories get
unlimited Actions minutes.** If this must stay private, use Codemagic's free tier (500 min/mo,
no multiplier) instead.

### Free Apple ID constraints

- App expires after **7 days** — re-run Sideloadly to re-sign. No rebuild needed, so this
  costs zero CI minutes.
- **3 sideloaded apps** maximum per Apple ID.
- Sideloadly rewrites the bundle ID; keep `ios.bundleIdentifier` in `app.json` stable and
  reverse-DNS.
- First launch: Settings → General → VPN & Device Management → trust the developer cert.

A $99/yr paid account removes the 7-day expiry and unlocks TestFlight. Nothing else changes.

---

## Layout

```
src/
├── shaders/vintageGrade.sksl.ts   SkSL source, standalone (ports to Metal mechanically)
├── capture/
│   ├── gradeShader.ts             compiled RuntimeEffect, shared by preview + capture
│   └── captureGraded.ts           capture → offscreen render → PNG → Photos
├── camera/CameraScreen.tsx        SkiaCamera preview, shutter, grade toggle
└── perf/
    ├── FrameStats.ts              worklet-side frame timing
    └── FrameStatsOverlay.tsx      on-screen readout, sampled at 2Hz
```

**One shader, two call sites.** `gradeShader.ts` compiles the effect once at module scope; both
the live preview and the still capture render through it. VisionCamera's photo output captures
the sensor image rather than what Skia drew, so the grade has to be re-applied on capture —
sharing the compiled effect is what guarantees the saved file matches the viewfinder.

### Performance rules

These are not stylistic preferences; violating them causes measurable frame-rate collapse.

- Cache `RuntimeEffect` and `Paint` **outside** `onFrame`. Recompiling per frame destroys
  performance.
- Call `frame.dispose()` on **every** frame or the camera's buffer pool starves and stalls.
- Dispose `SkImage` / `SkSurface` explicitly — they are native allocations the JS GC does not
  manage. Leaks appear as gradual fps decay, not crashes.
- Never log or touch the filesystem inside a frame processor.

---

## Phase 1 exit criteria (go/no-go)

Run on the **physical iPhone**:

1. Live preview shows the grade applied in real time.
2. Overlay reads **≥30fps sustained for 60s** with `GRADE ON`, without thermal throttling.
   Use the GRADE ON/OFF toggle — the delta is the real signal, separating "shader too
   expensive" from "pipeline too slow".
3. Shutter saves to Photos and the file **visibly carries the grade** when opened in the iOS
   Photos app. Compare against a `GRADE OFF` capture of the same scene.
4. ~500+ frames with no downward fps drift (drift indicates a `Frame`/`SkImage` leak).

Steps 1 and 3 can be checked on Android first for correctness. **If 2 or 3 fails, stop and
reconsider the stack before building on top.**

---

## Gotchas already hit

- **`disableHierarchicalLookup` in `metro.config.js` breaks the build.** It blocks nested
  `node_modules`, which npm uses for ~32 transitive deps (`expo-modules-core` under `expo`,
  etc.). `nodeModulesPaths` + `watchFolders` give the needed isolation. See the comment in
  that file.
- **`babel-preset-expo` must be a direct dependency.** The blank template does not include it
  and Babel cannot resolve it from a nested location.
- **VisionCamera ships no Expo config plugin.** Listing it in `plugins` crashes `prebuild`;
  permissions go in `ios.infoPlist` directly.
- **`MediaLibrary.saveToLibraryAsync` / `createAssetAsync` throw at runtime in SDK 57.** They
  are legacy shims. Use `Asset.create(uri)`.
- **`expo-file-system` uses the `File`/`Paths` object API in SDK 57**, not
  `writeAsStringAsync`.
