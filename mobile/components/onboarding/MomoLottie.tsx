import React from 'react';
import { MomoAnimation } from '@/components/mascot/MomoAnimation';
import type { MomoStep } from './momoSteps';

/** Preserve the complete source artwork on every onboarding step. */
export function MomoLottie({ step, size }: { step: MomoStep; size: number }) {
  return <MomoAnimation name={step.animation} size={size} accessibilityLabel={step.label} />;
}
