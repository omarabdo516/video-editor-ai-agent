import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { Scene, BigMetaphorElement } from '../../types';

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

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 280, // logo clearance
        paddingBottom: 100,
        gap: 44,
      }}
    >
      {/* Background: slow rotating radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, rgba(255,181,1,${0.08 + bgPulse * 0.08}) 0%, transparent 60%)`,
          transform: `rotate(${bgAngle}deg)`,
          pointerEvents: 'none',
        }}
      />

      {/* Impact burst — a flash of accent glow around the headline as it lands */}
      <div
        style={{
          position: 'absolute',
          top: '46%',
          left: '50%',
          width: 1200,
          height: 400,
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(ellipse, rgba(255,181,1,0.5) 0%, transparent 65%)',
          opacity: burstOpacity * 0.6,
          pointerEvents: 'none',
        }}
      />

      {/* Headline — the giant phrase */}
      <div
        style={{
          fontFamily: el.headline_font || tokens.fonts.body,
          fontWeight: el.headline_weight || 800,
          fontSize: el.headline_size || 110,
          color: headlineColor,
          textAlign: 'center',
          lineHeight: 1.05,
          letterSpacing: '-2.5px',
          opacity: headlineProgress,
          transform: `scale(${0.6 + headlineProgress * 0.4}) rotate(${(1 - headlineProgress) * -3}deg)`,
          textShadow: `0 8px 36px rgba(0,0,0,0.45), 0 4px 14px rgba(0,0,0,0.6), 0 0 ${40 + headlinePulse * 30}px rgba(255,181,1,${0.25 + headlinePulse * 0.2})`,
          margin: 0,
          padding: '0 60px',
        }}
      >
        {el.headline}
      </div>

      {/* Subline — context */}
      {el.subline && (
        <div
          style={{
            fontFamily: el.subline_font || tokens.fonts.heading,
            fontWeight: el.subline_weight || 500,
            fontSize: el.subline_size || 40,
            color: sublineColor,
            textAlign: 'center',
            lineHeight: 1.3,
            maxWidth: 860,
            opacity: sublineProgress * 0.95,
            transform: `translateY(${(1 - sublineProgress) * 28}px)`,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            padding: '0 40px',
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
            bottom: 240,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: tokens.fonts.heading,
            fontWeight: 600,
            fontSize: el.footer_size || 34,
            color: footerColor,
            opacity: footerProgress * (el.footer_opacity ?? 0.9),
            transform: `translateY(${(1 - footerProgress) * 14}px)`,
            padding: '0 80px',
            letterSpacing: '0.3px',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          {el.footer_label}
        </div>
      )}
    </div>
  );
};
