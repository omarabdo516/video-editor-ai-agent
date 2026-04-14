import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../tokens';
import type { CaptionSegment } from '../types';

type Props = {
  segment: CaptionSegment;
  /** Seconds offset between this segment's timeline and the composition frame 0 */
  timeOffset?: number;
  /**
   * Global seconds where an emphasis beat should boost the currently-active
   * word (makes it bigger + glowier for ~0.4s). Replaces the old standalone
   * WordPop element — cleaner because it never collides with other UI.
   */
  emphasisTimes?: number[];
};

// Emphasis window around each beat time — the boost is visible for this span
const EMPHASIS_LEAD_SEC = 0.15;
const EMPHASIS_TAIL_SEC = 0.30;

/**
 * Renders one caption segment with word-by-word highlighting.
 * The active word (the one being spoken at the current frame) is rendered in
 * RS accent yellow; the rest are white. When an emphasis beat is active AND
 * a word is currently playing, that word gets a stronger pop — bigger scale,
 * accent glow, soft rotation.
 */
export const WordCaption: React.FC<Props> = ({
  segment,
  timeOffset = 0,
  emphasisTimes,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowSec = frame / fps + timeOffset;

  const cap = tokens.captions;

  // Is there an emphasis beat active right now?
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
        top: cap.position.y - 140,
        width: cap.maxWidth,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        direction: 'rtl',
        fontFamily: tokens.fonts.body,
        fontWeight: tokens.fonts.bodyWeight,
        fontSize: cap.fontSize,
        lineHeight: cap.lineHeight,
        textAlign: 'center',
        gap: '0 18px',
        textShadow:
          '0 0 12px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,1)',
      }}
    >
      {segment.words.map((w, i) => {
        const isActive = nowSec >= w.start && nowSec <= w.end;
        const isPast = nowSec > w.end;
        const isBoosted = isActive && isEmphasisActive;

        return (
          <span
            key={i}
            style={{
              color: isActive
                ? cap.activeColor
                : isPast
                ? cap.inactiveColor
                : cap.inactiveColor,
              transform: isBoosted
                ? 'scale(1.28) rotate(-2deg)'
                : isActive
                ? 'scale(1.06)'
                : 'scale(1)',
              transformOrigin: 'center',
              transition: 'transform 120ms ease-out, text-shadow 120ms ease-out',
              display: 'inline-block',
              // Boosted word gets a stronger glow on top of the base text-shadow
              textShadow: isBoosted
                ? '0 0 22px rgba(255,181,1,0.85), 0 0 44px rgba(255,181,1,0.45), 0 4px 16px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,1)'
                : undefined,
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};
