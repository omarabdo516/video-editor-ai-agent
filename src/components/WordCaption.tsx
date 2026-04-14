import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../tokens';
import type { CaptionSegment } from '../types';

type Props = {
  segment: CaptionSegment;
  /** Seconds offset between this segment's timeline and the composition frame 0 */
  timeOffset?: number;
};

/**
 * Renders one caption segment with word-by-word highlighting.
 * The active word (the one being spoken at the current frame) is rendered in
 * RS accent yellow; the rest are white. A subtle dark stroke via text-shadow
 * keeps the text readable over any background.
 */
export const WordCaption: React.FC<Props> = ({ segment, timeOffset = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowSec = frame / fps + timeOffset;

  const cap = tokens.captions;

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
        return (
          <span
            key={i}
            style={{
              color: isActive
                ? cap.activeColor
                : isPast
                ? cap.inactiveColor
                : cap.inactiveColor,
              transform: isActive ? 'scale(1.06)' : 'scale(1)',
              transformOrigin: 'center',
              transition: 'transform 80ms ease-out',
              display: 'inline-block',
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};
