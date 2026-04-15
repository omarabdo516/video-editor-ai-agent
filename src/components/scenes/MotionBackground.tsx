import React from 'react';
import { useCurrentFrame } from 'remotion';
import { tokens } from '../../tokens';

type Props = {
  /** Base gradient string — defaults to tokens.scenes.defaultBackground */
  background?: string;
};

/**
 * Phase 10 Round B — F5: Motion Background.
 *
 * Animates the scene's base gradient by oscillating the gradient angle
 * and a subtle color-stop position. Motion intensity is low (taste-skill
 * guideline: 3-4 for backgrounds) — the intent is to add depth, not to
 * distract from the scene content.
 *
 * Uses sine-wave easing (not linear rotation) so the motion feels
 * organic, not mechanical.
 *
 * Drop-in replacement for a static `<AbsoluteFill style={{ background }}>`
 * — sits inside the scene content layer so it doesn't fight with the
 * FullScreenScene wrapper's enter/exit transforms.
 */
export const MotionBackground: React.FC<Props> = ({ background }) => {
  const frame = useCurrentFrame();

  // Angle sine-wave: base 135° ± 4° over a slow 6s cycle (180 frames).
  // 4° is small enough that viewers don't consciously notice but it
  // gives the light direction a gentle pulse.
  const anglePhase = (frame / 180) * Math.PI * 2;
  const angle = 135 + Math.sin(anglePhase) * 4;

  // Color-stop shift: 0% → 3% → 0% on a slower 8s cycle. The stop
  // moving creates a subtle "glow drift" across the frame.
  const stopPhase = (frame / 240) * Math.PI * 2;
  const stopShift = (Math.sin(stopPhase) + 1) / 2; // 0..1
  const midStop = 45 + stopShift * 10; // 45..55

  // If the scene passed a custom background, respect it (we can't
  // animate an arbitrary user-supplied gradient without parsing it).
  // Fall back to our animated two-stop gradient using brand colors.
  const hasCustomBg = !!background && background !== tokens.scenes.defaultBackground;
  const animatedBg = hasCustomBg
    ? background
    : `linear-gradient(${angle}deg, ${tokens.colors.dark} 0%, ${tokens.colors.primary} ${midStop}%, ${tokens.colors.primary} 100%)`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: animatedBg,
        pointerEvents: 'none',
      }}
    />
  );
};
