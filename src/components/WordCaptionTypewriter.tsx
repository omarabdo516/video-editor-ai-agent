import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
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
 * WordCaptionTypewriter — words reveal one-by-one as they're spoken.
 *
 * Only words whose `start` time has passed are visible. Each new word
 * springs in from below with a brief fade. A blinking accent cursor marks
 * the insertion point. Feels like the lecturer is typing out what they say.
 * Good for contemplative / setup moments.
 */
export const WordCaptionTypewriter: React.FC<Props> = ({
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

  // Show a blinking cursor at 2 Hz
  const cursorOn = Math.floor((nowSec * 2) % 2) === 0;

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
        if (nowSec < w.start) return null;

        const isActive = nowSec >= w.start && nowSec <= w.end;
        const isBoosted = isActive && isEmphasisActive;

        // Local frame since this word started — drives spring entry
        const wordStartFrame = Math.round((w.start - timeOffset) * fps);
        const localFrame = Math.max(0, frame - wordStartFrame);
        const entry = spring({
          frame: localFrame,
          fps,
          config: { damping: 14, stiffness: 140, mass: 0.8 },
        });

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              color: isActive ? cap.activeColor : cap.inactiveColor,
              opacity: entry,
              transform: `translateY(${(1 - entry) * 22}px) scale(${
                isBoosted ? 1.28 : isActive ? 1.05 : 1
              })`,
              transformOrigin: 'center',
              transition: 'color 200ms ease-out',
              textShadow: isBoosted
                ? '0 0 22px rgba(255,181,1,0.85), 0 0 44px rgba(255,181,1,0.45), 0 4px 16px rgba(0,0,0,0.9)'
                : undefined,
            }}
          >
            {w.word}
          </span>
        );
      })}
      {/* Blinking accent cursor after the last revealed word */}
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 6,
          height: cap.fontSize * 0.9,
          background: cap.activeColor,
          opacity: cursorOn ? 0.9 : 0,
          transform: 'translateY(4px)',
          boxShadow: `0 0 14px ${cap.activeColor}`,
          marginInlineStart: 4,
        }}
      />
    </div>
  );
};
