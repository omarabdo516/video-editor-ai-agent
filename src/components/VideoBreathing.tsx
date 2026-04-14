import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

type Props = {
  /** Peak extra scale on top of 1.0 — default 0.015 (1.5%) */
  amplitude?: number;
  /** Oscillation period in seconds — default 5s */
  periodSec?: number;
  children: React.ReactNode;
};

/**
 * Tier 3 continuous motion: a slow, imperceptible breathing zoom applied to
 * the video layer. Keeps the frame feeling alive even during idle beats.
 * Composes multiplicatively with SmartZoom — when a big zoom is active, the
 * breathing effect becomes invisible. Use this as the innermost wrapper
 * around VideoTrack.
 */
export const VideoBreathing: React.FC<Props> = ({
  amplitude = 0.015,
  periodSec = 5,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = frame / fps;
  // Sine oscillation 0..1..0 across one period
  const wave = (Math.sin((t / periodSec) * Math.PI * 2) + 1) / 2;
  const scale = 1 + wave * amplitude;

  return (
    <AbsoluteFill
      style={{
        transformOrigin: '50% 50%',
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
