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
 * WordCaptionBox — each word rendered inside its own rounded box.
 *
 * The active word's box fills with accent yellow and the text flips to dark
 * (reverse contrast). Past words keep a subtle accent border. Upcoming words
 * are white-on-dark with a faint border. Visual beat is very clear — good
 * for listicle / checklist / enumerated segments.
 */
export const WordCaptionBox: React.FC<Props> = ({
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
        top: cap.position.y - 160,
        width: cap.maxWidth,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        direction: 'rtl',
        fontFamily: tokens.fonts.body,
        fontWeight: tokens.fonts.bodyWeight,
        fontSize: cap.fontSize * 0.88,
        lineHeight: 1.1,
        textAlign: 'center',
        gap: '10px 10px',
      }}
    >
      {segment.words.map((w, i) => {
        const isActive = nowSec >= w.start && nowSec <= w.end;
        const isPast = nowSec > w.end;
        const isBoosted = isActive && isEmphasisActive;

        const bgColor = isActive
          ? tokens.colors.accent
          : isPast
          ? 'rgba(13, 31, 60, 0.7)'
          : 'rgba(13, 31, 60, 0.55)';
        const textColor = isActive ? tokens.colors.dark : tokens.colors.white;
        const borderColor = isActive
          ? tokens.colors.accent
          : isPast
          ? `${tokens.colors.accent}aa`
          : 'rgba(255,255,255,0.25)';

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              background: bgColor,
              color: textColor,
              border: `3px solid ${borderColor}`,
              borderRadius: 14,
              padding: '10px 22px',
              transform: isBoosted
                ? 'scale(1.18) rotate(-1.5deg)'
                : isActive
                ? 'scale(1.08)'
                : 'scale(1)',
              transformOrigin: 'center',
              transition:
                'transform 120ms ease-out, background 180ms ease-out, color 180ms ease-out, border-color 180ms ease-out',
              boxShadow: isActive
                ? `0 0 22px ${tokens.colors.accent}, 0 4px 14px rgba(0,0,0,0.5)`
                : '0 4px 14px rgba(0,0,0,0.6)',
              textShadow: isActive
                ? 'none'
                : '0 2px 4px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.6)',
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};
