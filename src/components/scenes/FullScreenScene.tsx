import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { Scene } from '../../types';
import { ProcessStepperScene } from './ProcessStepperScene';
import { ProcessTimelineScene } from './ProcessTimelineScene';
import { ComparisonTwoPathsScene } from './ComparisonTwoPathsScene';
import { BigMetaphorScene } from './BigMetaphorScene';
import { DefinitionScene } from './DefinitionScene';
import { EquationScene } from './EquationScene';
import { CounterScene } from './CounterScene';

type Props = { scene: Scene };

/**
 * FullScreenScene — wraps the scene in a fade-in/fade-out container and
 * delegates to the right body component. Dispatch is element-driven, not
 * scene_type-driven — the scene's element list determines the layout.
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
  // Element-driven dispatch — pick the body based on which element the scene
  // actually contains, not the loose scene_type string. This is more flexible:
  // a "process" scene_type could contain either a step_card list (→ stepper)
  // or a timeline_horizontal (→ timeline).
  const elementTypes = new Set(scene.elements.map((e) => e.type));

  if (elementTypes.has('step_card')) {
    return <ProcessStepperScene scene={scene} />;
  }
  if (elementTypes.has('timeline_horizontal')) {
    return <ProcessTimelineScene scene={scene} />;
  }
  if (elementTypes.has('comparison_two_paths')) {
    return <ComparisonTwoPathsScene scene={scene} />;
  }
  if (elementTypes.has('big_metaphor')) {
    return <BigMetaphorScene scene={scene} />;
  }
  if (elementTypes.has('definition')) {
    return <DefinitionScene scene={scene} />;
  }
  if (elementTypes.has('equation')) {
    return <EquationScene scene={scene} />;
  }
  if (elementTypes.has('counter')) {
    return <CounterScene scene={scene} />;
  }

  return <FallbackScene scene={scene} />;
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
