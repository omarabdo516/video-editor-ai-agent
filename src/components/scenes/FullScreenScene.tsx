import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { Scene } from '../../types';
import { ProcessStepperScene } from './ProcessStepperScene';
import { ProcessTimelineScene } from './ProcessTimelineScene';
import { ComparisonTwoPathsScene } from './ComparisonTwoPathsScene';
import { BigMetaphorScene } from './BigMetaphorScene';

type Props = { scene: Scene };

/**
 * FullScreenScene — wraps the scene in a fade-in/fade-out container and
 * delegates to the right body component based on `scene.scene_type`.
 *
 * The `frame` here is local to the parent <Sequence> (which starts at the
 * scene's start_sec). Children should also use `useCurrentFrame()` and treat
 * frame 0 as the scene start.
 */
export const FullScreenScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = Math.max(1, Math.round((scene.end_sec - scene.start_sec) * fps));
  const fadeIn = scene.transition_in?.frames ?? tokens.scenes.fadeInFrames;
  const fadeOut = scene.transition_out?.frames ?? tokens.scenes.fadeOutFrames;

  const opacity = interpolate(
    frame,
    [0, fadeIn, totalFrames - fadeOut, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const background = scene.background ?? tokens.scenes.defaultBackground;

  return (
    <AbsoluteFill
      style={{
        opacity,
        background,
        direction: 'rtl',
        fontFamily: tokens.fonts.heading,
        color: tokens.colors.white,
        overflow: 'hidden',
      }}
    >
      <SceneBody scene={scene} />
    </AbsoluteFill>
  );
};

const SceneBody: React.FC<Props> = ({ scene }) => {
  switch (scene.scene_type) {
    case 'process':
      // The plan uses scene_type 'process' for both stepper and timeline.
      // Disambiguate by looking at the scene's elements.
      if (scene.elements.some((e) => e.type === 'timeline_horizontal')) {
        return <ProcessTimelineScene scene={scene} />;
      }
      return <ProcessStepperScene scene={scene} />;

    case 'tip':
    case 'comparison':
      // Same heuristic — comparison uses 'comparison_two_paths' element,
      // big metaphor uses 'big_metaphor' element
      if (scene.elements.some((e) => e.type === 'comparison_two_paths')) {
        return <ComparisonTwoPathsScene scene={scene} />;
      }
      if (scene.elements.some((e) => e.type === 'big_metaphor')) {
        return <BigMetaphorScene scene={scene} />;
      }
      return <FallbackScene scene={scene} />;

    default:
      return <FallbackScene scene={scene} />;
  }
};

const FallbackScene: React.FC<Props> = ({ scene }) => (
  <AbsoluteFill
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 80,
    }}
  >
    <div
      style={{
        fontSize: 56,
        color: tokens.colors.white,
        fontWeight: 700,
        textAlign: 'center',
        textShadow: '0 2px 8px rgba(0,0,0,0.6)',
      }}
    >
      {scene.title || scene.id}
    </div>
  </AbsoluteFill>
);
