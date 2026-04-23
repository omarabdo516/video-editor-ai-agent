import { memo } from 'react';
import type { PhaseId, Video } from '../api/types';

const STEPS: Array<{ phase: PhaseId; label: string; shortLabel: string }> = [
  { phase: 'phase1', label: 'Phase 1', shortLabel: 'P1' },
  { phase: 'transcribe', label: 'Transcribe', shortLabel: 'TR' },
  { phase: 'edit', label: 'Edit', shortLabel: 'ED' },
  { phase: 'analyze', label: 'Claude', shortLabel: 'AI' },
  { phase: 'microEvents', label: 'Micro', shortLabel: 'ME' },
  { phase: 'render', label: 'Render', shortLabel: 'RN' },
];

interface Props {
  video: Video;
}

export const PipelineStepper = memo(function PipelineStepper({ video }: Props) {
  return (
    <div className="flex items-center gap-0" style={{ direction: 'ltr' }}>
      {STEPS.map((step, i) => {
        const state = video.phases[step.phase];
        const status = state?.status ?? 'pending';

        const isDone = status === 'done';
        const isRunning = status === 'running';
        const isFailed = status === 'failed';

        // Connector line between nodes
        const showConnector = i > 0;
        const prevStatus = STEPS[i - 1]
          ? (video.phases[STEPS[i - 1].phase]?.status ?? 'pending')
          : 'pending';
        const connectorDone = prevStatus === 'done';

        return (
          <div key={step.phase} className="flex items-center">
            {showConnector && (
              <div
                className="h-[2px] transition-all duration-300"
                style={{
                  width: 20,
                  background: connectorDone
                    ? 'var(--color-status-done)'
                    : 'var(--color-border-subtle)',
                }}
              />
            )}
            <div className="flex flex-col items-center gap-1" title={step.label}>
              {/* Node circle */}
              <div
                className="relative flex items-center justify-center rounded-full transition-all duration-300"
                style={{
                  width: 28,
                  height: 28,
                  background: isDone
                    ? 'var(--color-status-done)'
                    : isFailed
                      ? 'var(--color-status-failed)'
                      : isRunning
                        ? 'var(--color-status-running)'
                        : 'var(--color-bg-elevated)',
                  border: `2px solid ${
                    isDone
                      ? 'var(--color-status-done)'
                      : isFailed
                        ? 'var(--color-status-failed)'
                        : isRunning
                          ? 'var(--color-status-running)'
                          : 'var(--color-border-subtle)'
                  }`,
                  boxShadow: isRunning
                    ? '0 0 8px rgba(255, 181, 1, 0.4)'
                    : isFailed
                      ? '0 0 8px rgba(239, 68, 68, 0.3)'
                      : 'none',
                }}
              >
                {isDone && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 7.5L5.5 10L11 4"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {isFailed && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 3L9 9M9 3L3 9" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {isRunning && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
                {status === 'pending' && (
                  <span
                    className="text-[9px] font-bold"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {step.shortLabel}
                  </span>
                )}
              </div>
              {/* Label */}
              <span
                className="text-[9px] font-medium leading-none"
                style={{
                  color: isDone
                    ? 'var(--color-status-done)'
                    : isFailed
                      ? 'var(--color-status-failed)'
                      : isRunning
                        ? 'var(--color-status-running)'
                        : 'var(--color-text-muted)',
                }}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
});
