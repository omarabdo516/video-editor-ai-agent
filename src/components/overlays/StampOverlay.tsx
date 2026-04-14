import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { OverlayItem } from '../../types';

type Props = { overlay: OverlayItem };

/**
 * Stamp-style overlay — bordered text with a slight rotation, no background.
 * Used for keywords that should feel "stamped" or certified
 * (e.g. "تطبيق عملي" — RS core value).
 */
export const StampOverlay: React.FC<Props> = ({ overlay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = Math.max(
    1,
    Math.round((overlay.end_sec - overlay.start_sec) * fps),
  );
  const fade = tokens.overlays.fadeFrames;

  // Stamp-pop on enter (bouncy spring on scale)
  const popProgress = spring({
    frame,
    fps,
    config: tokens.springs.bounce,
  });

  // Fade out on exit
  const exitOpacity = interpolate(
    frame,
    [totalFrames - fade, totalFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const opacity = popProgress * exitOpacity;
  const scale = 0.6 + popProgress * 0.4; // 0.6 → 1.0

  const stamp = overlay.stamp_style ?? {};
  const rotation = stamp.rotation_deg ?? -3;
  const borderColor =
    overlay.text_color === 'accent'
      ? tokens.colors.accent
      : overlay.text_color || tokens.colors.accent;

  const y = overlay.y_px ?? tokens.overlays.defaultY + 20;

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
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          padding: stamp.padding ?? '14px 30px',
          border: stamp.border ?? `4px solid ${borderColor}`,
          borderRadius: stamp.border_radius ?? 8,
          transform: `rotate(${rotation}deg) scale(${scale})`,
          background: 'rgba(13, 31, 60, 0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          boxShadow: `0 12px 30px rgba(0,0,0,0.5), 0 0 0 1px ${borderColor}40`,
          direction: 'rtl',
        }}
      >
        <div
          style={{
            fontFamily: overlay.font || tokens.fonts.body,
            fontWeight: overlay.weight || 800,
            fontSize: overlay.size || 64,
            color: borderColor,
            letterSpacing: '-0.5px',
            textShadow: '0 2px 8px rgba(0,0,0,0.7)',
            lineHeight: 1,
          }}
        >
          {overlay.text || overlay.keyword || ''}
        </div>
      </div>
    </div>
  );
};
