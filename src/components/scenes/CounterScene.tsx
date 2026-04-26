import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { Scene, CounterElement } from '../../types';

type Props = { scene: Scene };

/**
 * CounterScene â€” massive number that counts up from 0 to `value` with
 * ease-out interpolation. Optional top + bottom labels. Used for
 * statistics, social proof, or "+50,000 Ù…Ø­Ø§Ø³Ø¨ Ø§ØªØ¯Ø±Ù‘Ø¨".
 *
 * The number itself does the heavy lifting visually â€” don't add too many
 * decorative elements around it. Big, centered, bouncy.
 */
export const CounterScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const el = scene.elements.find(
    (e): e is CounterElement => e.type === 'counter',
  );
  if (!el) return null;

  const duration = el.duration_frames ?? 45; // 1.5s default

  // Count-up interpolation with ease-out
  const rawCount = interpolate(frame, [0, duration], [0, el.value], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3), // ease-out cubic
  });
  const displayCount = Math.floor(rawCount);

  // Number scale bounce at entrance
  const scaleProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90, mass: 1 },
  });

  // Labels fade in first
  const topLabelProgress = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: tokens.springs.enter,
  });
  const bottomLabelProgress = spring({
    frame: Math.max(0, frame - duration + 8), // fade in near the end
    fps,
    config: tokens.springs.enter,
  });

  // Continuous pulse after counter lands
  const pulseT = Math.max(0, frame - duration);
  const pulse = (Math.sin(pulseT * 0.15) + 1) / 2;
  const isLanded = frame >= duration;

  // Format the number with thousands separators
  const formatted = formatNumber(displayCount);

  // Background atmosphere
  const bgPulse = (Math.sin(frame * 0.05) + 1) / 2;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 280,
        paddingBottom: 80,
        gap: 32,
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, rgba(255,181,1,${0.1 + bgPulse * 0.08 + (isLanded ? pulse * 0.08 : 0)}) 0%, transparent 55%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Top label */}
      {el.label_top && (
        <div
          style={{
            fontFamily: tokens.fonts.heading,
            fontWeight: 600,
            fontSize: 42,
            color: 'rgba(255,255,255,0.85)',
            textAlign: 'center',
            letterSpacing: '0.3px',
            opacity: topLabelProgress,
            transform: `translateY(${(1 - topLabelProgress) * 14}px)`,
            padding: '0 80px',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          {el.label_top}
        </div>
      )}

      {/* The giant number */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'center',
          direction: 'ltr',
          gap: 12,
        }}
      >
        {el.prefix && (
          <span
            style={{
              fontFamily: tokens.fonts.body,
              fontWeight: 700,
              fontSize: 90,
              color: tokens.colors.accent,
              opacity: 0.85,
            }}
          >
            {el.prefix}
          </span>
        )}
        <span
          style={{
            fontFamily: tokens.fonts.body,
            fontWeight: 700,
            fontSize: 180,
            color: tokens.colors.accent,
            lineHeight: 1,
            letterSpacing: '-4px',
            transform: `scale(${0.6 + scaleProgress * 0.4})`,
            textShadow: `0 10px 40px rgba(0,0,0,0.45), 0 0 ${50 + pulse * 30}px rgba(255,181,1,${0.3 + pulse * 0.2}), 0 4px 14px rgba(0,0,0,0.7)`,
            display: 'inline-block',
          }}
        >
          {formatted}
        </span>
        {el.suffix && (
          <span
            style={{
              fontFamily: tokens.fonts.body,
              fontWeight: 700,
              fontSize: 100,
              color: tokens.colors.accent,
              marginLeft: 4,
              transform: `scale(${0.6 + scaleProgress * 0.4})`,
              display: 'inline-block',
            }}
          >
            {el.suffix}
          </span>
        )}
      </div>

      {/* Bottom label */}
      {el.label_bottom && (
        <div
          style={{
            fontFamily: tokens.fonts.heading,
            fontWeight: 700,
            fontSize: 48,
            color: tokens.colors.white,
            textAlign: 'center',
            letterSpacing: '-0.5px',
            opacity: bottomLabelProgress,
            transform: `translateY(${(1 - bottomLabelProgress) * 20}px)`,
            padding: '0 80px',
            textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            lineHeight: 1.15,
            maxWidth: 860,
          }}
        >
          {el.label_bottom}
        </div>
      )}
    </div>
  );
};

function formatNumber(n: number): string {
  // Use English digits per brand spec (no Ù¡Ù¢Ù£)
  return n.toLocaleString('en-US');
}
