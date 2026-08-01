/**
 * Phase 1 spike shader.
 *
 * Deliberately more expensive than a flat tint: a per-pixel tone curve, split-tone,
 * vignette and grain. A trivial shader would give a meaningless performance reading —
 * this approximates what a real vintage grade actually costs per frame.
 *
 * Kept as a standalone exported string (never an inline template literal in a component)
 * so the SkSL -> Metal Shading Language port stays mechanical if this ever goes native.
 *
 * Uniform order matters: it must match the order values are passed to
 * makeShaderWithChildren(). uResolution is a float2 (2 slots), then uTime (1 slot).
 */
export const VINTAGE_GRADE_SKSL = `
uniform shader src;
uniform float2 uResolution;
uniform float  uTime;

half4 main(float2 xy) {
  half4 c = src.eval(xy);
  float2 uv = xy / uResolution;

  // Lifted-shadow film curve: gamma lift, then raise the floor so blacks go milky
  // rather than crushed. The per-channel offset is a mild cool cast in the shadows.
  c.rgb = pow(c.rgb, half3(0.92));
  c.rgb += half3(0.02, 0.05, 0.03);

  // Green/teal split-tone
  c.r *= 0.94;
  c.g *= 1.06;
  c.b *= 0.98;

  // Vignette — quadratic falloff from centre
  float d = distance(uv, float2(0.5));
  c.rgb *= half(1.0 - 0.45 * d * d);

  // Grain. uTime decorrelates it frame-to-frame so it shimmers like film rather than
  // sitting as a static texture.
  float n = fract(sin(dot(uv * uResolution + uTime, float2(12.9898, 78.233))) * 43758.5453);
  c.rgb += half3(half(n - 0.5) * 0.04);

  return half4(clamp(c.rgb, 0.0, 1.0), c.a);
}
`;

/** Number of float slots the uniforms occupy: float2 + float. */
export const VINTAGE_GRADE_UNIFORM_COUNT = 3;
