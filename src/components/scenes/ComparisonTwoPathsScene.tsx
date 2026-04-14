import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { Scene, ComparisonTwoPathsElement, TwoPathsSide } from '../../types';

type Props = { scene: Scene };

/**
 * Side-by-side comparison (wrong path vs right path), vertically centered.
 * The right (✓) column slides up from the right, then the left (✗) from
 * the left after a stagger. The accent side pulses to draw the eye.
 */
export const ComparisonTwoPathsScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const cmp = scene.elements.find(
    (e): e is ComparisonTwoPathsElement => e.type === 'comparison_two_paths',
  );
  if (!cmp) return null;

  const titleProgress = spring({ frame, fps, config: tokens.springs.bounce });
  const stagger = cmp.stagger_delay_frames ?? 22;

  const colWidth = (width - 100 * 2 - 50) / 2; // 100px safe each side, 50 gap

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
        paddingBottom: 80,
        gap: 64,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: scene.title_font ?? tokens.fonts.heading,
          fontWeight: scene.title_weight ?? 700,
          fontSize: scene.title_size ?? 72,
          color: tokens.colors.white,
          opacity: titleProgress,
          transform: `translateY(${(1 - titleProgress) * 36}px) scale(${0.88 + titleProgress * 0.12})`,
          letterSpacing: '-1.2px',
          textShadow: '0 2px 14px rgba(0,0,0,0.5), 0 0 40px rgba(255,181,1,0.18)',
          padding: '0 80px',
          lineHeight: 1.12,
          textAlign: 'center',
          margin: 0,
        }}
      >
        {scene.title}
      </div>

      {/* Two columns. RTL: right column appears first (visual right). */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row-reverse',
          gap: 50,
          width: colWidth * 2 + 50,
        }}
      >
        <PathColumn
          side={cmp.right}
          frame={frame}
          fps={fps}
          delayFrame={0}
          width={colWidth}
          isAccent
        />
        <PathColumn
          side={cmp.left}
          frame={frame}
          fps={fps}
          delayFrame={stagger}
          width={colWidth}
        />
      </div>
    </div>
  );
};

const PathColumn: React.FC<{
  side: TwoPathsSide;
  frame: number;
  fps: number;
  delayFrame: number;
  width: number;
  isAccent?: boolean;
}> = ({ side, frame, fps, delayFrame, width, isAccent }) => {
  const localFrame = Math.max(0, frame - delayFrame);
  const progress = spring({
    frame: localFrame,
    fps,
    config: tokens.springs.bounce,
  });

  // Icon bounces in slightly after the column
  const iconProgress = spring({
    frame: Math.max(0, localFrame - 8),
    fps,
    config: tokens.springs.bounce,
  });

  // Continuous pulse on the accent column
  const pulseT = Math.max(0, localFrame - 20);
  const pulse = isAccent ? (Math.sin(pulseT * 0.1) + 1) / 2 : 0;

  const labelColor = isAccent ? tokens.colors.accent : 'rgba(255,255,255,0.55)';
  const stepColor = isAccent ? tokens.colors.white : 'rgba(255,255,255,0.5)';

  return (
    <div
      style={{
        flex: '1 1 0',
        width,
        opacity: progress,
        transform: `translateY(${(1 - progress) * 40}px) scale(${0.92 + progress * 0.08})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        borderRadius: 28,
        background: isAccent
          ? `rgba(255, 181, 1, ${0.08 + pulse * 0.05})`
          : 'rgba(255,255,255,0.035)',
        border: isAccent
          ? `3px solid rgba(255, 181, 1, ${0.55 + pulse * 0.2})`
          : '2px solid rgba(255,255,255,0.12)',
        padding: '36px 24px 30px',
        boxShadow: isAccent
          ? `0 24px 60px rgba(255,181,1,${0.18 + pulse * 0.12}), 0 0 0 ${6 + pulse * 8}px rgba(255,181,1,${0.05 + pulse * 0.05})`
          : '0 18px 42px rgba(0,0,0,0.35)',
      }}
    >
      {/* Icon circle */}
      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: isAccent
            ? `radial-gradient(circle at 35% 30%, #FFCB47, ${tokens.colors.accent})`
            : 'rgba(255,255,255,0.12)',
          border: `4px solid ${isAccent ? tokens.colors.accent : 'rgba(255,255,255,0.38)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 66,
          fontWeight: 800,
          color: isAccent ? tokens.colors.dark : tokens.colors.white,
          marginBottom: 6,
          transform: `scale(${0.3 + iconProgress * 0.7})`,
          opacity: iconProgress,
          boxShadow: isAccent ? '0 16px 36px rgba(255,181,1,0.5)' : 'none',
        }}
      >
        {side.icon === 'check' ? '✓' : side.icon === 'x' ? '✗' : '?'}
      </div>

      {/* Label */}
      <div
        style={{
          fontFamily: tokens.fonts.heading,
          fontWeight: 800,
          fontSize: 44,
          color: labelColor,
          textAlign: 'center',
          marginBottom: 16,
          letterSpacing: '-0.5px',
          opacity: iconProgress,
        }}
      >
        {side.label}
      </div>

      {/* Steps stack (each fades in with its own delay) */}
      {side.steps.map((step, idx) => {
        const isHighlight = step === side.highlight;
        const isArrow = step === '↓';
        const stepDelay = 14 + idx * 4;
        const stepProgress = spring({
          frame: Math.max(0, localFrame - stepDelay),
          fps,
          config: tokens.springs.enter,
        });
        return (
          <div
            key={idx}
            style={{
              fontFamily: tokens.fonts.body,
              fontWeight: isHighlight ? 800 : isArrow ? 800 : 600,
              fontSize: isHighlight ? 40 : isArrow ? 34 : 32,
              color: isHighlight
                ? side.highlight_color === 'accent'
                  ? tokens.colors.accent
                  : tokens.colors.white
                : isArrow
                ? 'rgba(255,255,255,0.45)'
                : stepColor,
              opacity: stepProgress * (isHighlight && side.highlight_opacity ? side.highlight_opacity : 1),
              transform: `translateY(${(1 - stepProgress) * 8}px)`,
              textAlign: 'center',
              lineHeight: 1.1,
              padding: isHighlight ? '8px 16px' : 0,
              borderRadius: isHighlight ? 10 : 0,
              background:
                isHighlight && side.highlight_color === 'accent'
                  ? 'rgba(255,181,1,0.15)'
                  : 'transparent',
              textShadow: isHighlight ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
            }}
          >
            {step}
          </div>
        );
      })}
    </div>
  );
};
