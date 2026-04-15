import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../tokens';
import type { CaptionSegment, EmphasisBeat, EmphasisIntensity } from '../types';

type Props = {
  segment: CaptionSegment;
  /** Seconds offset between this segment's timeline and the composition frame 0 */
  timeOffset?: number;
  /**
   * Legacy — global seconds where an emphasis beat boosts the current
   * word. All beats get the default 'glow' variant. Kept for backward
   * compat with existing plans that predate Phase 10 Round A.
   */
  emphasisTimes?: number[];
  /**
   * Phase 10 Round A — preferred shape. Each beat carries its own
   * intensity so Phase 6 can pick `normal` / `pop` / `glow` per word
   * based on audio energy. Takes precedence over `emphasisTimes` when
   * both are provided.
   */
  emphasisBeats?: EmphasisBeat[];
};

// Emphasis window around each beat time — the boost is visible for this span
const EMPHASIS_LEAD_SEC = 0.15;
const EMPHASIS_TAIL_SEC = 0.30;

/**
 * Renders one caption segment with word-by-word highlighting.
 * The active word is rendered in RS accent gold; the rest stay white.
 * When an emphasis beat is active AND a word is currently playing, the
 * word gets one of three variants — all in the same gold, differentiated
 * by scale + letter-spacing + shadow intensity (brand rule: single accent).
 */
export const WordCaption: React.FC<Props> = ({
  segment,
  timeOffset = 0,
  emphasisTimes,
  emphasisBeats,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowSec = frame / fps + timeOffset;

  const cap = tokens.captions;

  // Find any emphasis beat active right now — returns its intensity, or
  // null if none. `emphasisBeats` (Phase 10 Round A) wins over the legacy
  // `emphasisTimes` list when both are provided.
  const activeIntensity: EmphasisIntensity | null = React.useMemo(() => {
    if (emphasisBeats && emphasisBeats.length > 0) {
      for (const b of emphasisBeats) {
        if (nowSec >= b.time - EMPHASIS_LEAD_SEC && nowSec <= b.time + EMPHASIS_TAIL_SEC) {
          return b.intensity;
        }
      }
      return null;
    }
    if (emphasisTimes && emphasisTimes.length > 0) {
      for (const t of emphasisTimes) {
        if (nowSec >= t - EMPHASIS_LEAD_SEC && nowSec <= t + EMPHASIS_TAIL_SEC) {
          return 'glow'; // legacy default — matches previous boosted behavior
        }
      }
    }
    return null;
  }, [emphasisBeats, emphasisTimes, nowSec]);

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
        const isBoosted = isActive && activeIntensity !== null;
        const variant = isBoosted ? activeIntensity : null;
        const vcfg = variant ? cap.emphasisVariants[variant] : null;

        return (
          <span
            key={i}
            style={{
              color: isActive
                ? cap.activeColor
                : isPast
                ? cap.inactiveColor
                : cap.inactiveColor,
              transform: vcfg
                ? `scale(${vcfg.scale}) rotate(${vcfg.rotation}deg)`
                : isActive
                ? `scale(${cap.emphasisVariants.normal.scale})`
                : 'scale(1)',
              letterSpacing: vcfg ? vcfg.letterSpacing : '0px',
              transformOrigin: 'center',
              transition:
                'transform 120ms ease-out, text-shadow 120ms ease-out, letter-spacing 120ms ease-out',
              display: 'inline-block',
              textShadow: vcfg
                ? buildEmphasisShadow(vcfg.shadowBoost)
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

/**
 * Layered gold glow shadow on top of the base black drop shadow. Scale
 * driven by `shadowBoost` (0..1) so `pop` and `glow` variants share one
 * function with the right intensity.
 */
function buildEmphasisShadow(boost: number): string {
  const glow1 = 22 + boost * 18; // 22→40
  const glow1Alpha = 0.55 + boost * 0.4; // 0.55→0.95
  const glow2 = 44 + boost * 24; // 44→68
  const glow2Alpha = 0.25 + boost * 0.3; // 0.25→0.55
  return [
    `0 0 ${glow1}px rgba(255,181,1,${glow1Alpha.toFixed(2)})`,
    `0 0 ${glow2}px rgba(255,181,1,${glow2Alpha.toFixed(2)})`,
    '0 4px 16px rgba(0,0,0,0.9)',
    '0 2px 4px rgba(0,0,0,1)',
  ].join(', ');
}
