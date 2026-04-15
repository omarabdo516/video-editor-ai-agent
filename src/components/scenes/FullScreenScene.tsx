import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { Scene, SceneEntrance } from '../../types';
import { ProcessStepperScene } from './ProcessStepperScene';
import { ProcessTimelineScene } from './ProcessTimelineScene';
import { ComparisonTwoPathsScene } from './ComparisonTwoPathsScene';
import { BigMetaphorScene } from './BigMetaphorScene';
import { DefinitionScene } from './DefinitionScene';
import { EquationScene } from './EquationScene';
import { CounterScene } from './CounterScene';

type Props = { scene: Scene };

/**
 * Default entrance per scene body type. Phase 6 can override by setting
 * `scene.entrance` explicitly in the animation plan.
 */
const DEFAULT_ENTRANCE_BY_ELEMENT: Record<string, SceneEntrance> = {
  step_card: 'stagger_cascade',        // process_stepper: child cards do the work
  timeline_horizontal: 'stagger_cascade',
  comparison_two_paths: 'scale_bounce', // two columns bounce in
  big_metaphor: 'scale_bounce',         // payoff moment — impact
  definition: 'blur_reveal',            // term focuses into view
  equation: 'blur_reveal',              // math resolves
  counter: 'scale_bounce',              // number pops
};

function pickEntrance(scene: Scene): SceneEntrance {
  if (scene.entrance) return scene.entrance;
  for (const el of scene.elements) {
    const match = DEFAULT_ENTRANCE_BY_ELEMENT[el.type];
    if (match) return match;
  }
  return 'fade';
}

/**
 * FullScreenScene — wraps the scene body in a wrapper-level entrance
 * animation and delegates to the right body component. The wrapper
 * entrance (fade / scale_bounce / blur_reveal / stagger_cascade) is
 * chosen by `scene.entrance`, falling back to a sensible default per
 * body type. Internal element animations still run independently after
 * the wrapper settles.
 *
 * Dispatch is element-driven, not scene_type-driven — the scene's
 * element list determines the layout.
 */
export const FullScreenScene: React.FC<Props> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = Math.max(1, Math.round((scene.end_sec - scene.start_sec) * fps));
  const fadeOut = scene.transition_out?.frames ?? tokens.scenes.fadeOutFrames;
  const entrance = pickEntrance(scene);

  // Exit opacity — same gentle fade for all entrance types
  const exitOpacity = interpolate(
    frame,
    [totalFrames - fadeOut, totalFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Per-entrance enter transform + opacity
  const { enterOpacity, transform, filter } = computeEnterStyles(
    entrance,
    frame,
    fps,
    scene.transition_in?.frames,
  );

  const background = scene.background ?? tokens.scenes.defaultBackground;

  return (
    <AbsoluteFill
      style={{
        opacity: enterOpacity * exitOpacity,
        transform,
        filter,
        transformOrigin: 'center center',
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

/**
 * Computes the per-entrance wrapper styles for a given frame.
 * Returns enterOpacity (0..1), optional transform string, and optional
 * filter string.
 */
function computeEnterStyles(
  entrance: SceneEntrance,
  frame: number,
  fps: number,
  overrideFrames?: number,
): { enterOpacity: number; transform: string; filter: string } {
  const cfg = tokens.scenes.entrances;

  if (entrance === 'scale_bounce') {
    const dur = overrideFrames ?? cfg.scale_bounce.durationFrames;
    const springValue = spring({
      frame,
      fps,
      config: tokens.springs.bounce,
      durationInFrames: dur,
    });
    const scale =
      cfg.scale_bounce.scaleFrom +
      (cfg.scale_bounce.scaleTo - cfg.scale_bounce.scaleFrom) * springValue;
    const opacityValue = interpolate(
      frame,
      [0, Math.max(1, Math.floor(dur * 0.6))],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    return {
      enterOpacity: opacityValue,
      transform: `scale(${scale})`,
      filter: '',
    };
  }

  if (entrance === 'blur_reveal') {
    const dur = overrideFrames ?? cfg.blur_reveal.durationFrames;
    const t = interpolate(frame, [0, dur], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const blurPx =
      cfg.blur_reveal.blurFromPx +
      (cfg.blur_reveal.blurToPx - cfg.blur_reveal.blurFromPx) * t;
    return {
      enterOpacity: t,
      transform: 'none',
      filter: `blur(${blurPx.toFixed(2)}px)`,
    };
  }

  if (entrance === 'stagger_cascade') {
    const dur = overrideFrames ?? cfg.stagger_cascade.durationFrames;
    const opacityValue = interpolate(frame, [0, dur], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return {
      enterOpacity: opacityValue,
      transform: 'none',
      filter: '',
    };
  }

  // fade (default)
  const dur = overrideFrames ?? cfg.fade.durationFrames;
  const opacityValue = interpolate(frame, [0, dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return {
    enterOpacity: opacityValue,
    transform: 'none',
    filter: '',
  };
}

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
