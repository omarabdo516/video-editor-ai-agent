import { useState } from 'react';
import type { BatchPhase } from '../api/types';
import { useDashboardStore } from '../store/useDashboardStore';
import { useBatchStore } from '../store/useBatchStore';
import { useModalStore } from '../store/useModalStore';
import { MegaHandoffModal } from './MegaHandoffModal';
import { computePhaseAverages, formatEta } from '../utils/phaseEstimates';

const PHASE_LABELS: Record<BatchPhase, string> = {
  phase1: 'Phase 1',
  transcribe: 'Transcribe',
  microEvents: 'Micro Events',
  render: 'Render',
};

const PHASE_OPTIONS: BatchPhase[] = [
  'phase1',
  'transcribe',
  'microEvents',
  'render',
];

export function BatchToolbar() {
  const selectedIds = useDashboardStore((s) => s.selectedVideoIds);
  const clearSelection = useDashboardStore((s) => s.clearSelection);
  const selectAll = useDashboardStore((s) => s.selectAll);
  const totalVideos = useDashboardStore((s) => s.videos.length);
  const videos = useDashboardStore((s) => s.videos);
  const megaCommitBatch = useDashboardStore((s) => s.megaCommitBatch);
  const activeBatch = useBatchStore((s) => s.active);
  const startBatch = useBatchStore((s) => s.startBatch);

  const [phase, setPhase] = useState<BatchPhase>('phase1');
  const [continueOnError, setContinueOnError] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [prepChainRunning, setPrepChainRunning] = useState(false);
  const [megaHandoffOpen, setMegaHandoffOpen] = useState(false);
  const showConfirm = useModalStore((s) => s.showConfirm);
  const showAlert = useModalStore((s) => s.showAlert);
  const showPrompt = useModalStore((s) => s.showPrompt);

  const count = selectedIds.size;
  if (count === 0) return null;

  const batchRunning = activeBatch?.status === 'running';
  const selectedIdList = [...selectedIds];
  const selectedVideos = videos.filter((v) => selectedIds.has(v.id));

  // Gating per mega-action (based on phase status of the selected videos):
  const allHavePhase1Done = selectedVideos.every((v) => v.phases.phase1?.status === 'done');
  const allHaveTranscribeDone = selectedVideos.every(
    (v) => v.phases.transcribe?.status === 'done',
  );
  // Render button enables when every selected video has an animation_plan.json
  // (which means Claude has done Phase 5/6). We check via the outputs.animation_plan
  // path existence signal — the store doesn't track file existence directly, but
  // the backend updates phase state on render completion, so we use a softer
  // heuristic: allow if every video has transcribe done + not currently rendering.
  const anyRendering = selectedVideos.some((v) => v.phases.render?.status === 'running');
  const allHaveRatings = selectedVideos.every((v) => v.rating != null);

  const handleRun = async () => {
    const ids = [...selectedIds];
    const averages = computePhaseAverages(videos);
    const avg = averages[phase];
    const etaHint = avg
      ? `\n\nEstimated: ~${formatEta(avg.avgSec * ids.length)} total (~${formatEta(avg.avgSec)}/video)`
      : '';
    const ok = await showConfirm({
      title: `Run ${PHASE_LABELS[phase]}`,
      message: `Run ${PHASE_LABELS[phase]} on ${ids.length} videos? They'll process one at a time.${etaHint}`,
      confirmLabel: 'Run',
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      await startBatch(phase, ids, continueOnError);
      clearSelection();
    } catch (e) {
      showAlert({
        title: 'Batch Failed',
        message: `Failed to start batch: ${e instanceof Error ? e.message : String(e)}`,
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Mega-action 1: Prep All = Phase 1 → Transcribe (chained sequentially)
  const handlePrepAll = async () => {
    if (count === 0) return;
    const ok = await showConfirm({
      title: 'Prep All',
      message: `Run Phase 1 (preprocessing) then Transcribe on ${count} videos sequentially.\n\nThis takes ~4-8 min per video. Keep the Dashboard open until both batches finish.`,
      confirmLabel: 'Start Prep',
    });
    if (!ok) return;
    const ids = [...selectedIds];
    setPrepChainRunning(true);
    try {
      await startBatch('phase1', ids, continueOnError);
      await new Promise<void>((resolve) => {
        const check = () => {
          const s = useBatchStore.getState().active;
          if (!s || s.status !== 'running') resolve();
          else setTimeout(check, 500);
        };
        check();
      });
      await startBatch('transcribe', ids, continueOnError);
    } catch (e) {
      showAlert({
        title: 'Prep Failed',
        message: `Prep All failed: ${e instanceof Error ? e.message : String(e)}`,
        variant: 'error',
      });
    } finally {
      setPrepChainRunning(false);
    }
  };

  // Mega-action 2: Send All to Claude — opens MegaHandoffModal
  const handleSendToClaude = () => {
    if (!allHaveTranscribeDone) {
      showAlert({
        title: 'Not Ready',
        message: 'Some videos still need Phase 1 + Transcribe done. Click "Prep All" first.',
        variant: 'error',
      });
      return;
    }
    setMegaHandoffOpen(true);
  };

  // Mega-action 3: Render All — delegate to existing bulk render
  const handleRenderAll = async () => {
    if (!allHaveTranscribeDone) {
      showAlert({
        title: 'Not Ready',
        message: 'Some videos are not transcribed yet.',
        variant: 'error',
      });
      return;
    }
    const ok = await showConfirm({
      title: 'Render All',
      message: `Render ${count} videos sequentially.\n\nMake sure Claude has finished Phase 5/6 (animation_plan.json exists for each). ~5 min per video.`,
      confirmLabel: 'Start Render',
    });
    if (!ok) return;
    try {
      await startBatch('render', [...selectedIds], continueOnError);
    } catch (e) {
      showAlert({
        title: 'Render Failed',
        message: `Render All failed: ${e instanceof Error ? e.message : String(e)}`,
        variant: 'error',
      });
    }
  };

  // Mega-action 4: Commit Batch — atomic feedback + CLAUDE.md + git commit
  const handleCommitBatch = async () => {
    if (!allHaveRatings) {
      showAlert({
        title: 'Rating Required',
        message: 'All videos must have a rating before you can commit the batch. Rate each rendered reel first.',
        variant: 'error',
      });
      return;
    }
    const note = await showPrompt({
      title: 'Commit Batch',
      message: 'Optional batch note (goes into the commit message):',
      placeholder: 'e.g. First batch of Ahmed Ali workshop...',
    });
    if (note === null) return; // cancelled
    try {
      const res = await megaCommitBatch(selectedIdList, note || undefined);
      showAlert({
        title: 'Batch Committed',
        message: `Committed ${selectedIdList.length} videos.\n\nCommit: ${res.commitHash}\nFiles: ${res.stagedFiles.length} staged\n\nfeedback/log.json + CLAUDE.md + each src/data/<slug>/ were updated and committed together.`,
        variant: 'success',
      });
      clearSelection();
    } catch (e) {
      showAlert({
        title: 'Commit Failed',
        message: `Commit failed: ${e instanceof Error ? e.message : String(e)}`,
        variant: 'error',
      });
    }
  };

  return (
    <>
      <div
        className="flex flex-col gap-2 rounded-xl border px-3 py-2"
        style={{
          borderColor: 'var(--color-brand-accent)',
          background: 'var(--color-bg-panel)',
        }}
      >
        {/* Row 1: selection summary + single-phase controls */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="text-sm font-bold"
            style={{ color: 'var(--color-brand-accent)' }}
          >
            {count} {count === 1 ? 'video' : 'videos'} selected
          </span>

          <span
            className="h-5 w-px"
            style={{ background: 'var(--color-border-subtle)' }}
          />

          <label
            className="flex items-center gap-2 text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Phase:
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value as BatchPhase)}
              disabled={batchRunning || submitting}
              className="rounded-md border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--color-border-subtle)',
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)',
              }}
            >
              {PHASE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          <label
            className="flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <input
              type="checkbox"
              checked={continueOnError}
              onChange={(e) => setContinueOnError(e.target.checked)}
              disabled={batchRunning || submitting}
            />
            Continue on error
          </label>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => selectAll()}
            disabled={count === totalVideos}
            className="rounded-md px-2 py-1 text-xs"
            style={{
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
              background: 'transparent',
            }}
          >
            Select all
          </button>

          <button
            type="button"
            onClick={() => clearSelection()}
            className="rounded-md px-2 py-1 text-xs"
            style={{
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
              background: 'transparent',
            }}
          >
            Clear
          </button>

          <button
            type="button"
            onClick={handleRun}
            disabled={batchRunning || submitting}
            className="rounded-lg px-4 py-2 text-sm font-bold"
            style={{
              background: 'var(--color-brand-accent)',
              color: '#000',
              opacity: batchRunning || submitting ? 0.55 : 1,
              cursor: batchRunning || submitting ? 'not-allowed' : 'pointer',
            }}
            title={
              batchRunning
                ? 'A batch is already running — wait for it to finish or cancel it'
                : undefined
            }
          >
            {submitting ? 'Starting…' : `▶ Run on ${count}`}
          </button>
        </div>

        {/* Row 2: Mega actions (Mode B parallel workflow) */}
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
          style={{
            borderColor: 'var(--color-border-subtle)',
            background: 'var(--color-bg-elevated)',
          }}
        >
          <span
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--color-text-muted)' }}
          >
            🚀 Mega-Batch
          </span>
          <span
            className="text-[10px]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Mode B: parallel
          </span>

          <div className="flex-1" />

          <button
            type="button"
            onClick={handlePrepAll}
            disabled={batchRunning || prepChainRunning}
            title="Run Phase 1 + Transcribe on all selected videos (chained sequentially)"
            className="rounded-md px-3 py-1.5 text-xs font-semibold"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-brand-accent)',
              color: 'var(--color-brand-accent)',
              opacity: batchRunning || prepChainRunning ? 0.45 : 1,
              cursor: batchRunning || prepChainRunning ? 'not-allowed' : 'pointer',
            }}
          >
            {prepChainRunning ? 'Prep running…' : '1️⃣ Prep All'}
          </button>

          <button
            type="button"
            onClick={handleSendToClaude}
            disabled={!allHaveTranscribeDone}
            title={
              allHaveTranscribeDone
                ? 'Build one aggregated Claude handoff message for all selected videos'
                : 'Some videos still need Transcribe done'
            }
            className="rounded-md px-3 py-1.5 text-xs font-semibold"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-brand-accent)',
              color: 'var(--color-brand-accent)',
              opacity: allHaveTranscribeDone ? 1 : 0.45,
              cursor: allHaveTranscribeDone ? 'pointer' : 'not-allowed',
            }}
          >
            2️⃣ Send All to Claude
          </button>

          <button
            type="button"
            onClick={handleRenderAll}
            disabled={batchRunning || !allHavePhase1Done || anyRendering}
            title="Batch-render all selected videos sequentially. Requires Claude to have finished Phase 5/6."
            className="rounded-md px-3 py-1.5 text-xs font-semibold"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-brand-accent)',
              color: 'var(--color-brand-accent)',
              opacity: batchRunning || !allHavePhase1Done || anyRendering ? 0.45 : 1,
              cursor:
                batchRunning || !allHavePhase1Done || anyRendering
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            3️⃣ Render All
          </button>

          <button
            type="button"
            onClick={handleCommitBatch}
            disabled={!allHaveRatings}
            title={
              allHaveRatings
                ? 'Write feedback/log.json + CLAUDE.md + git commit for all rated videos'
                : 'Rate every rendered video first'
            }
            className="rounded-md px-3 py-1.5 text-xs font-semibold"
            style={{
              background: allHaveRatings ? 'var(--color-brand-accent)' : 'transparent',
              border: '1px solid var(--color-brand-accent)',
              color: allHaveRatings
                ? '#000'
                : 'var(--color-brand-accent)',
              opacity: allHaveRatings ? 1 : 0.45,
              cursor: allHaveRatings ? 'pointer' : 'not-allowed',
            }}
          >
            4️⃣ Commit Batch
          </button>
        </div>
      </div>

      {megaHandoffOpen && (
        <MegaHandoffModal
          videoIds={selectedIdList}
          onClose={() => setMegaHandoffOpen(false)}
        />
      )}
    </>
  );
}
