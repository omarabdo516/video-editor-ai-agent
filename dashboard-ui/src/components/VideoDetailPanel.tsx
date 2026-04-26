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
import { getEditHandoff, thumbnailUrl } from '../api/client';
import { useModalStore } from '../store/useModalStore';
import { getPhaseEtaLabel, getElapsedSec, formatEta } from '../utils/phaseEstimates';
import { useAutoChain } from '../hooks/useAutoChain';
import { CategoryEditor } from './CategoryEditor';

// Stage α — toggle the legacy "🤖 Send to Claude" copy-paste handoff.
// Replaced by the inline <PlanRenderPanel>. Re-enable for emergency revert
// via VITE_STAGE_ALPHA_LEGACY=1 npm run dashboard.
const SHOW_LEGACY_HANDOFF = import.meta.env.VITE_STAGE_ALPHA_LEGACY === '1';

const ALL_PHASE_IDS: PhaseId[] = [
  'phase1', 'transcribe', 'edit', 'analyze', 'microEvents', 'render',
];

function formatDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pickActivePhase(video: Video): PhaseId | null {
  let running: PhaseId | null = null;
  let latest: { phase: PhaseId; at: number } | null = null;
  for (const phase of ALL_PHASE_IDS) {
    const state = video.phases[phase];
    if (!state) continue;
    if (state.status === 'running') { running = phase; break; }
    const at = state.finishedAt ? Date.parse(state.finishedAt) : 0;
    if (at > 0 && (!latest || at > latest.at)) latest = { phase, at };
  }
  return running ?? latest?.phase ?? null;
}

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

interface Props {
  video: Video;
}

export function VideoDetailPanel({ video }: Props) {
  const removeVideo = useDashboardStore((s) => s.removeVideo);
  const setActiveVideo = useDashboardStore((s) => s.setActiveVideo);
  const logsById = useDashboardStore((s) => s.logs);
  const videos = useDashboardStore((s) => s.videos);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const autoChain = useAutoChain(video.id);

  // Listen for keyboard shortcut events dispatched from App
  useEffect(() => {
    const onPrep = () => {
      if (!autoChain.running) autoChain.autoPrep();
    };
    const onFinish = () => {
      if (!autoChain.running && video.phases.transcribe?.status === 'done') {
        autoChain.autoFinish();
      }
    };
    window.addEventListener('dashboard:auto-prep', onPrep);
    window.addEventListener('dashboard:auto-finish', onFinish);
    return () => {
      window.removeEventListener('dashboard:auto-prep', onPrep);
      window.removeEventListener('dashboard:auto-finish', onFinish);
    };
  }, [autoChain, video.phases.transcribe?.status]);

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

  // Ticking ETA
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
    setActiveVideo(null);
    void removeVideo(video.id);
  };

  const handleEdit = async () => {
    try {
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

  // Compute completed phases for info
  const completedPhases = ALL_PHASE_IDS.filter(
    (p) => video.phases[p]?.status === 'done',
  ).length;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div
          className="shrink-0 overflow-hidden rounded-lg"
          style={{
            width: 80,
            height: 80,
            background: 'var(--color-bg-elevated)',
          }}
        >
          {!thumbError ? (
            <img
              src={thumbnailUrl(video.id)}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setThumbError(true)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-2xl"
              style={{ color: 'var(--color-text-muted)' }}
            >
              🎬
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2
            className="text-xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {video.name}
          </h2>
          <p
            className="mt-1 truncate text-xs"
            title={video.path}
            style={{ color: 'var(--color-text-muted)', direction: 'ltr', textAlign: 'left' }}
          >
            {video.path}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            color: 'var(--color-status-failed)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            background: 'transparent',
          }}
        >
          Remove
        </button>
      </div>

      {/* Metadata strip */}
      <div
        className="flex flex-wrap items-center gap-4 rounded-lg border px-4 py-2.5"
        style={{
          borderColor: 'var(--color-border-subtle)',
          background: 'var(--color-bg-elevated)',
        }}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {formatDuration(video.duration_sec)}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            duration
          </span>
        </div>
        {video.lecturer && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {video.lecturer}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              lecturer
            </span>
          </div>
        )}
        {video.workshop && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {video.workshop}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              workshop
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-sm font-bold"
            style={{
              color:
                completedPhases === 6
                  ? 'var(--color-status-done)'
                  : 'var(--color-text-primary)',
            }}
          >
            {completedPhases}/6
          </span>
          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            phases
          </span>
        </div>
        {video.rating != null && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold" style={{ color: 'var(--color-brand-accent)' }}>
              {video.rating}/5
            </span>
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              rating
            </span>
          </div>
        )}
        {/* Category */}
        <div className="flex items-center gap-1.5">
          <CategoryEditor videoId={video.id} currentCategory={video.category} />
        </div>
      </div>

      {/* Pipeline stepper */}
      <PipelineStepper video={video} />

      {/* Phase buttons */}
      <div className="flex flex-wrap gap-2">
        <PhaseButton video={video} phase="phase1" label="Phase 1" />
        <PhaseButton video={video} phase="transcribe" label="Transcribe" />
        <PhaseButton video={video} phase="edit" label="Edit" onClick={handleEdit} />
        {SHOW_LEGACY_HANDOFF && (
          <PhaseButton
            video={video}
            phase="analyze"
            label="Send to Claude (legacy)"
            disabled={!transcribeDone}
            disabledReason="Transcribe must finish first"
            onClick={handleAnalyze}
          />
        )}
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

      {/* Auto-chain shortcuts */}
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2"
        style={{
          borderColor: 'var(--color-border-subtle)',
          background: 'var(--color-bg-elevated)',
        }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Quick Actions
        </span>
        <div className="flex-1" />

        {/* Auto-Prep: Phase1 → Transcribe */}
        <button
          type="button"
          onClick={autoChain.autoPrep}
          disabled={autoChain.running || activeRunning}
          title="Run Phase 1 then Transcribe automatically"
          className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{
            background: autoChain.running && autoChain.currentPhase && ['phase1', 'transcribe'].includes(autoChain.currentPhase)
              ? 'rgba(255, 181, 1, 0.12)'
              : 'transparent',
            border: '1px solid var(--color-brand-accent)',
            color: 'var(--color-brand-accent)',
            opacity: autoChain.running || activeRunning ? 0.5 : 1,
          }}
        >
          {autoChain.running && autoChain.currentPhase && ['phase1', 'transcribe'].includes(autoChain.currentPhase)
            ? `Prepping (${autoChain.currentPhase})...`
            : '▶ Auto-Prep'}
        </button>

        {/* Auto-Finish: MicroEvents → Render */}
        <button
          type="button"
          onClick={autoChain.autoFinish}
          disabled={autoChain.running || activeRunning || !transcribeDone}
          title="Run Micro Events then Render automatically"
          className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{
            background: autoChain.running && autoChain.currentPhase && ['microEvents', 'render'].includes(autoChain.currentPhase)
              ? 'rgba(255, 181, 1, 0.12)'
              : 'transparent',
            border: '1px solid var(--color-brand-accent)',
            color: 'var(--color-brand-accent)',
            opacity: autoChain.running || activeRunning || !transcribeDone ? 0.5 : 1,
          }}
        >
          {autoChain.running && autoChain.currentPhase && ['microEvents', 'render'].includes(autoChain.currentPhase)
            ? `Finishing (${autoChain.currentPhase})...`
            : '▶ Auto-Finish'}
        </button>

        {/* Cancel button */}
        {autoChain.running && (
          <button
            type="button"
            onClick={autoChain.cancel}
            className="rounded-md px-2 py-1.5 text-xs font-medium"
            style={{
              color: 'var(--color-status-failed)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              background: 'transparent',
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress + ETA */}
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

      {/* Error */}
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

      {/* Logs — more height in the detail panel */}
      {activeJobId && (
        <LogViewer
          key={activeJobId}
          lines={activeLines}
          maxHeight={360}
          title={phaseLabel ? `${phaseLabel} logs` : 'Logs'}
          defaultExpanded={activeFailed || activeRunning}
        />
      )}

      {/* Stage α — plan + render panel (inline below). Renders null when idle. */}
      <PlanRenderPanel videoId={video.id} />

      {/* Rating — skip when the panel is active (panel surfaces its own rating block) */}
      {renderDone && !planActive && (
        <RatingInput
          videoId={video.id}
          currentRating={video.rating}
          currentNote={video.notes}
        />
      )}

      {/* Legacy handoff modal — only renders when env flag is on */}
      {SHOW_LEGACY_HANDOFF && handoffOpen && (
        <ClaudeHandoffModal video={video} onClose={() => setHandoffOpen(false)} />
      )}
    </div>
  );
}
