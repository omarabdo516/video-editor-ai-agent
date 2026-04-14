import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { AccentFlashMicroEvent } from '../../types';

type Props = { event: AccentFlashMicroEvent };

/**
 * Tier 2 micro-event: a vertical accent bar briefly flashes from the
 * left or right edge of the frame. 0.6s total. Used as a lightweight
 * "heartbeat" on low-intensity moments.
 */
export const AccentFlash: React.FC<Props> = ({ event }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = Math.max(
    1,
    Math.round((event.end_sec - event.start_sec) * fps),
  );

  // Slide in from edge, hold briefly, slide out
  const peakFrame = Math.floor(totalFrames * 0.4);
  const progress = interpolate(
    frame,
    [0, peakFrame, totalFrames],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const barWidth = 16;
  const barHeight = 520;
  // Side placement — flex from edge into the frame slightly
  const side = event.side === 'left' ? 'left' : 'right';
  const offset = interpolate(progress, [0, 1], [-barWidth, 24]);

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        [side]: offset,
        transform: 'translateY(-50%)',
        width: barWidth,
        height: barHeight,
        background: `linear-gradient(180deg, rgba(255,181,1,0.2) 0%, ${tokens.colors.accent} 50%, rgba(255,181,1,0.2) 100%)`,
        borderRadius: barWidth / 2,
        boxShadow: `0 0 30px ${tokens.colors.accent}, 0 0 60px rgba(255,181,1,0.5)`,
        opacity: progress,
        pointerEvents: 'none',
      }}
    />
  );
};
