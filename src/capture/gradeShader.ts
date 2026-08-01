import {
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
  type SkPaint,
} from '@shopify/react-native-skia';
import { VINTAGE_GRADE_SKSL } from '../shaders/vintageGrade.sksl';

/**
 * The compiled runtime effect, built once at module load.
 *
 * Compiling a shader is expensive. Doing it inside onFrame would recompile 30-60 times a
 * second and destroy performance, so it is deliberately hoisted to module scope where it is
 * shared by the live preview and the still-capture path. That sharing is the point: preview
 * and capture must apply identical math or the saved photo will not match what was framed.
 */
export const gradeEffect = (() => {
  const effect = Skia.RuntimeEffect.Make(VINTAGE_GRADE_SKSL);
  if (effect == null) {
    // Make() returns null on a compile error and swallows the reason, so fail loudly here
    // rather than rendering a black screen with no explanation.
    throw new Error(
      'Failed to compile VINTAGE_GRADE_SKSL. Check the SkSL source for syntax errors.',
    );
  }
  return effect;
})();

/**
 * Build a paint that samples `image` through the grade shader.
 *
 * Uniform values must be supplied in declaration order: uResolution (float2), then uTime.
 *
 * @param image  the source texture to grade
 * @param time   animates the grain; pass 0 for a deterministic still
 * @param paint  optional paint to reuse — pass a cached one from a worklet to avoid
 *               allocating per frame
 */
export function makeGradePaint(image: SkImage, time: number, paint?: SkPaint): SkPaint {
  'worklet';
  const target = paint ?? Skia.Paint();
  const source = image.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Linear,
    MipmapMode.None,
  );
  target.setShader(
    gradeEffect.makeShaderWithChildren([image.width(), image.height(), time], [source]),
  );
  return target;
}
