import { useEffect, useMemo, useState } from 'react';
import type { PhaseId, Video } from '../api/types';
import { useDashboardStore } from '../store/useDashboardStore';
import { usePlanStore } from '../store/usePlanStore';
import { PhaseButton } from './PhaseButton';
import { PipelineStepper } from './PipelineStepper';
import { ProgressBar } from './ProgressBar';
import { LogViewer } from './LogViewer';
import { ClaudeHandoffModal } from './ClaudeHandoffModal';
import { RatingInput } from './RatingInput';
import { PlanRenderPanel } from './PlanRenderPanel';
import { getEditHandoff } from '../api/client';
import { useModalStore } from '../store/useModalStore';
import { getPhaseEtaLabel, getElapsedSec, formatEta } from '../utils/phaseEstimates';

interface Props {
  video: Video;
}

const ALL_PHASE_IDS: PhaseId[] = [
  'phase1',
  'transcribe',
  'edit',
  'analyze',
  'microEvents',
  'render',
];

function formatDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Find the phase that owns the active log panel: a running phase if any,
// otherwise the most-recently-finished phase.
function pickActivePhase(video: Video): PhaseId | null {
  let running: PhaseId | null = null;
  let latest: { phase: PhaseId; at: number } | null = null;

  for (const phase of ALL_PHASE_IDS) {
    const state = video.phases[phase];
    if (!state) continue;
    if (state.status === 'running') {
      running = phase;
      break;
    }
    const at = state.finishedAt ? Date.parse(state.finishedAt) : 0;
    if (at > 0 && (!latest || at > latest.at)) latest = { phase, at };
  }

  return running ?? latest?.phase ?? null;
}

// Parse "X / Y" progress markers from the tail of a log buffer. Returns
// null if no match. Used as a proxy when rs-reels doesn't emit an explicit
// percentage (e.g. Remotion's "Rendered 1234 / 6521 frames").
function extractProgress(lines: string[]): number | null {
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
    const m = lines[i].match(/(\d+)\s*\/\s*(\d+)/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (b > 0 && a >= 0 && a <= b) return a / b;
    }
  }
  return null;
}

export function VideoCard({ video }: Props) {
  const removeVideo = useDashboardStore((s) => s.removeVideo);
  const logsById = useDashboardStore((s) => s.logs);
  const selected = useDashboardStore((s) => s.selectedVideoIds.has(video.id));
  const toggleSelect = useDashboardStore((s) => s.toggleSelect);
  const [handoffOpen, setHandoffOpen] = useState(false);

  const transcribeDone = video.phases.transcribe?.status === 'done';
  const renderDone = video.phases.render?.status === 'done';
  const phase1Done = video.phases.phase1?.status === 'done';
  const editDone = video.phases.edit?.status === 'done';
  const canPlan = phase1Done && transcribeDone && editDone;
  const planActive = usePlanStore((s) => {
    const ps = s.byVideoId[video.id];
    return ps != null && ps.mode !== 'idle';
  });
  const startPlan = usePlanStore((s) => s.startPlan);
  const activePhase = useMemo(() => pickActivePhase(video), [video]);
  const activeState = activePhase ? video.phases[activePhase] : null;
  const activeJobId = activeState?.lastJobId ?? null;
  const activeLines = useMemo(
    () => (activeJobId ? logsById[activeJobId] ?? [] : []),
    [activeJobId, logsById],
  );
  const activeFailed = activeState?.status === 'failed';
  const activeRunning = activeState?.status === 'running';

  const progress =
    activeRunning && activePhase === 'render' ? extractProgress(activeLines) : null;

  // Ticking ETA — re-renders every second while a phase is running
  const videos = useDashboardStore((s) => s.videos);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeRunning) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [activeRunning]);
  const etaLabel = activeRunning && activePhase
    ? getPhaseEtaLabel(videos, activePhase, activeState?.startedAt)
    : null;
  const elapsedLabel = activeRunning && activeState?.startedAt
    ? formatEta(getElapsedSec(activeState.startedAt))
    : null;

  const showConfirm = useModalStore((s) => s.showConfirm);
  const showAlert = useModalStore((s) => s.showAlert);

  const handleDelete = async () => {
    const ok = await showConfirm({
      title: 'Remove Video',
      message: `Remove "${video.name}" from the dashboard?\n\nFiles on disk won't be touched.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    void removeVideo(video.id);
  };

  const handleEdit = async () => {
    try {
      // The API now spawns `rs-reels.mjs edit` as a managed subprocess
      // and waits for port 5173 to become reachable. That takes a few
      // seconds on first call — the UI should indicate "starting...".
      const handoff = await getEditHandoff(video.id);
      if (!handoff.ready) {
        showAlert({
          title: 'Editor Not Ready',
          message: `Editor did not become ready within 30s.\n\nCheck the API log, or run this in a separate terminal:\n${handoff.hintCommand}`,
          variant: 'error',
        });
        return;
      }
      window.open(handoff.editorUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      showAlert({
        title: 'Edit Error',
        message: `Edit handoff failed: ${e instanceof Error ? e.message : String(e)}`,
        variant: 'error',
      });
    }
  };

  const handleAnalyze = () => setHandoffOpen(true);

  const handlePlan = () => {
    void startPlan(video.id);
  };

  const planDisabledReason = (() => {
    if (canPlan) return null;
    const missing: string[] = [];
    if (!phase1Done) missing.push('Phase 1');
    if (!transcribeDone) missing.push('Transcribe');
    if (!editDone) missing.push('Edit');
    return `خلّص ${missing.join(' + ')} الأول`;
  })();

  const phaseLabel = activePhase
    ? {
        phase1: 'Phase 1',
        transcribe: 'Transcribe',
        edit: 'Edit',
        analyze: 'Analyze',
        microEvents: 'Micro Events',
        render: 'Render',
      }[activePhase]
    : null;

  return (
    <article
      className="flex flex-col gap-3 rounded-xl border p-4 transition-colors"
      style={{
        borderColor: selected
          ? 'var(--color-brand-accent)'
          : 'var(--color-border-subtle)',
        background: 'var(--color-bg-panel)',
        boxShadow: selected
          ? '0 0 0 1px var(--color-brand-accent), 0 4px 16px rgba(255, 181, 1, 0.1)'
          : undefined,
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleSelect(video.id)}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
          title="Select for batch mode"
          aria-label={`Select ${video.name} for batch`}
        />
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-base font-bold"
            title={video.name}
            style={{ color: 'var(--color-text-primary)' }}
          >
            {video.name}
          </h2>
          <p
            className="mt-0.5 truncate text-xs"
            title={video.path}
            style={{ color: 'var(--color-text-muted)', direction: 'ltr', textAlign: 'left' }}
          >
            {video.path}
          </p>
          <div
            className="mt-1 flex items-center gap-3 text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span>⏱ {formatDuration(video.duration_sec)}</span>
            {video.rating != null && <span>★ {video.rating}/5</span>}
            {video.lecturer && <span title="lecturer">👤 {video.lecturer}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-md px-2 py-1 text-xs font-medium"
          style={{
            color: 'var(--color-status-failed)',
            border: '1px solid var(--color-border-subtle)',
            background: 'transparent',
          }}
          title="Remove from dashboard"
        >
          حذف
        </button>
      </header>

      {/* Visual pipeline progress */}
      <PipelineStepper video={video} />

      <div className="flex flex-wrap gap-2">
        <PhaseButton video={video} phase="phase1" label="Phase 1" />
        <PhaseButton video={video} phase="transcribe" label="Transcribe" />
        <PhaseButton video={video} phase="edit" label="Edit" onClick={handleEdit} />
        <PhaseButton
          video={video}
          phase="analyze"
          label="🤖 Send to Claude"
          disabled={!transcribeDone}
          disabledReason="Transcribe must finish first"
          onClick={handleAnalyze}
        />
        <PhaseButton video={video} phase="microEvents" label="Micro Events" />
        <PhaseButton video={video} phase="render" label="Render" />
        <button
          type="button"
          onClick={handlePlan}
          disabled={!canPlan || planActive}
          title={
            planDisabledReason ??
            (planActive
              ? 'الـ plan شغّال — شوف اللوحة تحت'
              : 'تخطيط Claude + render تلقائي')
          }
          className="rounded-md px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed"
          style={{
            background: canPlan && !planActive ? 'var(--color-brand-accent)' : 'transparent',
            color:
              canPlan && !planActive
                ? 'var(--color-brand-dark)'
                : 'var(--color-text-muted)',
            border:
              canPlan && !planActive
                ? 'none'
                : '1px solid var(--color-border-subtle)',
            opacity: canPlan && !planActive ? 1 : 0.6,
          }}
        >
          🎬 خطّط وأرندر
        </button>
      </div>

      {activeRunning && (
        <div className="flex flex-col gap-1">
          <ProgressBar
            progress={progress ?? 0}
            label={
              progress != null
                ? `${phaseLabel} — ${Math.round(progress * 100)}%`
                : `${phaseLabel} — running (${activeLines.length} lines)`
            }
          />
          {/* ETA / elapsed timer */}
          <div
            className="flex items-center justify-between px-1 text-[10px]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span>{elapsedLabel ? `${elapsedLabel} elapsed` : ''}</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {etaLabel ?? ''}
            </span>
          </div>
        </div>
      )}

      {activeFailed && activeState?.error && (
        <div
          className="rounded-md px-3 py-2 text-xs"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            color: 'var(--color-status-failed)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
          }}
        >
          <strong>{phaseLabel} failed:</strong> {activeState.error}
        </div>
      )}

      {activeJobId && (
        <LogViewer
          key={activeJobId}
          lines={activeLines}
          title={phaseLabel ? `${phaseLabel} logs` : 'Logs'}
          defaultExpanded={activeFailed}
        />
      )}

      {/* Stage α — plan + render panel (inline below). Renders null when idle. */}
      <PlanRenderPanel videoId={video.id} />

      {renderDone && !planActive && (
        <RatingInput
          videoId={video.id}
          currentRating={video.rating}
          currentNote={video.notes}
        />
      )}

      {handoffOpen && (
        <ClaudeHandoffModal video={video} onClose={() => setHandoffOpen(false)} />
      )}
    </article>
  );
}
