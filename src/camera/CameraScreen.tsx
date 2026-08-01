import { Skia } from '@shopify/react-native-skia';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import {
  useCameraPermission,
  usePhotoOutput,
  type CameraPhotoOutput,
} from 'react-native-vision-camera';
import { SkiaCamera } from 'react-native-vision-camera-skia';
import { captureGraded } from '../capture/captureGraded';
import { makeGradePaint } from '../capture/gradeShader';
import { recordFrame, useFrameStats } from '../perf/FrameStats';
import { FrameStatsOverlay } from '../perf/FrameStatsOverlay';

/**
 * Paint reused across every frame.
 *
 * Allocating a Paint inside onFrame would create 30-60 native objects a second and defeat the
 * measurement this screen exists to take. setShader() overwrites the previous shader, so a
 * single instance is safe here.
 */
const previewPaint = Skia.Paint();

type Status =
  | { kind: 'idle' }
  | { kind: 'capturing' }
  | { kind: 'saved'; message: string }
  | { kind: 'error'; message: string };

export function CameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [shaderEnabled, setShaderEnabled] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const stats = useFrameStats();

  // Must be a shared value, not a React ref: onFrame runs on a separate worklet runtime that
  // cannot observe mutations to a ref, so a ref would leave the toggle permanently stuck at
  // its initial value. A shared value is the supported cross-runtime channel.
  const shaderEnabledShared = useSharedValue(shaderEnabled);
  useEffect(() => {
    shaderEnabledShared.value = shaderEnabled;
  }, [shaderEnabled, shaderEnabledShared]);

  const photoOutput: CameraPhotoOutput = usePhotoOutput({
    qualityPrioritization: 'quality',
  });

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  const onCapture = useCallback(async () => {
    setStatus({ kind: 'capturing' });
    try {
      const result = await captureGraded(photoOutput);
      setStatus({
        kind: 'saved',
        message: `${result.width}x${result.height} in ${result.elapsedMs}ms`,
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [photoOutput]);

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notice}>CAMERA ACCESS REQUIRED</Text>
        <Pressable style={styles.button} onPress={() => void requestPermission()}>
          <Text style={styles.buttonText}>GRANT</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SkiaCamera
        style={StyleSheet.absoluteFill}
        device="back"
        isActive={true}
        outputs={[photoOutput]}
        constraints={[{ fps: 30 }]}
        onFrame={(frame, render) => {
          'worklet';
          const start = performance.now();
          try {
            render(({ canvas, frameTexture }) => {
              'worklet';
              if (shaderEnabledShared.value) {
                // Grain is animated off the frame timestamp so it shimmers like film rather
                // than sitting still as a fixed texture.
                const time = (frame.timestamp / 1e9) % 1000;
                canvas.drawImage(
                  frameTexture,
                  0,
                  0,
                  makeGradePaint(frameTexture, time, previewPaint),
                );
              } else {
                // Ungraded baseline. The delta between this and the graded path is the real
                // go/no-go number: it separates "shader too costly" from "pipeline too slow".
                canvas.drawImage(frameTexture, 0, 0);
              }
            });
            recordFrame(stats, performance.now() - start);
          } finally {
            // Mandatory every frame — the camera's buffer pool starves otherwise and the
            // pipeline stalls.
            frame.dispose();
          }
        }}
      />

      <FrameStatsOverlay stats={stats} shaderEnabled={shaderEnabled} />

      <View style={styles.deck}>
        <Pressable
          style={styles.toggle}
          onPress={() => setShaderEnabled((previous) => !previous)}>
          <Text style={styles.toggleText}>{shaderEnabled ? 'GRADE ON' : 'GRADE OFF'}</Text>
        </Pressable>

        <Pressable
          style={styles.shutter}
          disabled={status.kind === 'capturing'}
          onPress={() => void onCapture()}>
          {status.kind === 'capturing' ? (
            <ActivityIndicator color="#0A0A0A" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>

        <View style={styles.statusBox}>
          {status.kind === 'saved' && (
            <Text style={styles.statusOk} numberOfLines={2}>
              SAVED {status.message}
            </Text>
          )}
          {status.kind === 'error' && (
            <Text style={styles.statusErr} numberOfLines={3}>
              {status.message}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const ACCENT = '#E8B54A';
const ERROR = '#E5533D';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
    gap: 16,
  },
  notice: {
    color: '#D8D8D8',
    fontFamily: 'Menlo',
    fontSize: 13,
    letterSpacing: 1,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  buttonText: { color: ACCENT, fontFamily: 'Menlo', fontSize: 13, letterSpacing: 2 },
  deck: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 44,
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderTopWidth: 1,
    borderTopColor: '#262626',
    alignItems: 'center',
    gap: 12,
  },
  toggle: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  toggleText: { color: ACCENT, fontFamily: 'Menlo', fontSize: 11, letterSpacing: 2 },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#0A0A0A',
  },
  statusBox: { minHeight: 30, justifyContent: 'center' },
  statusOk: { color: ACCENT, fontFamily: 'Menlo', fontSize: 10, textAlign: 'center' },
  statusErr: { color: ERROR, fontFamily: 'Menlo', fontSize: 10, textAlign: 'center' },
});
