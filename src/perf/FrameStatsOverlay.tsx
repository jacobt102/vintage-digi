import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  emaToFps,
  FRAME_BUDGET_MS,
  type FrameStatsShared,
  type FrameStatsValues,
} from './FrameStats';
import { currentBundleLabel } from '../updates/useOtaUpdates';

// Constant for the life of the JS runtime: an update only takes effect via a reload.
const BUNDLE_LABEL = currentBundleLabel();

const SAMPLE_INTERVAL_MS = 500;

interface Props {
  stats: FrameStatsShared;
  /** Shown alongside the numbers so a screenshot is self-describing. */
  shaderEnabled: boolean;
}

/**
 * On-screen ms/frame readout.
 *
 * Polls the shared value on an interval rather than subscribing per frame. Re-rendering React
 * 30-60 times a second would itself cost more than the shader being measured, which would
 * make the reading meaningless.
 */
export function FrameStatsOverlay({ stats, shaderEnabled }: Props) {
  const [snapshot, setSnapshot] = useState<FrameStatsValues>(stats.value);

  useEffect(() => {
    const id = setInterval(() => setSnapshot(stats.value), SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [stats]);

  const fps = emaToFps(snapshot.emaMs);
  const healthy = snapshot.emaMs > 0 && snapshot.emaMs <= FRAME_BUDGET_MS;
  const overBudgetPct =
    snapshot.count > 0 ? (snapshot.overBudget / snapshot.count) * 100 : 0;

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={[styles.fps, { color: healthy ? ACCENT : WARN }]}>
        {fps.toFixed(1)} FPS
      </Text>
      <Text style={styles.row}>EMA {snapshot.emaMs.toFixed(2)} ms</Text>
      <Text style={styles.row}>LAST {snapshot.lastMs.toFixed(2)} ms</Text>
      <Text style={styles.row}>FRAMES {snapshot.count}</Text>
      <Text style={styles.row}>
        OVER {snapshot.overBudget} ({overBudgetPct.toFixed(1)}%)
      </Text>
      <Text style={styles.row}>GRADE {shaderEnabled ? 'ON' : 'OFF'}</Text>
      <Text style={styles.row}>JS {BUNDLE_LABEL}</Text>
    </View>
  );
}

const ACCENT = '#E8B54A';
const WARN = '#E5533D';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 64,
    left: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
  },
  fps: {
    fontFamily: 'Menlo',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  row: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: '#D8D8D8',
    fontVariant: ['tabular-nums'],
    lineHeight: 16,
  },
});
