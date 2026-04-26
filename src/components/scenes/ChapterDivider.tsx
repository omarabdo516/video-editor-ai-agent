import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { tokens } from '../../tokens';
import type { ChapterDivider as ChapterDividerData } from '../../types';

// Horizontal underline path (0 â†’ 300 wide, centered around 0,0 via viewBox)
const UNDERLINE_PATH = 'M 0 0 L 300 0';

type Props = { divider: ChapterDividerData };

/**
 * ChapterDivider â€” brief full-screen section break. 2-3 seconds total:
 * fade in â†’ title slides up with bounce â†’ subtitle fades in â†’ hold â†’ fade out.
 *
 * Lighter than a full scene â€” doesn't cover the lecturer for long.
 * Used to mark topic shifts in a reel.
 */
export const ChapterDivider: React.FC<Props> = ({ divider }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = Math.max(
    1,
    Math.round((divider.end_sec - divider.start_sec) * fps),
  );
  const fadeIn = 10;
  const fadeOut = 10;

  const containerOpacity = interpolate(
    frame,
    [0, fadeIn, totalFrames - fadeOut, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Kicker slides in from right (RTL)
  const kickerProgress = spring({
    frame: Math.max(0, frame - 2),
    fps,
    config: tokens.springs.enter,
  });

  // Title bounces in
  const titleProgress = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: tokens.springs.bounce,
  });

  // Subtitle fades in
  const subtitleProgress = spring({
    frame: Math.max(0, frame - 16),
    fps,
    config: tokens.springs.enter,
  });

  // Underline sweeps in â€” draws as an SVG stroke with evolvePath
  const underlineProgress = interpolate(frame, [10, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const underlineEvolve = evolvePath(underlineProgress, UNDERLINE_PATH);

  const background =
    divider.background ??
    `linear-gradient(135deg, ${tokens.colors.dark} 0%, ${tokens.colors.primary} 100%)`;

  return (
    <AbsoluteFill
      style={{
        opacity: containerOpacity,
        background,
        direction: 'rtl',
        fontFamily: tokens.fonts.heading,
        color: tokens.colors.white,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 280, // logo clearance
        paddingBottom: 80,
        gap: 18,
      }}
    >
      {/* Background accent ring */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 1400,
          height: 1400,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, rgba(255,181,1,0.12) 0%, transparent 45%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Kicker (small accent label above title) */}
      {divider.kicker && (
        <div
          style={{
            fontFamily: tokens.fonts.heading,
            fontWeight: 600,
            fontSize: 34,
            color: tokens.colors.accent,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            opacity: kickerProgress,
            transform: `translateX(${(1 - kickerProgress) * -40}px)`,
          }}
        >
          {divider.kicker}
        </div>
      )}

      {/* Big title */}
      <div
        style={{
          fontFamily: tokens.fonts.heading,
          fontWeight: 700,
          fontSize: 96,
          color: tokens.colors.white,
          textAlign: 'center',
          lineHeight: 1.1,
          letterSpacing: '-1.8px',
          opacity: titleProgress,
          transform: `translateY(${(1 - titleProgress) * 30}px) scale(${0.85 + titleProgress * 0.15})`,
          textShadow: '0 6px 24px rgba(0,0,0,0.55), 0 0 40px rgba(255,181,1,0.15)',
          padding: '0 80px',
          margin: 0,
        }}
      >
        {divider.title}
      </div>

      {/* Accent underline â€” drawn with @remotion/paths evolvePath so the
          stroke draws in left-to-right instead of scaling from zero width */}
      <svg
        width={320}
        height={14}
        viewBox="-10 -7 320 14"
        style={{
          marginTop: 12,
          overflow: 'visible',
          filter: 'drop-shadow(0 0 14px rgba(255,181,1,0.7))',
        }}
      >
        <path
          d={UNDERLINE_PATH}
          stroke={tokens.colors.accent}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={underlineEvolve.strokeDasharray}
          strokeDashoffset={underlineEvolve.strokeDashoffset}
        />
      </svg>

      {/* Subtitle */}
      {divider.subtitle && (
        <div
          style={{
            fontFamily: tokens.fonts.heading,
            fontWeight: 500,
            fontSize: 40,
            color: 'rgba(255,255,255,0.8)',
            textAlign: 'center',
            lineHeight: 1.3,
            maxWidth: 840,
            opacity: subtitleProgress * 0.95,
            transform: `translateY(${(1 - subtitleProgress) * 16}px)`,
            padding: '0 80px',
            marginTop: 8,
          }}
        >
          {divider.subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};
