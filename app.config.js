// Layers over-the-air update settings on top of app.json.
//
// The EAS project ID comes from the EAS_PROJECT_ID environment variable (a GitHub
// repository *variable* in CI) instead of being hard-coded, so nothing in this repo has to
// be edited to connect it to an Expo account. Without it — e.g. a plain local
// `npx expo run:android` — updates are simply disabled and the app runs its embedded bundle.
//
// Do NOT put build numbers or anything else that changes per build in here. The runtime
// version is a fingerprint of this resolved config (plus native deps), so a value that
// differs between the iOS build job and the `eas update` job would make every update target
// a runtime no installed app has. Per-build version numbers are stamped into Info.plist by
// the build workflow instead, which the fingerprint ignores (ios/ is gitignored).

module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID?.trim();

  if (!projectId) {
    return {
      ...config,
      updates: { enabled: false },
    };
  }

  return {
    ...config,
    // Fingerprint policy: the runtime version changes automatically whenever native code or
    // native config changes, so an update can never be delivered to a binary it would crash.
    runtimeVersion: { policy: 'fingerprint' },
    updates: {
      enabled: true,
      url: `https://u.expo.dev/${projectId}`,
      // Builds are made on GitHub Actions, not EAS Build, so the channel is set here rather
      // than in eas.json. `eas update --channel production` publishes to it.
      requestHeaders: { 'expo-channel-name': 'production' },
      checkAutomatically: 'ON_LOAD',
      // Launch immediately with whatever is cached; src/updates/useOtaUpdates.ts applies a
      // freshly downloaded update a moment later.
      fallbackToCacheTimeout: 0,
    },
    extra: {
      ...config.extra,
      eas: { ...config.extra?.eas, projectId },
    },
  };
};
