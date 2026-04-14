import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { OverlayItem } from '../../types';

type Props = { overlay: OverlayItem };

/**
 * Pill-style overlay positioned at top-center. Supports:
 *  - single line: just `keyword`
 *  - two lines: `primary_text` (big accent) + `secondary_text` (small white)
 *  - optional `badge` in the top-right corner
 *
 * Fade-slide-down on enter, fade-slide-up on exit.
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
  const padX = tokens.overlays.defaultPaddingX;
  const padY = tokens.overlays.defaultPaddingY;

  // Determine layout: 1-line vs 2-line
  const hasPrimary = !!overlay.primary_text;
  const hasSecondary = !!overlay.secondary_text;
  const singleText = !hasPrimary ? overlay.keyword || overlay.text || '' : null;

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
          background: overlay.background ?? 'rgba(13, 31, 60, 0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: overlay.background_radius ?? tokens.overlays.defaultRadius,
          padding: overlay.background_padding ?? `${padY}px ${padX}px`,
          border: `2px solid rgba(255, 181, 1, 0.35)`,
          boxShadow: '0 18px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
          direction: 'rtl',
          textAlign: 'center',
          maxWidth: width - 200,
        }}
      >
        {/* Badge in top-right (RTL: right side) */}
        {overlay.badge && (
          <div
            style={{
              position: 'absolute',
              top: -16,
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
              textShadow: '0 2px 6px rgba(0,0,0,0.6)',
            }}
          >
            {singleText}
          </div>
        )}

        {/* Two-line variant */}
        {hasPrimary && (
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
              textShadow: '0 2px 6px rgba(0,0,0,0.6)',
              letterSpacing: '-0.5px',
            }}
          >
            {overlay.primary_text}
          </div>
        )}

        {hasSecondary && (
          <div
            style={{
              marginTop: 6,
              fontFamily: tokens.fonts.heading,
              fontWeight: overlay.secondary_weight || 500,
              fontSize: overlay.secondary_size || tokens.overlays.defaultSecondarySize,
              color:
                overlay.secondary_color === 'accent'
                  ? tokens.colors.accent
                  : overlay.secondary_color || tokens.colors.white,
              opacity: 0.92,
              lineHeight: 1.2,
            }}
          >
            {overlay.secondary_text}
          </div>
        )}
      </div>
    </div>
  );
};
