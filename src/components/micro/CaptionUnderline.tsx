import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { CaptionUnderlineMicroEvent } from '../../types';

type Props = { event: CaptionUnderlineMicroEvent };

/**
 * Tier 2 micro-event: an accent line draws itself underneath the caption
 * area (RTL: right → left), holds, then fades out. ~1.2s total.
 */
export const CaptionUnderline: React.FC<Props> = ({ event }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = Math.max(
    1,
    Math.round((event.end_sec - event.start_sec) * fps),
  );

  // Draw in from right to left (RTL: width 0 → full, anchored at right edge)
  const drawFrames = Math.min(14, Math.floor(totalFrames * 0.45));
  const holdFrames = totalFrames - drawFrames - 6;
  const drawProgress = interpolate(frame, [0, drawFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out at the end
  const fadeProgress = interpolate(
    frame,
    [drawFrames + holdFrames, totalFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Glow pulse while held (after the draw completes)
  const pulseT = Math.max(0, frame - drawFrames);
  const pulse = (Math.sin(pulseT * 0.2) + 1) / 2;
  const glowRadius = 14 + pulse * 8;

  // Matches caption width + sits right below the caption text
  const underlineWidth = tokens.captions.maxWidth * 0.82;
  const y = tokens.captions.position.y + 30; // ~1450

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: 0,
        right: 0,
        height: 12,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity: fadeProgress,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: underlineWidth,
          height: 8,
          // RTL: anchor the drawing animation at the right (visual right)
          direction: 'rtl',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: `${drawProgress * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, rgba(255,181,1,0.3), ${tokens.colors.accent} 50%, rgba(255,181,1,0.3))`,
            borderRadius: 4,
            boxShadow: `0 0 ${glowRadius}px rgba(255,181,1,0.65), 0 0 ${glowRadius * 2}px rgba(255,181,1,0.3)`,
          }}
        />
      </div>
    </div>
  );
};
