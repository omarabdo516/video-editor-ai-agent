import type { PhaseId, Video } from '../api/types';

/** Computes average phase durations (in seconds) from completed videos. */
export function computePhaseAverages(
  videos: Video[],
): Record<string, { avgSec: number; count: number }> {
  const buckets: Record<string, number[]> = {};

  for (const v of videos) {
    for (const [phase, state] of Object.entries(v.phases)) {
      if (
        state.status === 'done' &&
        state.startedAt &&
        state.finishedAt
      ) {
        const started = Date.parse(state.startedAt);
        const finished = Date.parse(state.finishedAt);
        if (started > 0 && finished > started) {
          const sec = (finished - started) / 1000;
          // Ignore outliers (>30 min is probably a stale entry)
          if (sec < 1800) {
            if (!buckets[phase]) buckets[phase] = [];
            buckets[phase].push(sec);
          }
        }
      }
    }
  }

  const result: Record<string, { avgSec: number; count: number }> = {};
  for (const [phase, durations] of Object.entries(buckets)) {
    const sum = durations.reduce((a, b) => a + b, 0);
    result[phase] = {
      avgSec: Math.round(sum / durations.length),
      count: durations.length,
    };
  }
  return result;
}

// Fallback estimates when no historical data exists (seconds)
const FALLBACK_ESTIMATES: Partial<Record<PhaseId, number>> = {
  phase1: 180,      // ~3 min
  transcribe: 150,  // ~2.5 min
  microEvents: 10,  // ~10 sec
  render: 360,      // ~6 min
};

/** Returns estimated duration in seconds for a phase. */
export function getPhaseEstimate(
  videos: Video[],
  phase: PhaseId,
): number | null {
  const averages = computePhaseAverages(videos);
  if (averages[phase]) return averages[phase].avgSec;
  return FALLBACK_ESTIMATES[phase] ?? null;
}

/** Returns elapsed seconds since startedAt. */
export function getElapsedSec(startedAt: string | null | undefined): number {
  if (!startedAt) return 0;
  const started = Date.parse(startedAt);
  if (started <= 0) return 0;
  return Math.max(0, (Date.now() - started) / 1000);
}

/** Formats seconds as "Xm Ys" or "Ys". */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

/** Returns a formatted ETA string like "~2m remaining" or "1m 30s elapsed". */
export function getPhaseEtaLabel(
  videos: Video[],
  phase: PhaseId,
  startedAt: string | null | undefined,
): string | null {
  const elapsed = getElapsedSec(startedAt);
  const estimate = getPhaseEstimate(videos, phase);

  if (estimate == null) {
    return elapsed > 0 ? `${formatEta(elapsed)} elapsed` : null;
  }

  const remaining = estimate - elapsed;
  if (remaining > 5) {
    return `~${formatEta(remaining)} remaining`;
  }
  // Past estimate — just show elapsed
  return `${formatEta(elapsed)} elapsed`;
}

/** Returns batch ETA info. */
export function getBatchEta(
  videos: Video[],
  phase: string,
  totalVideos: number,
  completedVideos: number,
  batchStartedAt: string | undefined,
): { remaining: string; perVideo: string } | null {
  const averages = computePhaseAverages(videos);
  const avg = averages[phase];
  const perVideoSec =
    avg?.avgSec ?? FALLBACK_ESTIMATES[phase as PhaseId] ?? null;

  if (perVideoSec == null) return null;

  const videosLeft = totalVideos - completedVideos;
  const remainingSec = videosLeft * perVideoSec;

  // Adjust with actual elapsed if batch is running
  if (batchStartedAt && completedVideos > 0) {
    const totalElapsed = getElapsedSec(batchStartedAt);
    const actualPerVideo = totalElapsed / completedVideos;
    const adjustedRemaining = videosLeft * actualPerVideo;
    return {
      remaining: `~${formatEta(adjustedRemaining)} remaining`,
      perVideo: `~${formatEta(Math.round(actualPerVideo))}/video`,
    };
  }

  return {
    remaining: `~${formatEta(remainingSec)} remaining`,
    perVideo: `~${formatEta(perVideoSec)}/video`,
  };
}
