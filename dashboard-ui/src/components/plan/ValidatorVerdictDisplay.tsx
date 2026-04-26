import { memo } from 'react';
import type { ValidatorVerdict, ViolationEntry } from '../../api/types';

interface Props {
  verdict: ValidatorVerdict;
  /** "full" shows hard violations + soft warnings; "warnings-only" hides
   *  hardViolations (used in the post-render success state to surface mild
   *  signals next to Omar's rating control). */
  variant?: 'full' | 'warnings-only';
}

function ViolationList({
  entries,
  tone,
}: {
  entries: ViolationEntry[];
  tone: 'hard' | 'soft';
}) {
  if (entries.length === 0) return null;
  const color = tone === 'hard' ? 'var(--color-status-failed)' : 'var(--color-status-running)';
  const bg = tone === 'hard' ? 'var(--color-danger-subtle)' : 'var(--color-accent-subtle)';
  const label = tone === 'hard' ? 'Hard violations (block render)' : 'Soft warnings';
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{
        background: bg,
        borderColor: color,
        borderLeftWidth: 3,
      }}
    >
      <div
        className="mb-1 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color }}
        dir="ltr"
      >
        {label} · {entries.length}
      </div>
      <ul className="space-y-1 text-xs" dir="ltr">
        {entries.map((v, i) => (
          <li
            key={`${v.rule}-${v.path}-${i}`}
            className="font-mono"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span style={{ color, fontWeight: 600 }}>[{v.rule}]</span>{' '}
            <span style={{ color: 'var(--color-text-muted)' }}>{v.path}:</span>{' '}
            <span style={{ color: 'var(--color-text-primary)' }}>{v.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const ValidatorVerdictDisplay = memo(function ValidatorVerdictDisplay({
  verdict,
  variant = 'full',
}: Props) {
  const showHard = variant === 'full';
  return (
    <div className="flex flex-col gap-2">
      {showHard && <ViolationList entries={verdict.hardViolations} tone="hard" />}
      <ViolationList entries={verdict.softWarnings} tone="soft" />
    </div>
  );
});
