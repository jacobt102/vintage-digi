# Vintage Digi

A local-only vintage/nostalgic camera app for iPhone. No backend, no accounts. The only network
traffic is the app checking Expo's update server for new JS bundles (EAS Update); photos never
leave the device.

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
| OTA updates | `expo-updates` 57.0.27 (EAS Update, fingerprint runtime) |
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

## Getting it on your iPhone (SideStore + EAS Update)

No Mac, no paid Apple account, and no computer after the one-time setup.
**Step-by-step setup: [docs/IPHONE_SETUP.md](docs/IPHONE_SETUP.md).**

| You change… | What happens | What you do |
|---|---|---|
| JS/TS only (shader, UI, capture logic) | `ota-update.yml` publishes to EAS Update on push to `main` | Nothing. The app picks it up the next time it opens or returns to the foreground |
| Native code (native module added/upgraded, native config in `app.json`, SDK bump) | `ota-update.yml` sees the runtime fingerprint changed and dispatches `ios-build.yml`, which publishes a GitHub Release + SideStore source | Tap **Update** in SideStore when the build finishes (~20–30 min) |
| Nothing — it's been a week | The free-Apple-ID signature is about to expire | Open SideStore → **Refresh All** (no rebuild) |

The overlay's `JS` row shows which bundle is running: `EMBEDDED` (what shipped in the IPA)
or `OTA <id> <date>` (an over-the-air update).

### How the pieces fit

- **`app.config.js`** layers the update settings over `app.json`. The EAS project ID comes from
  the `EAS_PROJECT_ID` repository variable, so no file needs editing. Without it, OTA is
  disabled and the app just runs its embedded bundle.
- **Runtime version = fingerprint.** `expo-updates` hashes the native-relevant inputs
  (dependencies, config plugins, native config). An update is only delivered to a build with
  the same hash, so a JS update can never land on a binary missing a native module it needs.
  Never put per-build values (build numbers, dates) in app config; they would change the
  hash. `ios-build.yml` stamps version numbers into `Info.plist` after prebuild instead.
- **`ios-build.yml`** (macOS runner) builds an unsigned IPA, pins the embedded fingerprint
  with `EXPO_UPDATES_FINGERPRINT_OVERRIDE`, and publishes release `ios-build-<run>` with
  `VintageDigi.ipa`, `source.json` and `runtime-version.txt`. The version is
  `<app.json major.minor>.<run number>`, so every build is a new version for SideStore.
- **`ota-update.yml`** (Linux runner) runs `eas update --channel production` on every push
  to `main`, compares the fingerprint with the latest release's `runtime-version.txt`, and
  dispatches a native rebuild if they differ (including the very first time).
- **`src/updates/useOtaUpdates.ts`** applies a downloaded update immediately if it arrives
  within a few seconds of launch/foreground; otherwise it waits for the next foreground, so
  it never reloads while you're framing a shot.
- **SideStore source URL** (add once in SideStore):
  `https://github.com/jacobt102/vintage-digi/releases/latest/download/source.json`

### Keep this repository public

Two reasons: macOS runners bill at a **~10× minute multiplier** on private repos (GitHub Free
is only ~200 effective macOS minutes/month), while public repos get unlimited minutes; and
SideStore downloads the source and IPA anonymously, which fails for private releases.

### Free Apple ID constraints

- The app signature lasts **7 days**. Refresh in SideStore before it lapses; refreshing
  re-signs, it does not rebuild. If it lapses, the app won't open until you refresh (photos
  you saved are in Photos and are unaffected).
- **3 active sideloaded apps** per Apple ID, and SideStore itself uses one.
- **10 App IDs per 7 days.** Each distinct app you install uses one; updating the same app
  does not.
- SideStore rewrites the bundle ID when signing; keep `ios.bundleIdentifier` in `app.json`
  stable. It doesn't affect OTA updates.

---

## Layout

```
src/
├── shaders/vintageGrade.sksl.ts   SkSL source, standalone (ports to Metal mechanically)
├── capture/
│   ├── gradeShader.ts             compiled RuntimeEffect, shared by preview + capture
│   └── captureGraded.ts           capture → offscreen render → PNG → Photos
├── camera/CameraScreen.tsx        SkiaCamera preview, shutter, grade toggle
├── perf/
│   ├── FrameStats.ts              worklet-side frame timing
│   └── FrameStatsOverlay.tsx      on-screen readout, sampled at 2Hz
└── updates/useOtaUpdates.ts       applies EAS updates on launch / foreground
app.config.js                      OTA config layered over app.json (reads EAS_PROJECT_ID)
eas.json                           minimal EAS CLI config (channel: production)
scripts/make-sidestore-source.mjs  writes the SideStore source.json for each build
.github/workflows/
├── ios-build.yml                  native build → GitHub Release + SideStore source
└── ota-update.yml                 push to main → EAS Update (+ rebuild if native changed)
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
