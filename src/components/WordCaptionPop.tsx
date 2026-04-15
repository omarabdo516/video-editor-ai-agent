import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../tokens';
import type { CaptionSegment } from '../types';

type Props = {
  segment: CaptionSegment;
  /** Seconds offset between this segment's timeline and the composition frame 0 */
  timeOffset?: number;
  /** Optional global emphasis times (re-uses same boost logic as Hormozi style) */
  emphasisTimes?: number[];
};

const EMPHASIS_LEAD_SEC = 0.15;
const EMPHASIS_TAIL_SEC = 0.30;

/**
 * WordCaptionPop — "Pop" caption style.
 *
 * Shows ONE huge word at a time, centered in the body zone. Each word
 * replaces the previous on its word-level timing boundary. Brief scale
 * bounce on entrance.
 *
 * This is the classic TikTok/Reels "word by word massive" style — the
 * lecturer's voice drives the rhythm, and the single word commands the
 * viewer's attention.
 *
 * Use when `animationPlan.caption_style === 'pop'`. Falls back to
 * WordCaption (Hormozi style) otherwise.
 */
export const WordCaptionPop: React.FC<Props> = ({
  segment,
  timeOffset = 0,
  emphasisTimes,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowSec = frame / fps + timeOffset;

  // Find the currently-active word in this segment
  const activeIdx = segment.words.findIndex(
    (w) => nowSec >= w.start && nowSec <= w.end,
  );
  if (activeIdx === -1) return null;
  const activeWord = segment.words[activeIdx];

  // Local frame relative to when THIS word started
  const wordStartFrame = Math.round((activeWord.start - timeOffset) * fps);
  const localFrame = Math.max(0, frame - wordStartFrame);

  // Punchy bounce in
  const bounceProgress = spring({
    frame: localFrame,
    fps,
    config: tokens.springs.bounce,
  });

  // Emphasis check (same logic as Hormozi style)
  const isEmphasisActive = React.useMemo(() => {
    if (!emphasisTimes || emphasisTimes.length === 0) return false;
    for (const t of emphasisTimes) {
      if (nowSec >= t - EMPHASIS_LEAD_SEC && nowSec <= t + EMPHASIS_TAIL_SEC) {
        return true;
      }
    }
    return false;
  }, [emphasisTimes, nowSec]);

  // Phase 10 Round B — F7: dynamic font size per WORD LENGTH (chars)
  // since Pop only ever shows one word at a time. Short punchy words
  // get bigger; long compound words shrink to avoid overflow.
  const baseSize = popSizeForWord(activeWord.word, 140);
  const size = isEmphasisActive ? baseSize * 1.15 : baseSize;

  // Position — body zone (y ≈ 900-1080), centered horizontally
  const y = 900;

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        direction: 'rtl',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: tokens.fonts.body,
          fontWeight: 800,
          fontSize: size,
          color: isEmphasisActive ? tokens.colors.accent : tokens.colors.white,
          lineHeight: 1,
          letterSpacing: '-2.5px',
          textAlign: 'center',
          transform: `scale(${0.55 + bounceProgress * 0.45}) rotate(${(1 - bounceProgress) * -2}deg)`,
          opacity: bounceProgress,
          textShadow: isEmphasisActive
            ? '0 0 30px rgba(255,181,1,0.85), 0 0 60px rgba(255,181,1,0.45), 0 8px 24px rgba(0,0,0,0.9)'
            : '0 8px 28px rgba(0,0,0,0.85), 0 4px 14px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,1)',
          padding: '14px 36px',
          background: isEmphasisActive
            ? 'rgba(13, 31, 60, 0.55)'
            : 'rgba(13, 31, 60, 0.4)',
          borderRadius: 20,
          border: isEmphasisActive
            ? `3px solid ${tokens.colors.accent}`
            : '2px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          whiteSpace: 'nowrap',
          maxWidth: 960,
        }}
      >
        {activeWord.word}
      </div>
    </div>
  );
};

/**
 * Phase 10 Round B — F7: char-count-driven font sizing for Pop style.
 * Keeps short/punchy words commanding and prevents long compound words
 * from overflowing the body zone.
 */
function popSizeForWord(word: string, baseSize: number): number {
  const len = word.length;
  if (len <= 3) return Math.round(baseSize * 1.18); // "هو"، "ده"
  if (len <= 5) return baseSize;                    // baseline
  if (len <= 8) return Math.round(baseSize * 0.88);
  return Math.round(baseSize * 0.76);               // long compounds
}
