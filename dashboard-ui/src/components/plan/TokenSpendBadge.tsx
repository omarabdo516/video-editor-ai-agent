import { memo } from 'react';
import type { TokenEstimate } from '../../store/usePlanStore';

interface Props {
  tokens: TokenEstimate;
  /** When true, shows the final in/out figures and stops dimming the output side. */
  frozen?: boolean;
}

function formatTokens(n: number | undefined): string {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export const TokenSpendBadge = memo(function TokenSpendBadge({
  tokens,
  frozen,
}: Props) {
  const haveOutput = tokens.outputTokensEst != null;
  return (
    <div
      className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] tabular-nums"
      style={{
        background: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border-subtle)',
        color: 'var(--color-text-secondary)',
      }}
      title="Token spend (rough estimate from planner stdout)"
      dir="ltr"
    >
      <span style={{ color: 'var(--color-text-muted)' }}>tokens</span>
      <span>
        ~{formatTokens(tokens.inputTokensEst)} in
      </span>
      <span style={{ color: 'var(--color-border-strong)' }}>·</span>
      <span style={{ opacity: haveOutput || frozen ? 1 : 0.45 }}>
        ~{formatTokens(tokens.outputTokensEst)} out
      </span>
    </div>
  );
});
