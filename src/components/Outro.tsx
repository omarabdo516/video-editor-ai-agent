import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../tokens';

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const taglineOpacity = interpolate(frame, [10, 24], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 35%, #1a5fbf 0%, ${tokens.colors.primary} 55%, #061838 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        direction: 'rtl',
        fontFamily: tokens.fonts.heading,
      }}
    >
      <Img
        src={staticFile('logo.png')}
        style={{
          width: tokens.outro.logoWidth * appear,
          height: 'auto',
          filter: 'drop-shadow(0 12px 30px rgba(0,0,0,0.4))',
          marginBottom: 70,
        }}
      />
      <div
        style={{
          color: tokens.colors.accent,
          fontSize: tokens.outro.taglineSize,
          fontWeight: 700,
          textAlign: 'center',
          letterSpacing: '-0.5px',
          opacity: taglineOpacity,
          transform: `translateY(${(1 - taglineOpacity) * 18}px)`,
        }}
      >
        {tokens.outro.tagline}
      </div>
    </AbsoluteFill>
  );
};
