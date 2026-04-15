import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
} from 'remotion';
import { VideoTrack } from './components/VideoTrack';
import { VideoBreathing } from './components/VideoBreathing';
import { ProgressBar } from './components/ProgressBar';
import { SfxLayer } from './components/SfxLayer';
import { WordCaption } from './components/WordCaption';
import { WordCaptionPop } from './components/WordCaptionPop';
import { WordCaptionKaraoke } from './components/WordCaptionKaraoke';
import { WordCaptionBox } from './components/WordCaptionBox';
import { WordCaptionTypewriter } from './components/WordCaptionTypewriter';
import { WordCaptionClassic } from './components/WordCaptionClassic';
import { LogoBug } from './components/LogoBug';
import { LowerThird } from './components/LowerThird';
import { Outro } from './components/Outro';
import { SmartZoom } from './components/SmartZoom';
import { FullScreenScene } from './components/scenes/FullScreenScene';
import { ChapterDivider } from './components/scenes/ChapterDivider';
import { Overlay } from './components/overlays/Overlay';
import { MicroEventHost } from './components/micro/MicroEventHost';
import { rechunkCaptions } from './utils/chunk';
import { tokens } from './tokens';
import type {
  ReelProps,
  Scene,
  ZoomPlan,
  ZoomMoment,
  MicroEvent,
  MiniZoomMicroEvent,
  WordPopMicroEvent,
  EmphasisBeat,
  EmphasisIntensity,
  ChapterDivider as ChapterDividerData,
  CaptionStyle,
  CaptionStyleRange,
} from './types';

/** Maps a style name → the component that renders it. */
const CAPTION_COMPONENTS = {
  hormozi: WordCaption,
  pop: WordCaptionPop,
  karaoke: WordCaptionKaraoke,
  box: WordCaptionBox,
  typewriter: WordCaptionTypewriter,
  classic: WordCaptionClassic,
} as const satisfies Record<CaptionStyle, React.FC<{
  segment: import('./types').CaptionSegment;
  timeOffset?: number;
  emphasisTimes?: number[];
  emphasisBeats?: EmphasisBeat[];
}>>;

/**
 * Normalizes a word_pop's loose `intensity` string into the WordCaption
 * variant enum. Phase 6 can emit 'low'/'medium'/'high' or the enum
 * directly — both paths resolve to the same three variants.
 */
function resolveEmphasisIntensity(raw: string | undefined): EmphasisIntensity {
  if (!raw) return 'glow';
  const s = raw.toLowerCase();
  if (s === 'normal' || s === 'low') return 'normal';
  if (s === 'pop' || s === 'medium') return 'pop';
  if (s === 'glow' || s === 'high') return 'glow';
  return 'glow';
}

/** Picks the right caption style for a caption segment given the plan. */
function resolveCaptionStyle(
  segStart: number,
  segEnd: number,
  defaultStyle: CaptionStyle,
  ranges: CaptionStyleRange[] | undefined,
): CaptionStyle {
  if (!ranges || ranges.length === 0) return defaultStyle;
  const mid = (segStart + segEnd) / 2;
  for (const r of ranges) {
    if (mid >= r.start_sec && mid < r.end_sec) return r.style;
  }
  return defaultStyle;
}

/** Returns true if `t` (seconds) falls inside any scene window. */
function isInAnyScene(t: number, scenes: Scene[]): boolean {
  for (const s of scenes) {
    if (t >= s.start_sec && t < s.end_sec) return true;
  }
  return false;
}

const LOGO_Z_INDEX = 1000; // Logo bug must sit above scenes (per user feedback)

/**
 * Merges Tier 2 `mini_zoom` micro-events into the Tier 1 smart_zoom_plan so
 * the existing SmartZoom component can render both in one pass. Mini zooms
 * that collide with existing big-zoom windows are dropped.
 */
function mergeMiniZoomsIntoPlan(
  plan: ZoomPlan | null,
  microEvents: MicroEvent[],
): ZoomPlan | null {
  const miniZooms = microEvents.filter(
    (e): e is MiniZoomMicroEvent => e.type === 'mini_zoom',
  );
  if (miniZooms.length === 0) return plan;

  const existingMoments: ZoomMoment[] = plan?.moments ?? [];
  const merged: ZoomMoment[] = [...existingMoments];

  for (const mz of miniZooms) {
    // Drop if window overlaps any existing big-zoom moment
    const overlaps = existingMoments.some(
      (m) => !(mz.end_sec < m.startSec || mz.start_sec > m.endSec),
    );
    if (overlaps) continue;
    merged.push({
      startSec: mz.start_sec,
      endSec: mz.end_sec,
      zoomLevel: mz.zoom_level,
      centerX: mz.center_x,
      centerY: mz.center_y,
      reason: `mini (${mz.intensity ?? 'low'}): ${mz.anchor_text ?? ''}`.slice(0, 80),
    });
  }

  merged.sort((a, b) => a.startSec - b.startSec);
  return {
    source: plan?.source,
    spring: plan?.spring,
    moments: merged,
  };
}

export const Reel: React.FC<ReelProps> = ({
  videoSrc,
  captions,
  lecturer,
  workshop,
  zoomPlan,
  animationPlan,
}) => {
  const { fps } = useVideoConfig();

  // Pick smart-zoom data: prefer the plan inside animationPlan, fall back to the
  // legacy `zoomPlan` prop (still used by the standalone zoom_plan.json path).
  const baseZoomPlan: ZoomPlan | null =
    animationPlan?.smart_zoom_plan ?? zoomPlan ?? null;

  const scenes: Scene[] = animationPlan?.scenes ?? [];
  const overlays = animationPlan?.overlays ?? [];
  const microEvents: MicroEvent[] = animationPlan?.micro_events ?? [];
  const chapterDividers: ChapterDividerData[] = animationPlan?.chapter_dividers ?? [];
  const captionStyle: CaptionStyle = animationPlan?.caption_style ?? 'hormozi';
  const captionStyleRanges = animationPlan?.caption_style_ranges;

  // Merge mini-zoom micro-events into the smart-zoom plan so they render
  // through the existing SmartZoom transform path.
  const effectiveZoomPlan = React.useMemo(
    () => mergeMiniZoomsIntoPlan(baseZoomPlan, microEvents),
    [baseZoomPlan, microEvents],
  );

  // Extract word_pop beats — each beat carries its own intensity so the
  // caption picks the right variant (normal / pop / glow). Phase 10
  // Round A: emphasis differentiation lives on the same gold color —
  // variation is scale + letter-spacing + shadow boost.
  const emphasisBeats = React.useMemo<EmphasisBeat[]>(
    () =>
      microEvents
        .filter((e): e is WordPopMicroEvent => e.type === 'word_pop')
        .map((e) => ({
          time: (e.start_sec + e.end_sec) / 2,
          intensity: resolveEmphasisIntensity(e.intensity),
        })),
    [microEvents],
  );

  // Captions get cut into 6-word chunks. Then we drop any chunk whose midpoint
  // falls inside a scene window — captions shouldn't show through scene art.
  const chunked = React.useMemo(
    () => rechunkCaptions(captions, tokens.captions.wordsPerChunk, 3),
    [captions],
  );

  const visibleCaptionSegments = React.useMemo(() => {
    // Captions should hide during both full-screen scenes AND chapter dividers
    const hideWindows: Array<{ start_sec: number; end_sec: number }> = [
      ...scenes,
      ...chapterDividers,
    ];
    if (hideWindows.length === 0) return chunked.segments;
    return chunked.segments.filter((seg) => {
      const mid = (seg.start + seg.end) / 2;
      for (const w of hideWindows) {
        if (mid >= w.start_sec && mid < w.end_sec) return false;
      }
      return true;
    });
  }, [chunked, scenes, chapterDividers]);

  const lectureFrames = Math.round(captions.totalDuration * fps);
  const outroFrames = Math.round(tokens.outro.durationSec * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Main lecture section */}
      <Sequence from={0} durationInFrames={lectureFrames}>
        {/* Bottom layer — video with (1) Tier 3 breathing + (2) Tier 1/2 zoom */}
        <SmartZoom plan={effectiveZoomPlan}>
          <VideoBreathing>
            <VideoTrack src={videoSrc} />
          </VideoBreathing>
        </SmartZoom>

        {/* Lower third — only fires once at the start, scenes start later */}
        <LowerThird name={lecturer} title={workshop} />

        {/* Captions — already filtered to skip scenes. Each segment gets the
            emphasis beats that fall inside its window so its WordCaption can
            pick the right variant for the currently-active word. */}
        {visibleCaptionSegments.map((seg, idx) => {
          const fromFrame = Math.round(seg.start * fps);
          const segDurFrames = Math.max(1, Math.round((seg.end - seg.start) * fps));
          const segBeats = emphasisBeats.filter(
            (b) => b.time >= seg.start - 0.3 && b.time <= seg.end + 0.3,
          );
          // Pick the caption style for THIS segment — a range-based override
          // wins over the plan-wide default when it covers this segment's mid.
          const segStyle = resolveCaptionStyle(
            seg.start,
            seg.end,
            captionStyle,
            captionStyleRanges,
          );
          const CaptionComponent = CAPTION_COMPONENTS[segStyle];
          return (
            <Sequence
              key={`cap_${idx}`}
              from={fromFrame}
              durationInFrames={segDurFrames}
              name={`cap_${idx}_${segStyle}`}
            >
              <CaptionComponent
                segment={seg}
                timeOffset={seg.start}
                emphasisBeats={segBeats}
              />
            </Sequence>
          );
        })}

        {/* Tier 2 micro-events — word pops, underlines, accent flashes. Skip
            any whose midpoint lands in a scene (scene art covers them). */}
        {microEvents.map((ev) => {
          if (ev.type === 'mini_zoom') return null; // handled via SmartZoom
          const mid = (ev.start_sec + ev.end_sec) / 2;
          if (isInAnyScene(mid, scenes)) return null;
          const fromFrame = Math.round(ev.start_sec * fps);
          const durFrames = Math.max(
            1,
            Math.round((ev.end_sec - ev.start_sec) * fps),
          );
          return (
            <Sequence
              key={ev.id}
              from={fromFrame}
              durationInFrames={durFrames}
              name={`micro_${ev.id}`}
            >
              <MicroEventHost event={ev} />
            </Sequence>
          );
        })}

        {/* Overlays — render above captions/micro but below scenes */}
        {overlays.map((ov) => {
          const fromFrame = Math.round(ov.start_sec * fps);
          const durFrames = Math.max(
            1,
            Math.round((ov.end_sec - ov.start_sec) * fps),
          );
          return (
            <Sequence
              key={ov.id}
              from={fromFrame}
              durationInFrames={durFrames}
              name={`overlay_${ov.id}`}
            >
              <Overlay overlay={ov} />
            </Sequence>
          );
        })}

        {/* Full-screen scenes — cover the lecturer video, but stay BELOW the
            logo bug (which renders after scenes on top of everything) */}
        {scenes.map((scene) => {
          const fromFrame = Math.round(scene.start_sec * fps);
          const durFrames = Math.max(
            1,
            Math.round((scene.end_sec - scene.start_sec) * fps),
          );
          return (
            <Sequence
              key={scene.id}
              from={fromFrame}
              durationInFrames={durFrames}
              name={`scene_${scene.id}`}
            >
              <FullScreenScene scene={scene} />
            </Sequence>
          );
        })}

        {/* Chapter dividers — lightweight full-screen section breaks */}
        {chapterDividers.map((divider) => {
          const fromFrame = Math.round(divider.start_sec * fps);
          const durFrames = Math.max(
            1,
            Math.round((divider.end_sec - divider.start_sec) * fps),
          );
          return (
            <Sequence
              key={divider.id}
              from={fromFrame}
              durationInFrames={durFrames}
              name={`chapter_${divider.id}`}
            >
              <ChapterDivider divider={divider} />
            </Sequence>
          );
        })}

        {/* Phase 10 Round B F1 — SFX layer. Drops short synthesized sounds
            on each visual event (scene enter, keyword overlay, big zoom,
            outro handoff). Muted when tokens.sfx.enabled = false. */}
        <SfxLayer
          scenes={scenes}
          overlays={overlays}
          zoomPlan={effectiveZoomPlan}
          lectureFrames={lectureFrames}
        />

        {/* Phase 10 Round B F3 — progress bar. Sits above scenes (z=900)
            but below the logo bug (z=1000). Repositioned to y=210 so it
            lives inside the top safe area, clear of the platform UI. */}
        <ProgressBar totalFrames={lectureFrames} />

        {/* Logo bug — render LAST so it sits above scenes. Per user feedback,
            the logo must remain visible throughout the entire reel including
            during full-screen scenes. */}
        <div style={{ position: 'absolute', inset: 0, zIndex: LOGO_Z_INDEX, pointerEvents: 'none' }}>
          <LogoBug />
        </div>
      </Sequence>

      {/* Outro */}
      <Sequence from={lectureFrames} durationInFrames={outroFrames}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
