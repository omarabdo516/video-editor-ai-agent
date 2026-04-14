import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
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
 * WordCaptionKaraoke — progressive "fill" caption style.
 *
 * All words in the segment are always on screen. As each word's time window
 * plays, an accent underline sweeps across it (RTL right-to-left), and past
 * words stay highlighted in the accent color. Active word gets a subtle
 * scale bump + glow. Good for music-video / rhythm-heavy moments.
 */
export const WordCaptionKaraoke: React.FC<Props> = ({
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
        gap: '4px 18px',
        textShadow:
          '0 0 12px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,1)',
      }}
    >
      {segment.words.map((w, i) => {
        const isActive = nowSec >= w.start && nowSec <= w.end;
        const isPast = nowSec > w.end;
        const isBoosted = isActive && isEmphasisActive;

        // Progress through the active word (0 → 1) drives the karaoke fill.
        const wordProgress = isActive
          ? interpolate(nowSec, [w.start, w.end], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : isPast
          ? 1
          : 0;

        return (
          <span
            key={i}
            style={{
              position: 'relative',
              display: 'inline-block',
              color: isPast ? cap.activeColor : cap.inactiveColor,
              transform: isBoosted
                ? 'scale(1.22) rotate(-1.5deg)'
                : isActive
                ? 'scale(1.05)'
                : 'scale(1)',
              transformOrigin: 'center',
              transition: 'transform 100ms ease-out, color 200ms ease-out',
              textShadow: isBoosted
                ? '0 0 22px rgba(255,181,1,0.85), 0 0 44px rgba(255,181,1,0.45), 0 4px 16px rgba(0,0,0,0.9)'
                : undefined,
              paddingBottom: 8,
            }}
          >
            {w.word}
            {/* Accent underline that fills from right (RTL) to left as the
                word plays, then stays filled for past words. */}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                height: 6,
                width: `${wordProgress * 100}%`,
                background: cap.activeColor,
                borderRadius: 3,
                boxShadow: isActive
                  ? `0 0 12px ${cap.activeColor}`
                  : undefined,
                transition: 'width 60ms linear',
              }}
            />
          </span>
        );
      })}
    </div>
  );
};
