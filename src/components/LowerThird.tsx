import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { tokens } from '../tokens';

type Props = {
  name: string;
  title: string;
};

export const LowerThird: React.FC<Props> = ({ name, title }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const lt = tokens.lowerThird;

  const startFrame = Math.round(lt.startDelaySec * fps);
  const endFrame = Math.round((lt.startDelaySec + lt.durationSec) * fps);
  const slideFrames = Math.round(lt.slideDurationSec * fps);

  if (frame < startFrame || frame > endFrame + slideFrames) return null;

  // Slide in from the right (RTL), hold, slide out to the left
  const local = frame - startFrame;
  const slideIn = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  const outLocal = frame - endFrame;
  const slideOut =
    outLocal > 0
      ? interpolate(outLocal, [0, slideFrames], [0, -1], {
          extrapolateRight: 'clamp',
        })
      : 0;

  const translateX = (1 - slideIn) * (width + lt.barWidth) + slideOut * (width + lt.barWidth);
  const opacity = interpolate(local, [0, 6], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: (width - lt.barWidth) / 2,
        top: lt.y,
        width: lt.barWidth,
        background: `linear-gradient(135deg, ${tokens.colors.primary} 0%, #0D2E6B 100%)`,
        borderRadius: 18,
        boxShadow: '0 14px 40px rgba(16, 71, 157, 0.5), 0 0 0 2px rgba(255,181,1,0.25) inset',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        direction: 'rtl',
        fontFamily: tokens.fonts.heading,
        transform: `translateX(${translateX}px)`,
        opacity,
        padding: `${lt.barPaddingV + 6}px ${lt.barPaddingH}px`,
      }}
    >
      <div
        style={{
          color: tokens.colors.white,
          fontSize: lt.nameSize,
          fontWeight: 800,
          letterSpacing: '-0.5px',
          lineHeight: 1.15,
          textAlign: 'center',
        }}
      >
        {name}
      </div>
      <div
        style={{
          color: tokens.colors.accent,
          fontSize: lt.titleSize,
          fontWeight: 600,
          marginTop: 16,
          letterSpacing: '0.3px',
          lineHeight: 1.15,
          textAlign: 'center',
        }}
      >
        {title}
      </div>
    </div>
  );
};
