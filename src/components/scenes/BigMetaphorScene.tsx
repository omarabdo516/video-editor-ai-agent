import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { makeCircle } from '@remotion/shapes';
import { fitText } from '@remotion/layout-utils';
import { tokens } from '../../tokens';
import type { Scene, BigMetaphorElement } from '../../types';

const CIRCLE_BACKDROP = makeCircle({ radius: 320 });

type Props = { scene: Scene };

/**
 * Closing payoff scene: massive headline pops in with bounce, subline fades
 * up after it, footer line drifts in last. The headline pulses subtly after
 * its entrance to keep the moment alive.
 */
export const BigMetaphorScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const el = scene.elements.find(
    (e): e is BigMetaphorElement => e.type === 'big_metaphor',
  );
  if (!el) return null;

  const headlineProgress = spring({ frame, fps, config: tokens.springs.bounce });

  // Continuous subtle pulse on the headline after it lands
  const headlinePulseT = Math.max(0, frame - 18);
  const headlinePulse = (Math.sin(headlinePulseT * 0.14) + 1) / 2; // 0..1

  const sublineDelay = el.subline_delay_frames ?? 20;
  const sublineProgress = spring({
    frame: Math.max(0, frame - sublineDelay),
    fps,
    config: tokens.springs.enter,
  });

  const footerDelay = el.footer_delay_frames ?? 38;
  const footerProgress = spring({
    frame: Math.max(0, frame - footerDelay),
    fps,
    config: tokens.springs.enter,
  });

  // Background: slow-rotating radial glow behind the headline
  const bgAngle = frame * 0.3;
  const bgPulse = (Math.sin(frame * 0.04) + 1) / 2;

  const headlineColor =
    el.headline_color === 'accent' ? tokens.colors.accent : tokens.colors.white;
  const sublineColor =
    el.subline_color === 'accent' ? tokens.colors.accent : tokens.colors.white;
  const footerColor =
    el.footer_color === 'accent' ? tokens.colors.accent : tokens.colors.white;

  // Impact burst — brief accent flash around headline entrance (frames 0-18)
  const burstOpacity = interpolate(frame, [0, 6, 18], [0, 1, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Auto-fit the headline to its available width — prevents overflow when
  // Phase 6 picks a longer punchline than the hardcoded font size assumed.
  const HEADLINE_MAX_WIDTH = 920;
  const requestedSize = el.headline_size || 110;
  const fitted = fitText({
    text: el.headline,
    withinWidth: HEADLINE_MAX_WIDTH,
    fontFamily: el.headline_font || tokens.fonts.body,
    fontWeight: el.headline_weight || 800,
  });
  // Cap at the requested size (so short words don't blow up huge)
  const headlineSize = Math.min(requestedSize, Math.floor(fitted.fontSize));

  // Absolute positioning so decorative shapes + Trail experiments can't
  // push the text out of place. Anchor the headline around the vertical
  // center, subline right below, footer near the bottom safe area.
  const HEADLINE_CENTER_Y = 900;
  const SUBLINE_CENTER_Y = 1120;
  const FOOTER_CENTER_Y = 1560;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Background: slow rotating radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 47%, rgba(255,181,1,${0.08 + bgPulse * 0.08}) 0%, transparent 60%)`,
          transform: `rotate(${bgAngle}deg)`,
          pointerEvents: 'none',
        }}
      />

      {/* Subtle dashed circle for depth — centered on the headline zone */}
      <svg
        width={CIRCLE_BACKDROP.width}
        height={CIRCLE_BACKDROP.height}
        viewBox={`0 0 ${CIRCLE_BACKDROP.width} ${CIRCLE_BACKDROP.height}`}
        style={{
          position: 'absolute',
          top: HEADLINE_CENTER_Y,
          left: '50%',
          transform: `translate(-50%, -50%) scale(${0.9 + headlinePulse * 0.05}) rotate(${frame * 0.2}deg)`,
          pointerEvents: 'none',
          opacity: 0.14 + headlinePulse * 0.08,
        }}
      >
        <path
          d={CIRCLE_BACKDROP.path}
          fill="none"
          stroke={tokens.colors.accent}
          strokeWidth={3}
          strokeDasharray="14 20"
        />
      </svg>

      {/* Impact burst — flash around the headline as it lands */}
      <div
        style={{
          position: 'absolute',
          top: HEADLINE_CENTER_Y,
          left: '50%',
          width: 1200,
          height: 420,
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(ellipse, rgba(255,181,1,0.5) 0%, transparent 65%)',
          opacity: burstOpacity * 0.55,
          pointerEvents: 'none',
        }}
      />

      {/* Headline — the giant phrase */}
      <div
        style={{
          position: 'absolute',
          top: HEADLINE_CENTER_Y,
          left: '50%',
          transform: `translate(-50%, -50%) scale(${0.62 + headlineProgress * 0.38}) rotate(${(1 - headlineProgress) * -3}deg)`,
          width: HEADLINE_MAX_WIDTH,
          fontFamily: el.headline_font || tokens.fonts.body,
          fontWeight: el.headline_weight || 800,
          fontSize: headlineSize,
          color: headlineColor,
          textAlign: 'center',
          lineHeight: 1.1,
          letterSpacing: '-2px',
          opacity: headlineProgress,
          textShadow: `0 8px 36px rgba(0,0,0,0.55), 0 4px 14px rgba(0,0,0,0.65), 0 0 ${40 + headlinePulse * 30}px rgba(255,181,1,${0.3 + headlinePulse * 0.2})`,
        }}
      >
        {el.headline}
      </div>

      {/* Subline — context */}
      {el.subline && (
        <div
          style={{
            position: 'absolute',
            top: SUBLINE_CENTER_Y,
            left: '50%',
            width: 900,
            transform: `translate(-50%, -50%) translateY(${(1 - sublineProgress) * 28}px)`,
            fontFamily: el.subline_font || tokens.fonts.heading,
            fontWeight: el.subline_weight || 500,
            fontSize: el.subline_size || 40,
            color: sublineColor,
            textAlign: 'center',
            lineHeight: 1.35,
            opacity: sublineProgress,
            textShadow: '0 2px 10px rgba(0,0,0,0.55), 0 0 18px rgba(0,0,0,0.4)',
          }}
        >
          {el.subline}
        </div>
      )}

      {/* Footer — the takeaway */}
      {el.footer_label && (
        <div
          style={{
            position: 'absolute',
            top: FOOTER_CENTER_Y,
            left: '50%',
            width: 880,
            transform: `translate(-50%, -50%) translateY(${(1 - footerProgress) * 14}px)`,
            textAlign: 'center',
            fontFamily: tokens.fonts.heading,
            fontWeight: 600,
            fontSize: el.footer_size || 34,
            color: footerColor,
            opacity: footerProgress * (el.footer_opacity ?? 0.9),
            letterSpacing: '0.3px',
            textShadow: '0 2px 8px rgba(0,0,0,0.55)',
          }}
        >
          {el.footer_label}
        </div>
      )}
    </div>
  );
};
