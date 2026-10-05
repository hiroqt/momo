/** Fit illustration bounds on compact phones, landscape and tablets without cropping. */
export function fitMotionSize(width: number, height: number, screenWidth: number, screenHeight: number) {
  const safeWidth = Math.max(1, screenWidth - 32);
  const safeHeight = Math.max(1, screenHeight * 0.45);
  const ratio = Math.min(1, safeWidth / Math.max(1, width), safeHeight / Math.max(1, height));
  return { width: Math.max(1, width * ratio), aspectRatio: Math.max(1, width) / Math.max(1, height) };
}
