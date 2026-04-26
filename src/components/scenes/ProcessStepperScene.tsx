import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens, getStaggerDelay } from '../../tokens';
import type { Scene, StepCardElement } from '../../types';

type Props = { scene: Scene };

/**
 * Vertically centered stack of step cards. Each card animates in with a
 * scale-up + slight rotation + delay, then the "current" card pulses its
 * accent glow continuously while visible.
 */
export const ProcessStepperScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cards = scene.elements.filter(
    (e): e is StepCardElement => e.type === 'step_card',
  );

  // Title slides down + scales in with bounce
  const titleProgress = spring({
    frame,
    fps,
    config: tokens.springs.bounce,
  });

  // Background shimmer â€” slow pulsing radial gradient under everything
  const bgPulse = (Math.sin(frame * 0.05) + 1) / 2; // 0..1

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 280, // clearance for the always-visible logo bug
        paddingBottom: 80,
        gap: 56,
      }}
    >
      {/* Background atmosphere â€” soft radial pulse */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 55%, rgba(255,181,1,${0.06 + bgPulse * 0.06}) 0%, transparent 55%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Title */}
      <div
        style={{
          fontFamily: scene.title_font ?? tokens.fonts.heading,
          fontWeight: scene.title_weight ?? 700,
          fontSize: scene.title_size ?? tokens.scenes.titleDefaultSize,
          color: tokens.colors.white,
          opacity: titleProgress,
          transform: `translateY(${(1 - titleProgress) * 36}px) scale(${0.85 + titleProgress * 0.15})`,
          letterSpacing: '-1.5px',
          textShadow: '0 2px 14px rgba(0,0,0,0.5), 0 0 40px rgba(255,181,1,0.15)',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {scene.title}
      </div>

      {/* Cards stack */}
      <div
        style={{
          width: tokens.scenes.stepCardWidth,
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.scenes.stepCardGap,
        }}
      >
        {cards.map((card, idx) => (
          <StepCard
            key={idx}
            card={card}
            frame={frame}
            fps={fps}
            index={idx}
            totalCards={cards.length}
          />
        ))}
      </div>
    </div>
  );
};

const StepCard: React.FC<{
  card: StepCardElement;
  frame: number;
  fps: number;
  index: number;
  totalCards: number;
}> = ({ card, frame, fps, index, totalCards }) => {
  // Dynamic stagger: wider spacing for few cards, tighter for many.
  // Phase 10 Round A â€” keeps total stagger time ~constant across counts.
  const perCardStep = getStaggerDelay(totalCards);
  const delay = card.stagger_delay_frames ?? 12 + index * perCardStep;
  const localFrame = Math.max(0, frame - delay);

  // Layered animation: scale + slide + slight rotation
  const enterProgress = spring({
    frame: localFrame,
    fps,
    config: tokens.springs.bounce,
  });

  // Continuous pulse glow on the "current" card (only, after its entrance)
  const isCurrent = card.status === 'current';
  const pulseT = Math.max(0, frame - delay - 18);
  const pulse = (Math.sin(pulseT * 0.12) + 1) / 2; // 0..1
  const glowIntensity = isCurrent ? 0.4 + pulse * 0.35 : 0;

  // Step number bounces in slightly after the card
  const numberProgress = spring({
    frame: Math.max(0, frame - delay - 6),
    fps,
    config: tokens.springs.bounce,
  });

  const accent = tokens.colors.accent;
  const white = tokens.colors.white;
  const dark = tokens.colors.dark;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: tokens.scenes.stepCardHeight,
        borderRadius: tokens.scenes.stepCardRadius,
        background: isCurrent
          ? `linear-gradient(135deg, ${accent} 0%, #FFCB47 100%)`
          : 'rgba(255,255,255,0.07)',
        border: isCurrent
          ? `4px solid ${accent}`
          : '2px solid rgba(255,255,255,0.18)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        opacity: enterProgress,
        transform: `translateY(${(1 - enterProgress) * 56}px) scale(${0.85 + enterProgress * 0.15}) rotate(${(1 - enterProgress) * -1.5}deg)`,
        boxShadow: isCurrent
          ? `0 18px 50px rgba(255, 181, 1, ${0.35 + glowIntensity * 0.3}), 0 0 0 ${6 + glowIntensity * 12}px rgba(255,181,1,${0.08 + glowIntensity * 0.1})`
          : '0 14px 36px rgba(0,0,0,0.32)',
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'row-reverse', // RTL
        padding: '0 36px',
        gap: 28,
        transition: 'box-shadow 0.1s linear',
      }}
    >
      {/* Step number circle (bounces in after the card) */}
      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: isCurrent ? dark : 'rgba(255,255,255,0.12)',
          color: isCurrent ? accent : white,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: tokens.fonts.heading,
          fontWeight: 700,
          fontSize: tokens.scenes.stepCardNumberSize,
          flexShrink: 0,
          border: isCurrent ? `3px solid ${accent}` : '2px solid rgba(255,255,255,0.22)',
          transform: `scale(${0.4 + numberProgress * 0.6})`,
          opacity: numberProgress,
          boxShadow: isCurrent ? `0 0 30px rgba(255,181,1,0.5)` : 'none',
        }}
      >
        {card.step}
      </div>

      {/* Label + status badge */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          gap: 8,
          alignItems: 'flex-start',
          opacity: numberProgress,
          transform: `translateX(${(1 - numberProgress) * -16}px)`,
        }}
      >
        <div
          style={{
            fontFamily: tokens.fonts.body,
            fontWeight: 700,
            fontSize: tokens.scenes.stepCardLabelSize,
            color: isCurrent ? dark : white,
            lineHeight: 1.05,
            letterSpacing: '-0.5px',
          }}
        >
          {card.label}
        </div>
        {card.status_badge && (
          <div
            style={{
              fontFamily: tokens.fonts.heading,
              fontSize: 30,
              fontWeight: 700,
              color: isCurrent ? dark : 'rgba(255,255,255,0.6)',
              opacity: 0.95,
            }}
          >
            {card.status_badge}
          </div>
        )}
      </div>
    </div>
  );
};
