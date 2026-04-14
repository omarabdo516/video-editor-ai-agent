import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import { useSubtitleStore } from '../store/useSubtitleStore';
import {
  DEFAULT_WAVEFORM_ZOOM,
  MAX_WAVEFORM_ZOOM,
  MIN_WAVEFORM_ZOOM,
  REGION_COLOR_ACTIVE,
  REGION_COLOR_NORMAL,
  REGION_COLOR_SELECTED,
} from '../utils/constants';

/** wavesurfer Region — narrow type so we don't have to import internals */
type WSRegion = {
  id: string;
  start: number;
  end: number;
  setOptions: (opts: { color?: string; start?: number; end?: number }) => void;
  remove: () => void;
};

type RegionsPluginInstance = ReturnType<typeof RegionsPlugin.create>;

export function WaveformTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPluginInstance | null>(null);
  const regionMapRef = useRef<Map<string, WSRegion>>(new Map());

  const [zoom, setZoom] = useState(DEFAULT_WAVEFORM_ZOOM);
  const [isReady, setIsReady] = useState(false);

  const videoUrl = useSubtitleStore((s) => s.videoUrl);
  const subtitles = useSubtitleStore((s) => s.subtitles);
  const selectedId = useSubtitleStore((s) => s.selectedId);
  const currentTime = useSubtitleStore((s) => s.currentTime);
  const updateTiming = useSubtitleStore((s) => s.updateTiming);
  const selectSubtitle = useSubtitleStore((s) => s.selectSubtitle);
  const setCurrentTime = useSubtitleStore((s) => s.setCurrentTime);

  /* ─── Init wavesurfer ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || !timelineRef.current || !videoUrl) return;

    // Create plugin instances per wavesurfer instance — they can't be reused
    const regions = RegionsPlugin.create();
    const timeline = TimelinePlugin.create({
      container: timelineRef.current,
      height: 22,
      insertPosition: 'beforebegin',
      timeInterval: 5,
      primaryLabelInterval: 10,
      style: {
        fontSize: '11px',
        color: '#9ca0ac',
      },
    });

    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: videoUrl,
      waveColor: '#3a3d4d',
      progressColor: '#10479d',
      cursorColor: '#ffb501',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      height: 100,
      normalize: true,
      interact: true,
      backend: 'WebAudio',
      plugins: [regions, timeline],
    });

    wsRef.current = ws;
    regionsPluginRef.current = regions;

    ws.on('ready', () => {
      ws.zoom(zoom);
      setIsReady(true);
    });

    // When user clicks the waveform, sync the playhead
    ws.on('interaction', (newTime: number) => {
      setCurrentTime(newTime);
    });

    return () => {
      regionMapRef.current.clear();
      try {
        ws.destroy();
      } catch {
        // ignore destruction errors during HMR
      }
      wsRef.current = null;
      regionsPluginRef.current = null;
      setIsReady(false);
    };
    // We deliberately re-init wavesurfer when the videoUrl changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  /* ─── Sync zoom slider → wavesurfer ────────────────────────────────── */
  useEffect(() => {
    if (isReady && wsRef.current) {
      wsRef.current.zoom(zoom);
    }
  }, [zoom, isReady]);

  /* ─── Sync store currentTime → wavesurfer playhead ─────────────────── */
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    const wsTime = ws.getCurrentTime();
    if (Math.abs(wsTime - currentTime) > 0.05) {
      ws.setTime(currentTime);
    }
  }, [currentTime, isReady]);

  /* ─── Sync subtitles → regions ─────────────────────────────────────── */
  useEffect(() => {
    const regions = regionsPluginRef.current;
    if (!regions || !isReady) return;

    const map = regionMapRef.current;
    const seenIds = new Set<string>();

    for (const sub of subtitles) {
      seenIds.add(sub.id);
      const existing = map.get(sub.id);
      const color = colorForRegion(sub.id, selectedId, currentTime, sub.startTime, sub.endTime);

      if (existing) {
        // Update if start/end changed (e.g. from undo/edit elsewhere)
        if (existing.start !== sub.startTime || existing.end !== sub.endTime) {
          existing.setOptions({ start: sub.startTime, end: sub.endTime, color });
        } else {
          existing.setOptions({ color });
        }
      } else {
        const region = regions.addRegion({
          id: sub.id,
          start: sub.startTime,
          end: sub.endTime,
          drag: true,
          resize: true,
          color,
        }) as unknown as WSRegion;
        map.set(sub.id, region);
      }
    }

    // Remove regions for subtitles that no longer exist (after delete/merge)
    for (const [id, region] of map.entries()) {
      if (!seenIds.has(id)) {
        region.remove();
        map.delete(id);
      }
    }
  }, [subtitles, selectedId, currentTime, isReady]);

  /* ─── Region event listeners (set once, react via store) ───────────── */
  useEffect(() => {
    const regions = regionsPluginRef.current;
    if (!regions || !isReady) return;

    const onRegionUpdated = (region: WSRegion) => {
      updateTiming(region.id, region.start, region.end);
    };
    const onRegionClicked = (region: WSRegion, e: MouseEvent) => {
      e.stopPropagation();
      selectSubtitle(region.id);
      setCurrentTime(region.start);
    };

    // wavesurfer regions plugin uses .on which returns an unsubscribe fn
    const unsub1 = (regions as unknown as {
      on: (event: string, cb: (...args: unknown[]) => void) => () => void;
    }).on('region-updated', onRegionUpdated as (...args: unknown[]) => void);
    const unsub2 = (regions as unknown as {
      on: (event: string, cb: (...args: unknown[]) => void) => () => void;
    }).on('region-clicked', onRegionClicked as (...args: unknown[]) => void);

    return () => {
      unsub1();
      unsub2();
    };
  }, [isReady, updateTiming, selectSubtitle, setCurrentTime]);

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-panel)]">
      <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] px-4 py-2">
        <span className="font-cairo text-xs text-[var(--color-text-secondary)]">
          Zoom
        </span>
        <input
          type="range"
          min={MIN_WAVEFORM_ZOOM}
          max={MAX_WAVEFORM_ZOOM}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 max-w-xs accent-[var(--color-brand-accent)]"
        />
        <span className="font-cairo text-xs tabular-nums text-[var(--color-text-muted)]">
          {zoom}px/s
        </span>
        <div className="ml-auto font-cairo text-xs text-[var(--color-text-muted)]">
          {subtitles.length} segments
        </div>
      </div>
      <div className="waveform-container flex-1 overflow-x-auto">
        <div ref={timelineRef} />
        <div ref={containerRef} className="min-h-[100px]" />
      </div>
    </div>
  );
}

function colorForRegion(
  id: string,
  selectedId: string | null,
  currentTime: number,
  start: number,
  end: number,
): string {
  if (id === selectedId) return REGION_COLOR_SELECTED;
  if (currentTime >= start && currentTime <= end) return REGION_COLOR_ACTIVE;
  return REGION_COLOR_NORMAL;
}
