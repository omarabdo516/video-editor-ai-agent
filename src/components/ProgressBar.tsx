import React from 'react';
import { useCurrentFrame } from 'remotion';
import { tokens } from '../tokens';

type Props = {
  /** Total frame count the bar represents — when `frame === totalFrames`, bar is full. */
  totalFrames: number;
};

/**
 * Phase 10 Round B — F3: thin progress bar.
 *
 * Position: y ≈ 1895 (very bottom of the 1920-tall comp, 25px above
 * the bottom edge). Omar asked for "تحت خالص" — the bottom edge.
 * Instagram/TikTok have action buttons on the bottom-right but the
 * centered region is free for a thin horizontal bar. Width inset by
 * 100px on both sides to match the safe-area padding.
 *
 * Width scales from 0 → 100% across the reel's lecture section. Color
 * is the brand accent on a faint white track for contrast.
 */
export const ProgressBar: React.FC<Props> = ({ totalFrames }) => {
  const frame = useCurrentFrame();
  const progress = totalFrames > 0 ? Math.min(1, frame / totalFrames) : 0;

  const TRACK_HEIGHT = 4;
  const TRACK_BOTTOM = 25; // 25px from the bottom edge of the 1920 comp
  const TRACK_INSET_X = 100; // matches safe area padding

  return (
    <div
      style={{
        position: 'absolute',
        bottom: TRACK_BOTTOM,
        left: TRACK_INSET_X,
        right: TRACK_INSET_X,
        height: TRACK_HEIGHT,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: TRACK_HEIGHT / 2,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 900, // below logo (1000), above scenes
      }}
    >
      <div
        style={{
          width: `${(progress * 100).toFixed(2)}%`,
          height: '100%',
          backgroundColor: tokens.colors.accent,
          boxShadow: `0 0 10px rgba(255,181,1,0.6)`,
        }}
      />
    </div>
  );
};
