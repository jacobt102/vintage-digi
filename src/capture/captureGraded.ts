import { Skia, type SkImage, type SkSurface } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { Asset } from 'expo-media-library';
import type { CameraPhotoOutput } from 'react-native-vision-camera';
import { makeGradePaint } from './gradeShader';

export interface CaptureResult {
  /** Media-library asset id of the graded image saved to Photos. */
  assetId: string;
  /** Local file URI of the graded PNG written before saving. */
  gradedUri: string;
  width: number;
  height: number;
  /** Wall-clock milliseconds for the whole capture -> save pipeline. */
  elapsedMs: number;
}

/**
 * Capture a still, apply the grade offscreen, and save the result to Photos.
 *
 * The critical property being proven in Phase 1: the grade in the saved file comes from the
 * *same* compiled shader as the live preview (see gradeShader.ts). VisionCamera's photo output
 * captures the sensor image, not what Skia drew on screen, so the grade must be re-applied
 * here or the saved photo would come back ungraded.
 *
 * Phase 3 will additionally persist the ungraded master plus a LookRecipe sidecar. For the
 * spike, only the graded output is written.
 *
 * @param photoOutput the output obtained from usePhotoOutput()
 * @param grainTime   value for the shader's uTime uniform; keep fixed for reproducible stills
 */
export async function captureGraded(
  photoOutput: CameraPhotoOutput,
  grainTime = 0,
): Promise<CaptureResult> {
  const started = Date.now();

  // capturePhoto takes BOTH settings and callbacks — omitting the second argument is a
  // type error in v5.
  const photo = await photoOutput.capturePhoto({}, {});

  let skImage: SkImage | null = null;
  let surface: SkSurface | null = null;
  let snapshot: SkImage | null = null;

  try {
    // toImageAsync() returns a Nitro Image, which Skia cannot consume. The encoded bytes
    // are the supported bridge into Skia.
    const encoded = new Uint8Array(await photo.getFileDataAsync());
    skImage = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(encoded));
    if (skImage == null) {
      throw new Error('Skia could not decode the captured photo data.');
    }

    const width = skImage.width();
    const height = skImage.height();

    surface = Skia.Surface.MakeOffscreen(width, height);
    if (surface == null) {
      throw new Error(`Failed to allocate a ${width}x${height} offscreen surface.`);
    }

    const canvas = surface.getCanvas();
    canvas.drawImage(skImage, 0, 0, makeGradePaint(skImage, grainTime));
    surface.flush();

    snapshot = surface.makeImageSnapshot();
    const png = snapshot.encodeToBytes();

    const file = new File(Paths.cache, `vintage-${Date.now()}.png`);
    file.create({ overwrite: true });
    file.write(png);

    const asset = await Asset.create(file.uri);

    return {
      assetId: asset.id,
      gradedUri: file.uri,
      width,
      height,
      elapsedMs: Date.now() - started,
    };
  } finally {
    // Skia objects are native allocations that the JS GC does not manage. Leaks here show up
    // as gradual frame-rate collapse rather than a crash, so dispose deterministically.
    snapshot?.dispose();
    surface?.dispose();
    skImage?.dispose();
    photo.dispose();
  }
}
