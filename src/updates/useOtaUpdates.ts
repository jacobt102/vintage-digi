import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * A pending update is applied right away only if it finished downloading within this long
 * of the app opening or coming back to the foreground. Later than that, the person may be
 * framing or saving a shot, so it waits for the next time the app comes to the foreground.
 */
const APPLY_GRACE_MS = 8_000;

/** Don't hit the update server every time the app is briefly backgrounded. */
const FOREGROUND_CHECK_INTERVAL_MS = 10 * 60_000;

/**
 * Keeps the installed app on the latest over-the-air (EAS Update) JS bundle.
 *
 * expo-updates already checks and downloads on cold launch (`checkAutomatically: ON_LOAD`),
 * but by default only *applies* the download on the following launch. This hook applies it
 * straight away instead, and also checks when the app returns from the background, since
 * iOS rarely cold-launches an app that is used every day.
 *
 * No-op in development and in builds made without EAS_PROJECT_ID (Updates.isEnabled false).
 */
export function useOtaUpdates(): void {
  const { isUpdatePending } = Updates.useUpdates();
  const pendingRef = useRef(false);
  const activeSinceRef = useRef(Date.now());
  const lastCheckRef = useRef(Date.now()); // the native ON_LOAD check covers launch

  useEffect(() => {
    pendingRef.current = isUpdatePending;
    if (!Updates.isEnabled || !isUpdatePending) return;
    if (Date.now() - activeSinceRef.current < APPLY_GRACE_MS) {
      void Updates.reloadAsync().catch(() => {});
    }
  }, [isUpdatePending]);

  useEffect(() => {
    if (!Updates.isEnabled) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      activeSinceRef.current = Date.now();

      if (pendingRef.current) {
        void Updates.reloadAsync().catch(() => {});
        return;
      }
      if (Date.now() - lastCheckRef.current < FOREGROUND_CHECK_INTERVAL_MS) return;
      lastCheckRef.current = Date.now();
      void checkAndFetch();
    });
    return () => sub.remove();
  }, []);
}

async function checkAndFetch(): Promise<void> {
  try {
    const result = await Updates.checkForUpdateAsync();
    // Resolving the fetch flips useUpdates().isUpdatePending, which applies it above.
    if (result.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // Offline or server unreachable: keep running what we have. Never surface this.
  }
}

/** Short label for the debug overlay so a screenshot shows which JS bundle is running. */
export function currentBundleLabel(): string {
  if (!Updates.isEnabled) return 'DEV/NO-OTA';
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return 'EMBEDDED';
  const id = Updates.updateId.slice(0, 8);
  const when = Updates.createdAt;
  if (!when) return `OTA ${id}`;
  const mm = String(when.getMonth() + 1).padStart(2, '0');
  const dd = String(when.getDate()).padStart(2, '0');
  return `OTA ${id} ${mm}/${dd}`;
}
