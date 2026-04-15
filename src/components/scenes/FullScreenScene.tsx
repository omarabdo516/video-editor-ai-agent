import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../../tokens';
import type { Scene, SceneEntrance, SceneExit } from '../../types';
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

/** Default exit per body type (Tier 2). Mirrors entrance mood. */
const DEFAULT_EXIT_BY_ELEMENT: Record<string, SceneExit> = {
  step_card: 'slide_down',         // cards drift away
  timeline_horizontal: 'slide_down',
  comparison_two_paths: 'scale_out',
  big_metaphor: 'scale_out',       // punches toward viewer
  definition: 'fade',              // calm
  equation: 'fade',                // calm
  counter: 'scale_out',
};

function pickEntrance(scene: Scene): SceneEntrance {
  if (scene.entrance) return scene.entrance;
  for (const el of scene.elements) {
    const match = DEFAULT_ENTRANCE_BY_ELEMENT[el.type];
    if (match) return match;
  }
  return 'fade';
}

function pickExit(scene: Scene): SceneExit {
  if (scene.exit) return scene.exit;
  for (const el of scene.elements) {
    const match = DEFAULT_EXIT_BY_ELEMENT[el.type];
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
  const entrance = pickEntrance(scene);
  const exit = pickExit(scene);

  // Per-entrance enter transform + opacity
  const { enterOpacity, transform: enterTransform, filter } = computeEnterStyles(
    entrance,
    frame,
    fps,
    scene.transition_in?.frames,
  );

  // Per-exit transform + opacity
  const { exitOpacity, transform: exitTransform } = computeExitStyles(
    exit,
    frame,
    totalFrames,
    scene.transition_out?.frames,
  );

  const transform = combineTransforms(enterTransform, exitTransform);
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
 * Combines an enter transform with an exit transform. Both are single-op
 * CSS transforms ('none' | 'scale(x)' | 'translateY(ypx)'); we multiply
 * by space-concatenation in the natural case, and collapse 'none' to
 * avoid an extraneous string.
 */
function combineTransforms(a: string, b: string): string {
  if (a === 'none' || a === '') return b === 'none' ? 'none' : b;
  if (b === 'none' || b === '') return a;
  return `${a} ${b}`;
}

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

/**
 * Per-exit styles. Mirrors computeEnterStyles — runs only in the last
 * N frames of the scene. Returns exitOpacity (0..1, falling) and a
 * transform delta that gets composed with the enter transform.
 */
function computeExitStyles(
  exit: SceneExit,
  frame: number,
  totalFrames: number,
  overrideFrames?: number,
): { exitOpacity: number; transform: string } {
  const cfg = tokens.scenes.exits;

  if (exit === 'scale_out') {
    const dur = overrideFrames ?? cfg.scale_out.durationFrames;
    const start = totalFrames - dur;
    const t = interpolate(frame, [start, totalFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const scale =
      cfg.scale_out.scaleFrom +
      (cfg.scale_out.scaleTo - cfg.scale_out.scaleFrom) * t;
    const opacityValue = interpolate(frame, [start, totalFrames], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    // Don't apply the scale transform until the exit window actually starts —
    // otherwise scale(1.0) collides with the enter transform.
    return {
      exitOpacity: opacityValue,
      transform: t > 0 ? `scale(${scale})` : 'none',
    };
  }

  if (exit === 'slide_down') {
    const dur = overrideFrames ?? cfg.slide_down.durationFrames;
    const start = totalFrames - dur;
    const t = interpolate(frame, [start, totalFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const ty =
      cfg.slide_down.translateYFromPx +
      (cfg.slide_down.translateYToPx - cfg.slide_down.translateYFromPx) * t;
    const opacityValue = interpolate(frame, [start, totalFrames], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return {
      exitOpacity: opacityValue,
      transform: t > 0 ? `translateY(${ty.toFixed(1)}px)` : 'none',
    };
  }

  // fade (default)
  const dur = overrideFrames ?? cfg.fade.durationFrames;
  const start = totalFrames - dur;
  const opacityValue = interpolate(frame, [start, totalFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return {
    exitOpacity: opacityValue,
    transform: 'none',
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
