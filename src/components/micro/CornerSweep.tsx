import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { CornerSweepMicroEvent } from '../../types';

type Props = { event: CornerSweepMicroEvent };

/**
 * Tier 2 micro-event (Phase 10 Round A): a diagonal accent line sweeps
 * from one corner toward the center of the frame — 400ms total. Draws
 * in, holds a breath, then fades. Used as a low-intensity rhythm beat
 * that doesn't compete with captions or scenes.
 *
 * The corner prop decides origin + angle:
 *   top_right (default, RTL):  diagonal ↘ from upper-right
 *   top_left:                  diagonal ↙ from upper-left
 *   bottom_right / bottom_left: mirrored equivalents
 */
export const CornerSweep: React.FC<Props> = ({ event }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = Math.max(
    1,
    Math.round((event.end_sec - event.start_sec) * fps),
  );

  // Three-phase timeline: draw (40%) → hold (30%) → fade (30%)
  const drawEnd = Math.floor(totalFrames * 0.4);
  const holdEnd = Math.floor(totalFrames * 0.7);

  const drawProgress = interpolate(frame, [0, drawEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeProgress = interpolate(frame, [holdEnd, totalFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const corner = event.corner ?? 'top_right';
  const isTop = corner.startsWith('top');
  const isRight = corner.endsWith('right');

  // Line sits at a 45° diagonal, length scales with drawProgress.
  // Positioned just outside the safe area so it skims the frame edge.
  const LENGTH_PX = 520;
  const THICKNESS_PX = 6;
  const OFFSET_FROM_EDGE = 110; // just inside the top/bottom safe edge

  const originX = isRight ? 'auto' : 0;
  const originXRight = isRight ? 0 : 'auto';
  const originY = isTop ? OFFSET_FROM_EDGE : 'auto';
  const originYBottom = isTop ? 'auto' : OFFSET_FROM_EDGE;

  // Rotation direction: top_right sweeps ↙, top_left sweeps ↘, etc.
  const rotation = isTop
    ? isRight
      ? 45  // top_right → down-left
      : -45 // top_left → down-right
    : isRight
      ? -45 // bottom_right → up-left
      : 45; // bottom_left → up-right

  return (
    <div
      style={{
        position: 'absolute',
        top: originY,
        bottom: originYBottom,
        left: originX,
        right: originXRight,
        width: LENGTH_PX,
        height: THICKNESS_PX,
        pointerEvents: 'none',
        opacity: fadeProgress,
        // The visual line is a child with `transform: scaleX(drawProgress)`
        // so the grow direction stays anchored at the corner origin.
        transform: `rotate(${rotation}deg)`,
        transformOrigin: isRight ? 'right center' : 'left center',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: isRight ? 'right center' : 'left center',
          transform: `scaleX(${drawProgress})`,
          background: `linear-gradient(${isRight ? 270 : 90}deg, transparent 0%, ${tokens.colors.accent} 30%, ${tokens.colors.accent} 70%, transparent 100%)`,
          boxShadow: `0 0 24px rgba(255,181,1,0.7), 0 0 48px rgba(255,181,1,0.35)`,
          borderRadius: THICKNESS_PX / 2,
        }}
      />
    </div>
  );
};
