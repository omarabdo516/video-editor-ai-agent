import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { tokens } from '../../tokens';
import type { OverlayItem } from '../../types';

type Props = { overlay: OverlayItem };

/**
 * Pill overlay that lives BELOW the captions (y=1620 default), in the
 * narrow safe band above Instagram's bottom UI. Animates with a smooth
 * slide-up + fade on enter and a gentle continued slide-up + fade on
 * exit â€” feels like a callout chip rising from beneath the captions.
 *
 * Supports:
 *  - single line: just `keyword`
 *  - two lines: `primary_text` (big accent) + `secondary_text` (small white)
 *  - optional `badge` in the top-right corner
 *
 * History (v1): card above captions â€” covered the speaker's face. v2:
 * floating text at y=1080 â€” still felt cluttered around the speaker.
 * v3 (this version): pill-card below captions with slide-up animation.
 */
export const KeywordHighlightOverlay: React.FC<Props> = ({ overlay }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const totalFrames = Math.max(
    1,
    Math.round((overlay.end_sec - overlay.start_sec) * fps),
  );
  const fade = tokens.overlays.fadeFrames;
  const slideOffset = tokens.overlays.slideOffsetPx;

  // Eased fade-in / fade-out (cubic out-in) â€” buttery edges, no pop
  const opacity = interpolate(
    frame,
    [0, fade, totalFrames - fade, totalFrames],
    [0, 1, 1, 0],
    {
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  // Slide UP on enter (start below by +slideOffset, settle at 0).
  // Slide further UP on exit (drift upward by -slideOffset/2 while fading).
  const slide = interpolate(
    frame,
    [0, fade, totalFrames - fade, totalFrames],
    [slideOffset, 0, 0, -slideOffset / 2],
    {
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  const y = overlay.y_px ?? tokens.overlays.defaultY;

  // Determine layout: 1-line vs 2-line
  const hasPrimary = !!overlay.primary_text;
  const hasSecondary = !!overlay.secondary_text;
  const singleText = !hasPrimary ? overlay.keyword || overlay.text || '' : null;

  const accent = tokens.colors.accent;
  const white = tokens.colors.white;

  // Heavy text shadow + soft dark backdrop blur so the text reads cleanly
  // against any video frame, without looking like a "card" overlay.
  const TEXT_SHADOW = [
    '0 0 18px rgba(0,0,0,0.92)',
    '0 4px 18px rgba(0,0,0,0.85)',
    '0 2px 6px rgba(0,0,0,1)',
  ].join(', ');

  // Vertical accent bar grows in height as it fades in (a subtle reveal)
  const barGrow = interpolate(
    frame,
    [0, fade, totalFrames - fade, totalFrames],
    [0.2, 1, 1, 0.85],
    {
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  // Helper: detect whether a string is mostly numeric (digits, dots, hyphens)
  const isNumeric = (s: string) => /^[\d\s.,/:×x*+\-–—]+$/.test(s);

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity,
        transform: `translateY(${slide}px)`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          direction: 'rtl',
          maxWidth: width - 200,
          display: 'flex',
          // direction:rtl + flexDirection:row → first DOM item (bar) sits
          // on the RIGHT (the RTL leading edge). row-reverse here was a bug
          // that double-flipped and put the bar on the wrong side.
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 22,
          // Soft radial backdrop — barely visible but anchors the text
          // against busy backgrounds. Edges fade fully transparent.
          padding: '16px 28px',
        }}
      >
        {/* Soft radial backdrop (no hard edges, no border, no card look) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.20) 55%, rgba(0,0,0,0) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Vertical accent bar — leading edge (right in RTL) */}
        <div
          style={{
            position: 'relative',
            width: 6,
            background: `linear-gradient(180deg, ${accent} 0%, #FFCB47 100%)`,
            borderRadius: 3,
            transform: `scaleY(${barGrow})`,
            transformOrigin: 'center',
            boxShadow: '0 0 16px rgba(255,181,1,0.6)',
            flexShrink: 0,
          }}
        />

        {/* Text column */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {/* Badge — small pill above the text */}
          {overlay.badge && (
            <div
              style={{
                background: accent,
                color: tokens.colors.dark,
                padding: '3px 10px',
                borderRadius: 5,
                fontFamily: tokens.fonts.heading,
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: '0.5px',
                marginBottom: 4,
              }}
            >
              {overlay.badge}
            </div>
          )}

          {/* Single-line variant */}
          {singleText && (
            <div
              style={{
                fontFamily: isNumeric(singleText)
                  ? tokens.numericFont
                  : (overlay.font || tokens.fonts.body),
                fontWeight: overlay.weight || 900,
                fontSize: overlay.size || tokens.overlays.defaultPrimarySize,
                color: overlay.text_color === 'accent' ? accent : (overlay.text_color || accent),
                lineHeight: 1.0,
                letterSpacing: '-0.5px',
                textShadow: TEXT_SHADOW,
              }}
            >
              {singleText}
            </div>
          )}

          {/* Primary line (two-line variant) */}
          {hasPrimary && (
            <div
              style={{
                fontFamily: isNumeric(overlay.primary_text!)
                  ? tokens.numericFont
                  : tokens.fonts.body,
                fontWeight: overlay.primary_weight || 900,
                fontSize: overlay.primary_size || tokens.overlays.defaultPrimarySize,
                color:
                  overlay.primary_color === 'accent'
                    ? accent
                    : overlay.primary_color || accent,
                lineHeight: 1.0,
                letterSpacing: '-0.5px',
                textShadow: TEXT_SHADOW,
              }}
            >
              {overlay.primary_text}
            </div>
          )}

          {hasSecondary && (
            <div
              style={{
                fontFamily: isNumeric(overlay.secondary_text!)
                  ? tokens.numericFont
                  : tokens.fonts.heading,
                fontWeight: overlay.secondary_weight || 600,
                fontSize: overlay.secondary_size || tokens.overlays.defaultSecondarySize,
                color:
                  overlay.secondary_color === 'accent'
                    ? accent
                    : overlay.secondary_color || white,
                opacity: 0.95,
                lineHeight: 1.15,
                letterSpacing: '0.1px',
                textShadow:
                  '0 0 12px rgba(0,0,0,0.85), 0 3px 10px rgba(0,0,0,0.75), 0 2px 4px rgba(0,0,0,1)',
              }}
            >
              {overlay.secondary_text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
