import { useState } from 'react';
import type { BatchPhase } from '../api/types';
import { useDashboardStore } from '../store/useDashboardStore';
import { useBatchStore } from '../store/useBatchStore';
import { MegaHandoffModal } from './MegaHandoffModal';

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
    const ok = confirm(
      `Run ${PHASE_LABELS[phase]} on ${ids.length} videos? They'll process one at a time.`,
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      await startBatch(phase, ids, continueOnError);
      clearSelection();
    } catch (e) {
      alert(
        `Failed to start batch: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Mega-action 1: Prep All = Phase 1 → Transcribe (chained sequentially)
  const handlePrepAll = async () => {
    if (count === 0) return;
    const ok = confirm(
      `Prep All on ${count} videos?\n\nThis runs Phase 1 (preprocessing) then Transcribe on each video sequentially. It takes ~4-8 min per video. The Dashboard window should stay open until both batches finish.`,
    );
    if (!ok) return;
    const ids = [...selectedIds];
    setPrepChainRunning(true);
    try {
      // Run Phase 1 batch first
      await startBatch('phase1', ids, continueOnError);
      // Wait for it to fully finish before starting transcribe
      await new Promise<void>((resolve) => {
        const check = () => {
          const s = useBatchStore.getState().active;
          if (!s || s.status !== 'running') resolve();
          else setTimeout(check, 500);
        };
        check();
      });
      // Then kick off transcribe
      await startBatch('transcribe', ids, continueOnError);
    } catch (e) {
      alert(
        `Prep All failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setPrepChainRunning(false);
    }
  };

  // Mega-action 2: Send All to Claude — opens MegaHandoffModal
  const handleSendToClaude = () => {
    if (!allHaveTranscribeDone) {
      alert(
        'Some videos still need Phase 1 + Transcribe done. Click "Prep All" first.',
      );
      return;
    }
    setMegaHandoffOpen(true);
  };

  // Mega-action 3: Render All — delegate to existing bulk render
  const handleRenderAll = async () => {
    if (!allHaveTranscribeDone) {
      alert('Some videos are not transcribed yet.');
      return;
    }
    const ok = confirm(
      `Render All on ${count} videos?\n\nMake sure Claude has finished Phase 5/6 (animation_plan.json exists for each). Rendering takes ~5 min per video. Sequential because GPU is single.`,
    );
    if (!ok) return;
    try {
      await startBatch('render', [...selectedIds], continueOnError);
    } catch (e) {
      alert(
        `Render All failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  // Mega-action 4: Commit Batch — atomic feedback + CLAUDE.md + git commit
  const handleCommitBatch = async () => {
    if (!allHaveRatings) {
      alert(
        'All videos must have a rating before you can commit the batch. Rate each rendered reel first.',
      );
      return;
    }
    const note = prompt(
      'Optional batch note (goes into the commit message):',
      '',
    );
    if (note === null) return; // cancelled
    try {
      const res = await megaCommitBatch(selectedIdList, note || undefined);
      alert(
        `✅ Committed ${selectedIdList.length} videos.\n\n` +
          `Commit: ${res.commitHash}\n` +
          `Files: ${res.stagedFiles.length} staged\n\n` +
          `feedback/log.json + CLAUDE.md + each src/data/<slug>/ were updated and committed together.`,
      );
      clearSelection();
    } catch (e) {
      alert(
        `Commit failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <>
      <div
        className="sticky top-2 z-20 mb-4 flex flex-col gap-3 rounded-xl border px-4 py-3 shadow-lg"
        style={{
          borderColor: 'var(--color-brand-accent)',
          background: 'var(--color-bg-panel)',
          boxShadow: '0 4px 20px rgba(255, 181, 1, 0.15)',
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
