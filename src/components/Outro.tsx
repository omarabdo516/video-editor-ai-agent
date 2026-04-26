import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { tokens } from '../tokens';
import { SocialIcon, SOCIAL_ORDER } from './SocialIcons';

const fadeSlideUp = (
  frame: number,
  from: number,
  to: number,
  travelPx = 24,
) => {
  const p = interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * travelPx}px)`,
  };
};

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoAppear = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const taglineStyle = fadeSlideUp(frame, 10, 26, 18);
  const ctaPrimaryStyle = fadeSlideUp(frame, 22, 40, 28);
  const ctaSubStyle = fadeSlideUp(frame, 32, 48, 18);
  const websiteStyle = fadeSlideUp(frame, 46, 62, 22);

  const iconBaseStart = 60;
  const iconStagger = 4;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 32%, #1a5fbf 0%, ${tokens.colors.primary} 55%, #061838 100%)`,
        direction: 'rtl',
        fontFamily: tokens.fonts.heading,
      }}
    >
      {/* Logo */}
      <Img
        src={staticFile('logo.png')}
        style={{
          position: 'absolute',
          top: 340,
          left: '50%',
          width: tokens.outro.logoWidth * logoAppear,
          height: 'auto',
          transform: 'translateX(-50%)',
          filter: 'drop-shadow(0 12px 30px rgba(0,0,0,0.4))',
        }}
      />

      {/* Tagline */}
      <div
        style={{
          position: 'absolute',
          top: 640,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: tokens.colors.accent,
          fontSize: tokens.outro.taglineSize,
          fontWeight: 700,
          letterSpacing: '-0.5px',
          ...taglineStyle,
        }}
      >
        {tokens.outro.tagline}
      </div>

      {/* CTA Primary */}
      <div
        style={{
          position: 'absolute',
          top: 820,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: tokens.colors.white,
          fontFamily: tokens.fonts.body,
          fontSize: tokens.outro.ctaPrimarySize,
          fontWeight: 700,
          lineHeight: 1.15,
          textShadow: '0 4px 16px rgba(0,0,0,0.5)',
          ...ctaPrimaryStyle,
        }}
      >
        {tokens.outro.ctaPrimary}
      </div>

      {/* CTA Subtext */}
      <div
        style={{
          position: 'absolute',
          top: 930,
          left: 80,
          right: 80,
          textAlign: 'center',
          color: tokens.colors.white,
          fontSize: tokens.outro.ctaSubtextSize,
          fontWeight: 500,
          lineHeight: 1.4,
          transform: ctaSubStyle.transform,
          opacity: 0.9 * ctaSubStyle.opacity,
        }}
      >
        {tokens.outro.ctaSubtext}
      </div>

      {/* Website */}
      <div
        style={{
          position: 'absolute',
          top: 1110,
          left: 0,
          right: 0,
          textAlign: 'center',
          direction: 'ltr',
          color: tokens.colors.accent,
          fontFamily: tokens.fonts.body,
          fontSize: tokens.outro.websiteSize,
          fontWeight: 700,
          letterSpacing: '-0.5px',
          textShadow: '0 4px 18px rgba(255,181,1,0.35)',
          ...websiteStyle,
        }}
      >
        {tokens.outro.website}
      </div>

      {/* Social Icons Row */}
      <div
        style={{
          position: 'absolute',
          top: 1320,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: tokens.outro.socialIconGap,
          direction: 'ltr',
        }}
      >
        {SOCIAL_ORDER.map((platform, i) => {
          const iconStart = iconBaseStart + i * iconStagger;
          const pop = spring({
            frame: frame - iconStart,
            fps,
            config: { damping: 12, stiffness: 170 },
          });
          const opacity = interpolate(
            frame,
            [iconStart, iconStart + 8],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          return (
            <div
              key={platform}
              style={{
                width: tokens.outro.socialIconSize,
                height: tokens.outro.socialIconSize,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.08)',
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${pop})`,
                opacity,
                boxShadow: '0 6px 22px rgba(0,0,0,0.35)',
              }}
            >
              <SocialIcon
                platform={platform}
                size={Math.round(tokens.outro.socialIconSize * 0.55)}
                color={tokens.colors.white}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
