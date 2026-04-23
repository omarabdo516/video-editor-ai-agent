import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { OverlayItem } from '../../types';

type Props = { overlay: OverlayItem };

/**
 * Floating text overlay — sits in the body zone (y=900 default), above
 * the lower-third and caption zone. Text floats without a background
 * card — a strong layered drop shadow keeps it legible against any
 * video frame.
 *
 * Supports:
 *  - single line: just `keyword`
 *  - two lines: `primary_text` (big accent) + `secondary_text` (small white)
 *  - optional `badge` in the top-right corner
 *
 * Fade-slide-down on enter, fade-slide-up on exit.
 *
 * History: earlier versions used a pill background with backdrop blur,
 * but Omar flagged that the card was visually covering the captions
 * underneath (and the default y=1140 intruded into the caption zone).
 * Rebuilt as a floating text block per the "avoid 1100-1460" safe-zone
 * rule.
 */
export const KeywordHighlightOverlay: React.FC<Props> = ({ overlay }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const totalFrames = Math.max(
    1,
    Math.round((overlay.end_sec - overlay.start_sec) * fps),
  );
  const fade = tokens.overlays.fadeFrames;

  const opacity = interpolate(
    frame,
    [0, fade, totalFrames - fade, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Slide down on enter, slide up on exit
  const slide = interpolate(
    frame,
    [0, fade, totalFrames - fade, totalFrames],
    [-tokens.overlays.slideOffsetPx, 0, 0, -tokens.overlays.slideOffsetPx],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const y = overlay.y_px ?? tokens.overlays.defaultY;

  // Determine layout: 1-line vs 2-line
  const hasPrimary = !!overlay.primary_text;
  const hasSecondary = !!overlay.secondary_text;
  const singleText = !hasPrimary ? overlay.keyword || overlay.text || '' : null;

  // Heavy layered shadow so gold text stays legible over any video
  // frame — replaces the old background card entirely.
  const TEXT_SHADOW = [
    '0 0 16px rgba(0,0,0,0.85)',
    '0 4px 18px rgba(0,0,0,0.75)',
    '0 2px 6px rgba(0,0,0,1)',
    '0 0 28px rgba(255,181,1,0.35)',
  ].join(', ');

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
          // No background / border / shadow card — the text floats.
          direction: 'rtl',
          textAlign: 'center',
          maxWidth: width - 200,
        }}
      >
        {/* Badge — still rendered when present (badges are for stamp-style
            callouts and stay useful even without a card) */}
        {overlay.badge && (
          <div
            style={{
              position: 'absolute',
              top: -28,
              right: -8,
              background: tokens.colors.accent,
              color: tokens.colors.dark,
              padding: '6px 14px',
              borderRadius: 6,
              fontFamily: tokens.fonts.heading,
              fontWeight: 800,
              fontSize: 24,
              letterSpacing: '0.5px',
              boxShadow: '0 6px 18px rgba(255, 181, 1, 0.5)',
              transform: 'rotate(4deg)',
            }}
          >
            {overlay.badge}
          </div>
        )}

        {/* Single-line variant */}
        {singleText && (
          <div
            style={{
              fontFamily: overlay.font || tokens.fonts.body,
              fontWeight: overlay.weight || 800,
              fontSize: overlay.size || tokens.overlays.defaultPrimarySize,
              color:
                overlay.text_color === 'accent'
                  ? tokens.colors.accent
                  : overlay.text_color || tokens.colors.accent,
              lineHeight: 1.1,
              textShadow: TEXT_SHADOW,
            }}
          >
            {singleText}
          </div>
        )}

        {/* Two-line variant */}
        {hasPrimary && (
          <div style={{ display: 'inline-block', position: 'relative' }}>
            <div
              style={{
                fontFamily: tokens.fonts.body,
                fontWeight: overlay.primary_weight || 800,
                fontSize: overlay.primary_size || 64,
                color:
                  overlay.primary_color === 'accent'
                    ? tokens.colors.accent
                    : overlay.primary_color || tokens.colors.accent,
                lineHeight: 1.1,
                textShadow: TEXT_SHADOW,
                letterSpacing: '-0.5px',
              }}
            >
              {overlay.primary_text}
            </div>
            {/* Accent underline — subtle gold bar below the primary text */}
            <div
              style={{
                position: 'absolute',
                bottom: -6,
                left: '15%',
                right: '15%',
                height: 3,
                borderRadius: 2,
                background: `linear-gradient(90deg, transparent, ${tokens.colors.accent}, transparent)`,
                opacity: 0.7,
              }}
            />
          </div>
        )}

        {hasSecondary && (
          <div
            style={{
              marginTop: 8,
              fontFamily: tokens.fonts.heading,
              fontWeight: overlay.secondary_weight || 600,
              fontSize: overlay.secondary_size || tokens.overlays.defaultSecondarySize,
              color:
                overlay.secondary_color === 'accent'
                  ? tokens.colors.accent
                  : overlay.secondary_color || tokens.colors.white,
              opacity: 0.95,
              lineHeight: 1.2,
              textShadow:
                '0 0 12px rgba(0,0,0,0.85), 0 3px 10px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,1)',
            }}
          >
            {overlay.secondary_text}
          </div>
        )}
      </div>
    </div>
  );
};
