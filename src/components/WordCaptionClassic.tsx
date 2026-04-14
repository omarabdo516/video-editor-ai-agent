import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../tokens';
import type { CaptionSegment } from '../types';

type Props = {
  segment: CaptionSegment;
  timeOffset?: number;
  emphasisTimes?: number[];
};

const EMPHASIS_LEAD_SEC = 0.15;
const EMPHASIS_TAIL_SEC = 0.3;

/**
 * WordCaptionClassic — minimal single-line subtitle.
 *
 * All words white, no per-word highlighting. Just a clean, readable line at
 * the standard caption position with the brand text-shadow for contrast.
 * Use this when the moment needs the video to breathe and the caption to
 * stay out of the way — or for setup / low-intensity narration.
 *
 * Still respects `emphasisTimes`: during an emphasis beat, the whole line
 * briefly scales up and glows accent.
 */
export const WordCaptionClassic: React.FC<Props> = ({
  segment,
  timeOffset = 0,
  emphasisTimes,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowSec = frame / fps + timeOffset;
  const cap = tokens.captions;

  const isEmphasisActive = React.useMemo(() => {
    if (!emphasisTimes || emphasisTimes.length === 0) return false;
    for (const t of emphasisTimes) {
      if (nowSec >= t - EMPHASIS_LEAD_SEC && nowSec <= t + EMPHASIS_TAIL_SEC) {
        return true;
      }
    }
    return false;
  }, [emphasisTimes, nowSec]);

  return (
    <div
      style={{
        position: 'absolute',
        left: cap.position.x - cap.maxWidth / 2,
        top: cap.position.y - 130,
        width: cap.maxWidth,
        textAlign: 'center',
        direction: 'rtl',
        fontFamily: tokens.fonts.body,
        fontWeight: 700,
        fontSize: cap.fontSize * 0.92,
        lineHeight: cap.lineHeight,
        color: isEmphasisActive ? cap.activeColor : cap.inactiveColor,
        transform: `scale(${isEmphasisActive ? 1.08 : 1})`,
        transformOrigin: 'center',
        transition: 'transform 180ms ease-out, color 180ms ease-out',
        textShadow: isEmphasisActive
          ? '0 0 22px rgba(255,181,1,0.75), 0 0 44px rgba(255,181,1,0.4), 0 4px 16px rgba(0,0,0,0.9)'
          : '0 0 12px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.75), 0 2px 4px rgba(0,0,0,1)',
      }}
    >
      {segment.text}
    </div>
  );
};
