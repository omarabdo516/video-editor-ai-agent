import React from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { tokens } from '../tokens';
import type { Scene, ZoomPlan } from '../types';

type Props = {
  scenes: Scene[];
  overlays: Array<{ id: string; start_sec: number; overlay_type: string }>;
  zoomPlan: ZoomPlan | null | undefined;
  lectureFrames: number;
};

/**
 * Phase 10 Round B — F1: SFX layer.
 *
 * Reads the animation plan (scenes + overlays + zoom plan) and drops a
 * short synthesized sound onto each event's timestamp. The individual
 * sounds are pink/brown noise whooshes + sine bursts — synthesized with
 * ffmpeg lavfi during build so they're copyright-free and fit in ~15 KB
 * total. Volumes are quiet (12-20%) so they feel like production polish,
 * not "the video is making noise."
 *
 * To mute all SFX at once: set `tokens.sfx.enabled = false`.
 *
 * Events wired:
 *   - scene_enter  : one per FullScreenScene, at scene.start_sec
 *   - keyword_pop  : one per keyword_highlight overlay
 *   - zoom_start   : one per big-zoom moment (skipped for mini zooms)
 *   - outro_swoosh : one at lectureFrames (transition into outro)
 */
export const SfxLayer: React.FC<Props> = ({
  scenes,
  overlays,
  zoomPlan,
  lectureFrames,
}) => {
  const { fps } = useVideoConfig();

  if (!tokens.sfx.enabled) return null;

  const cfg = tokens.sfx;
  const gv = cfg.globalVolume;

  // Build a list of absolute frame → sound descriptor tuples, then emit
  // a <Sequence><Audio /></Sequence> for each. Using Sequence.from=frame
  // is the canonical Remotion pattern for timed audio cues.
  type Cue = {
    key: string;
    fromFrame: number;
    file: string;
    volume: number;
  };
  const cues: Cue[] = [];

  // Scene enters
  for (const scene of scenes) {
    cues.push({
      key: `sfx_scene_${scene.id}`,
      fromFrame: Math.round(scene.start_sec * fps),
      file: cfg.events.scene_enter.file,
      volume: cfg.events.scene_enter.volume * gv,
    });
  }

  // Keyword overlays (only the ones marked as keyword_highlight)
  for (const ov of overlays) {
    if (ov.overlay_type !== 'keyword_highlight') continue;
    cues.push({
      key: `sfx_ov_${ov.id}`,
      fromFrame: Math.round(ov.start_sec * fps),
      file: cfg.events.keyword_pop.file,
      volume: cfg.events.keyword_pop.volume * gv,
    });
  }

  // Big zooms — filter out mini zooms (zoomLevel < 1.3 is our heuristic
  // for "mini", keeps the SFX tied to the punchy hero zooms only)
  if (zoomPlan && zoomPlan.moments.length > 0) {
    for (const m of zoomPlan.moments) {
      if (m.zoomLevel < 1.3) continue;
      cues.push({
        key: `sfx_zoom_${m.startSec.toFixed(2)}`,
        fromFrame: Math.round(m.startSec * fps),
        file: cfg.events.zoom_start.file,
        volume: cfg.events.zoom_start.volume * gv,
      });
    }
  }

  // Outro swoosh — fires right as the lecture section ends / outro starts
  cues.push({
    key: 'sfx_outro',
    fromFrame: Math.max(0, lectureFrames - 6), // lead in slightly so the
                                                // swoosh covers the transition
    file: cfg.events.outro_swoosh.file,
    volume: cfg.events.outro_swoosh.volume * gv,
  });

  return (
    <>
      {cues.map((cue) => (
        <Sequence
          key={cue.key}
          from={cue.fromFrame}
          // Long enough to play the entire clip; Audio auto-stops at EOF
          durationInFrames={Math.round(fps * 1.2)}
          layout="none"
        >
          <Audio src={staticFile(cue.file)} volume={cue.volume} />
        </Sequence>
      ))}
    </>
  );
};
