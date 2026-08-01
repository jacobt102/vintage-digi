import { useSharedValue } from 'react-native-reanimated';

/**
 * Frame-time instrumentation.
 *
 * There is no Xcode and therefore no Instruments in this project's toolchain, so the app has
 * to measure itself. This is the only performance signal available on device.
 *
 * Design constraints:
 *  - The worklet side must stay allocation-free and must never log. A single console.log per
 *    frame is enough to destroy the frame rate you are trying to measure.
 *  - The UI side samples at a low rate (see FrameStatsOverlay) rather than reacting per frame.
 */
export interface FrameStatsValues {
  /** Milliseconds taken by the most recent frame. */
  lastMs: number;
  /** Exponential moving average of frame time, in ms. */
  emaMs: number;
  /** Total frames rendered since the last reset. */
  count: number;
  /** Frames whose time exceeded the 33.3ms budget for 30fps. */
  overBudget: number;
}

const EMA_ALPHA = 0.1;

/** 30fps budget in milliseconds. Frames slower than this are counted as over budget. */
export const FRAME_BUDGET_MS = 1000 / 30;

export function useFrameStats() {
  return useSharedValue<FrameStatsValues>({
    lastMs: 0,
    emaMs: 0,
    count: 0,
    overBudget: 0,
  });
}

export type FrameStatsShared = ReturnType<typeof useFrameStats>;

/**
 * Record one frame's duration. Call from inside the onFrame worklet.
 *
 * Writes a fresh object rather than mutating in place: Reanimated shared values only
 * propagate on assignment, and mutating the existing object would not notify the UI side.
 */
export function recordFrame(stats: FrameStatsShared, durationMs: number): void {
  'worklet';
  const prev = stats.value;
  const ema =
    prev.count === 0 ? durationMs : prev.emaMs * (1 - EMA_ALPHA) + durationMs * EMA_ALPHA;

  stats.value = {
    lastMs: durationMs,
    emaMs: ema,
    count: prev.count + 1,
    overBudget: prev.overBudget + (durationMs > FRAME_BUDGET_MS ? 1 : 0),
  };
}

export function resetFrameStats(stats: FrameStatsShared): void {
  stats.value = { lastMs: 0, emaMs: 0, count: 0, overBudget: 0 };
}

/** Convert an EMA frame time to effective fps, clamped for display. */
export function emaToFps(emaMs: number): number {
  if (emaMs <= 0) return 0;
  return Math.min(999, 1000 / emaMs);
}
