import { useEffect, useMemo, useState } from 'react';
import { useSubtitleStore } from '../store/useSubtitleStore';

type Props = {
  onClose: () => void;
};

/**
 * Inline find/replace panel that sits under the toolbar. Collapses on
 * close via the parent's state. Shows a live match count as the user
 * types in the Find box. Replace All is disabled until there's at least
 * one match to prevent accidental empty replacements.
 */
export function FindReplacePanel({ onClose }: Props) {
  const findReplaceAll = useSubtitleStore((s) => s.findReplaceAll);
  const countMatches = useSubtitleStore((s) => s.countMatches);
  const subtitles = useSubtitleStore((s) => s.subtitles);

  const [find, setFind] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Recount whenever the query, case-sensitivity, or subtitles change.
  // `subtitles` is included so a successful Replace All immediately drops
  // the match count to zero (or whatever's left) without a stale UI.
  const matchCount = useMemo(
    () => (find ? countMatches(find, caseSensitive) : 0),
    [find, caseSensitive, countMatches, subtitles],
  );

  // Clear the last-result toast when the user edits the find/replace
  // inputs — otherwise it lingers and looks stale.
  useEffect(() => {
    setLastResult(null);
  }, [find, replaceWith, caseSensitive]);

  const handleReplaceAll = () => {
    if (!find || matchCount === 0) return;
    const n = findReplaceAll(find, replaceWith, caseSensitive);
    setLastResult(n > 0 ? `✅ استبدلت ${n} مرة` : '⚠️ مفيش تغيير');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReplaceAll();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-2"
      role="search"
      aria-label="Find and replace"
    >
      <span className="font-cairo text-[11px] text-[var(--color-text-muted)]">
        🔍 Find / Replace
      </span>

      <input
        type="text"
        value={find}
        onChange={(e) => setFind(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="دوّر على..."
        autoFocus
        dir="auto"
        className="w-52 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-2 py-1 font-cairo text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-accent)]"
      />

      <span className="font-cairo text-[11px] text-[var(--color-text-muted)]">
        استبدل بـ
      </span>

      <input
        type="text"
        value={replaceWith}
        onChange={(e) => setReplaceWith(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="الكلمة الجديدة"
        dir="auto"
        className="w-52 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-2 py-1 font-cairo text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-accent)]"
      />

      <label className="flex items-center gap-1.5 font-cairo text-[11px] text-[var(--color-text-secondary)]">
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={(e) => setCaseSensitive(e.target.checked)}
          className="h-3 w-3 accent-[var(--color-brand-accent)]"
        />
        Case sensitive
      </label>

      <div className="font-cairo text-[11px] tabular-nums text-[var(--color-text-muted)]">
        {find ? (
          matchCount > 0 ? (
            <span className="text-[var(--color-brand-accent)]">
              {matchCount} match
            </span>
          ) : (
            <span>لا يوجد</span>
          )
        ) : (
          <span>...</span>
        )}
      </div>

      <button
        type="button"
        onClick={handleReplaceAll}
        disabled={!find || matchCount === 0}
        title="Replace all (Enter)"
        className="rounded-md bg-[var(--color-brand-accent)] px-3 py-1 font-cairo text-xs font-bold text-black hover:brightness-110 disabled:opacity-40"
      >
        Replace All
      </button>

      {lastResult && (
        <span className="font-cairo text-[11px] text-[var(--color-text-secondary)]">
          {lastResult}
        </span>
      )}

      <div className="flex-1" />

      <button
        type="button"
        onClick={onClose}
        title="Close (Esc)"
        className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-2 py-1 font-cairo text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-brand-accent)]"
      >
        ✕
      </button>
    </div>
  );
}
