// Stage α — single-window plan + render panel.
// Mounts inline below VideoCard when a video has an active plan or a
// terminal plan/render state worth showing. Keyed by videoId so multiple
// panels can run in parallel.

import { usePlanStore, type PlanState } from '../store/usePlanStore';
import { useDashboardStore } from '../store/useDashboardStore';
import { LogViewer } from './LogViewer';
import { ProgressBar } from './ProgressBar';
import { RatingInput } from './RatingInput';
import { TokenSpendBadge } from './plan/TokenSpendBadge';
import { ValidatorVerdictDisplay } from './plan/ValidatorVerdictDisplay';
import { ReflectionDisplay } from './plan/ReflectionDisplay';

interface Props {
  videoId: string;
}

interface ShellProps {
  videoId: string;
  title: string;
  status: 'running' | 'success' | 'failed' | 'warning';
  onClose: () => void;
  children: React.ReactNode;
}

const STATUS_COLOR: Record<ShellProps['status'], string> = {
  running: 'var(--color-status-running)',
  success: 'var(--color-status-done)',
  failed: 'var(--color-status-failed)',
  warning: 'var(--color-status-running)',
};

function PanelShell({ title, status, onClose, children }: ShellProps) {
  return (
    <section
      className="rounded-lg border"
      style={{
        background: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border-subtle)',
        borderInlineStartWidth: 3,
        borderInlineStartStyle: 'solid',
        borderInlineStartColor: STATUS_COLOR[status],
      }}
      aria-live="polite"
    >
      <header
        className="flex items-center justify-between border-b px-4 py-2"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              background: STATUS_COLOR[status],
              boxShadow: status === 'running' ? `0 0 6px ${STATUS_COLOR.running}aa` : undefined,
            }}
          />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-0.5 text-xs"
          style={{
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border-subtle)',
            background: 'transparent',
          }}
          aria-label="Close panel"
        >
          ✕
        </button>
      </header>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  );
}

function ActionButton({
  onClick,
  children,
  variant = 'primary',
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const isPrimary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-3 py-1.5 text-xs font-semibold transition"
      style={{
        background: isPrimary ? 'var(--color-brand-accent)' : 'transparent',
        color: isPrimary ? 'var(--color-brand-dark)' : 'var(--color-text-secondary)',
        border: isPrimary ? 'none' : '1px solid var(--color-border-strong)',
      }}
    >
      {children}
    </button>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs"
      style={{
        background: 'var(--color-danger-subtle)',
        borderColor: 'var(--color-status-failed)',
        borderInlineStartWidth: 3,
        color: 'var(--color-text-primary)',
      }}
      dir="ltr"
    >
      {message}
    </div>
  );
}

export function PlanRenderPanel({ videoId }: Props) {
  const planState = usePlanStore((s) => s.byVideoId[videoId]);
  const closePanel = usePlanStore((s) => s.closePanel);
  const retry = usePlanStore((s) => s.retry);
  const reset = usePlanStore((s) => s.reset);
  const video = useDashboardStore((s) =>
    s.videos.find((v) => v.id === videoId) ?? null,
  );

  if (!planState || planState.mode === 'idle') return null;

  const onClose = () => closePanel(videoId);
  const onRetry = () => {
    void retry(videoId);
  };
  const onResetThenRetry = () => {
    reset(videoId);
    void retry(videoId);
  };

  return renderByMode(planState, {
    videoId,
    onClose,
    onRetry,
    onResetThenRetry,
    videoRating: video?.rating ?? null,
    videoNote: video?.notes ?? null,
  });
}

interface ModeProps {
  videoId: string;
  onClose: () => void;
  onRetry: () => void;
  onResetThenRetry: () => void;
  videoRating: number | null;
  videoNote: string | null;
}

function renderByMode(state: PlanState, p: ModeProps) {
  switch (state.mode) {
    case 'idle':
      return null;

    case 'planning':
      return (
        <PanelShell
          videoId={p.videoId}
          title="جاري التخطيط — Claude بيشتغل"
          status="running"
          onClose={p.onClose}
        >
          <div className="flex items-center gap-2">
            <TokenSpendBadge tokens={state.tokens} />
            {state.pendingVerdict?.passed && (
              <span
                className="text-[11px]"
                style={{ color: 'var(--color-status-done)' }}
                dir="ltr"
              >
                ✓ validator passed — awaiting render
              </span>
            )}
          </div>
          <LogViewer
            lines={state.lines}
            title="Planner output"
            defaultExpanded
          />
        </PanelShell>
      );

    case 'validator-rejected':
      return (
        <PanelShell
          videoId={p.videoId}
          title="✗ المخطّط مرفوض من الـ brand validator"
          status="failed"
          onClose={p.onClose}
        >
          <TokenSpendBadge tokens={state.tokens} frozen />
          <ValidatorVerdictDisplay verdict={state.verdict} variant="full" />
          <details>
            <summary
              className="cursor-pointer text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              عرض الـ planner output
            </summary>
            <div className="mt-2">
              <LogViewer lines={state.lines} title="Planner output" />
            </div>
          </details>
          <div className="flex justify-end gap-2">
            <ActionButton onClick={p.onResetThenRetry}>إعادة التخطيط</ActionButton>
          </div>
        </PanelShell>
      );

    case 'planner-failed':
      return (
        <PanelShell
          videoId={p.videoId}
          title="✗ الـ planner فشل"
          status="failed"
          onClose={p.onClose}
        >
          <ErrorBlock message={state.error} />
          <LogViewer lines={state.lines} title="Planner output" defaultExpanded />
          <div className="flex justify-end gap-2">
            <ActionButton onClick={p.onResetThenRetry}>إعادة المحاولة</ActionButton>
          </div>
        </PanelShell>
      );

    case 'rendering': {
      const pct = state.renderProgress;
      const label =
        pct != null
          ? `Rendering — ${Math.round(pct * 100)}%`
          : 'Rendering — جاري المعالجة';
      return (
        <PanelShell
          videoId={p.videoId}
          title="جاري الـ render"
          status="running"
          onClose={p.onClose}
        >
          <TokenSpendBadge tokens={state.tokens} frozen />
          <ProgressBar progress={pct ?? 0.05} label={label} />
          <LogViewer lines={state.renderLines} title="Render output" defaultExpanded />
          <details>
            <summary
              className="cursor-pointer text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              عرض planner output (مخفي)
            </summary>
            <div className="mt-2">
              <LogViewer lines={state.planLines} title="Planner output" />
            </div>
          </details>
        </PanelShell>
      );
    }

    case 'render-failed':
      return (
        <PanelShell
          videoId={p.videoId}
          title="✗ Render فشل"
          status="failed"
          onClose={p.onClose}
        >
          <TokenSpendBadge tokens={state.tokens} frozen />
          <LogViewer lines={state.renderLines} title="Render output" defaultExpanded />
          <div className="flex justify-end gap-2">
            <ActionButton onClick={p.onRetry}>إعادة الـ render</ActionButton>
          </div>
        </PanelShell>
      );

    case 'done-awaiting-rating':
      return (
        <PanelShell
          videoId={p.videoId}
          title="✓ خلصت — قيّم الريل"
          status="success"
          onClose={p.onClose}
        >
          <TokenSpendBadge tokens={state.tokens} frozen />
          <ReflectionDisplay videoId={p.videoId} initialText={state.reflection} />
          {state.verdict.softWarnings.length > 0 && (
            <ValidatorVerdictDisplay verdict={state.verdict} variant="warnings-only" />
          )}
          <RatingInput
            videoId={p.videoId}
            currentRating={p.videoRating}
            currentNote={p.videoNote}
          />
          <details>
            <summary
              className="cursor-pointer text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              عرض الـ logs
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <LogViewer lines={state.planLines} title="Planner output" />
              <LogViewer lines={state.renderLines} title="Render output" />
            </div>
          </details>
        </PanelShell>
      );

    case 'rated':
      return (
        <PanelShell
          videoId={p.videoId}
          title="✓ تم — التقييم محفوظ"
          status="success"
          onClose={p.onClose}
        >
          <TokenSpendBadge tokens={state.tokens} frozen />
          <ReflectionDisplay videoId={p.videoId} initialText={state.reflection} />
          {state.verdict.softWarnings.length > 0 && (
            <ValidatorVerdictDisplay verdict={state.verdict} variant="warnings-only" />
          )}
          <RatingInput
            videoId={p.videoId}
            currentRating={state.rating}
            currentNote={state.note}
          />
        </PanelShell>
      );
  }
}
