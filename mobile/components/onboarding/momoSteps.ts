import type { MomoMotionName } from '@/lib/animations/momoMotion';

export type MomoStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const MOMO_FRAME_COUNT = 120;
export interface MomoStep {
  animation: Extract<MomoMotionName, `momo-${string}`>;
  stillFrame: number;
  label: string;
}

/** Distinct intact source poses; no cut limbs or whole-body bounce. */
export const MOMO_STEPS: Record<MomoStepNumber, MomoStep> = {
  1: { animation: 'momo-wave', stillFrame: 0, label: 'Momo welcomes you with a wave' },
  2: { animation: 'momo-welcome', stillFrame: 0, label: 'Momo welcomes you to studying' },
  3: { animation: 'momo-listen', stillFrame: 0, label: 'Momo listens to your preferences' },
  4: { animation: 'momo-point', stillFrame: 0, label: 'Momo points to your study choices' },
  5: { animation: 'momo-thinking', stillFrame: 0, label: 'Momo thinks about your subject' },
  6: { animation: 'momo-present', stillFrame: 0, label: 'Momo holds up an open book' },
  7: { animation: 'momo-ready', stillFrame: 0, label: 'Momo is ready for your daily goal' },
  8: { animation: 'momo-proud', stillFrame: 0, label: 'Momo proudly shows your sample' },
  9: { animation: 'momo-cheer', stillFrame: 0, label: 'Momo cheers with arms raised' },
};
