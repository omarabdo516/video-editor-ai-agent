import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { BorderPulseMicroEvent } from '../../types';

type Props = { event: BorderPulseMicroEvent };

/**
 * Tier 2 micro-event (Phase 10 Round A): a faint 2px accent border
 * pulses around the caption zone — 300ms total. Used as a subtle "heads
 * up" beat that doesn't overlap the caption text. Anchors to the same
 * safe zone as KeywordHighlightOverlay (y≈1140, 820px wide).
 *
 * The border grows from 0 → full opacity, holds one beat, and fades.
 * No transform — just an opacity pulse on a position-absolute div.
 */
export const BorderPulse: React.FC<Props> = ({ event }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = Math.max(
    1,
    Math.round((event.end_sec - event.start_sec) * fps),
  );

  // Two-phase: ramp up (40%) → ramp down (60%)
  const peakFrame = Math.floor(totalFrames * 0.4);
  const intensity = interpolate(
    frame,
    [0, peakFrame, totalFrames],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Match caption zone dimensions + a little breathing room so the
  // border doesn't touch the active word.
  const cap = tokens.captions;
  const width = cap.maxWidth + 60;
  const height = 220;
  const x = cap.position.x - width / 2;
  const y = cap.position.y - height / 2 - 10;

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: x,
        width,
        height,
        borderRadius: 18,
        border: `2px solid ${tokens.colors.accent}`,
        opacity: intensity * 0.85,
        boxShadow: `0 0 ${20 + intensity * 24}px rgba(255,181,1,${(intensity * 0.6).toFixed(2)}), inset 0 0 ${14 + intensity * 18}px rgba(255,181,1,${(intensity * 0.35).toFixed(2)})`,
        pointerEvents: 'none',
      }}
    />
  );
};
