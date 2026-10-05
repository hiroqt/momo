/** View-shot sizes are points on iOS and pixels on Android. Always export 1080 × 1920 pixels. */
export function storyCaptureSize(platform: string, density: number) {
  const scale = platform === 'ios' && Number.isFinite(density) && density > 0 ? density : 1;
  return { width: 1080 / scale, height: 1920 / scale };
}
