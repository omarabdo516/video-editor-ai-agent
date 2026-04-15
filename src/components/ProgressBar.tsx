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
 * Position: y ≈ 210 (just inside the top safe area, below the platform
 * UI). The original spec put it at y=0 but Instagram/TikTok chrome
 * (status bar + username header) masks that region — the bar would be
 * invisible. Sitting inside the safe area also keeps it away from the
 * caption zone (y=1100-1460).
 *
 * Width scales from 0 → 100% across the reel's lecture section. Color
 * is the brand accent on a faint white track for contrast.
 */
export const ProgressBar: React.FC<Props> = ({ totalFrames }) => {
  const frame = useCurrentFrame();
  const progress = totalFrames > 0 ? Math.min(1, frame / totalFrames) : 0;

  const TRACK_HEIGHT = 4;
  const TRACK_Y = 210; // just below the logo bug (y=143, width 170)
  const TRACK_INSET_X = 100; // matches safe area padding

  return (
    <div
      style={{
        position: 'absolute',
        top: TRACK_Y,
        left: TRACK_INSET_X,
        right: TRACK_INSET_X,
        height: TRACK_HEIGHT,
        backgroundColor: 'rgba(255,255,255,0.12)',
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
          boxShadow: `0 0 8px rgba(255,181,1,0.5)`,
        }}
      />
    </div>
  );
};
