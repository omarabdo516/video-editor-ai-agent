import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  lines: string[];
  maxHeight?: number;
  defaultExpanded?: boolean;
  title?: string;
}

type LineKind = 'error' | 'warning' | 'success' | 'default';

// Patterns that classify a line by kind
const ERROR_RE = /\b(error|err|fail|failed|fatal|exception|traceback|ENOENT|EACCES|✗)\b/i;
const WARN_RE = /\b(warn|warning|deprecated|⚠)\b/i;
const SUCCESS_RE = /\b(done|success|complete|finished|✓|passed)\b/i;

function classifyLine(line: string): LineKind {
  if (ERROR_RE.test(line)) return 'error';
  if (WARN_RE.test(line)) return 'warning';
  if (SUCCESS_RE.test(line)) return 'success';
  return 'default';
}

const KIND_COLORS: Record<LineKind, string> = {
  error: 'var(--color-status-failed)',
  warning: 'var(--color-status-running)',
  success: 'var(--color-status-done)',
  default: 'var(--color-text-secondary)',
};

export function LogViewer({
  lines,
  maxHeight = 280,
  defaultExpanded = false,
  title = 'Logs',
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [copiedLine, setCopiedLine] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  // Classified lines with search filtering
  const processed = useMemo(() => {
    const lower = search.toLowerCase();
    return lines.map((text, i) => ({
      text,
      index: i,
      kind: classifyLine(text),
      visible: !search || text.toLowerCase().includes(lower),
    }));
  }, [lines, search]);

  const visibleCount = processed.filter((l) => l.visible).length;
  const errorCount = processed.filter((l) => l.kind === 'error').length;
  const warnCount = processed.filter((l) => l.kind === 'warning').length;

  // Auto-scroll
  useEffect(() => {
    if (!expanded) return;
    const el = containerRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines, expanded]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = dist < 40;
  };

  const handleCopyAll = useCallback(async () => {
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [lines]);

  const handleCopyLine = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedLine(idx);
    setTimeout(() => setCopiedLine(null), 1200);
  }, []);

  // Highlight search matches in text
  const highlight = useCallback(
    (text: string) => {
      if (!search) return text;
      const idx = text.toLowerCase().indexOf(search.toLowerCase());
      if (idx === -1) return text;
      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + search.length);
      const after = text.slice(idx + search.length);
      return (
        <>
          {before}
          <mark
            style={{
              background: 'rgba(255, 181, 1, 0.35)',
              color: 'var(--color-text-primary)',
              borderRadius: 2,
              padding: '0 1px',
            }}
          >
            {match}
          </mark>
          {after}
        </>
      );
    },
    [search],
  );

  return (
    <div
      className="rounded-md border text-xs"
      style={{
        borderColor: 'var(--color-border-subtle)',
        background: 'var(--color-bg-base)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 px-2 py-1.5"
        style={{
          borderBottom: expanded ? '1px solid var(--color-border-subtle)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 text-[11px] font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <span aria-hidden>{expanded ? '▾' : '▸'}</span>
          <span>{title}</span>
          <span
            className="rounded-full px-1.5 py-px text-[9px] font-bold"
            style={{
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-muted)',
            }}
          >
            {lines.length}
          </span>
          {/* Error/warning badges */}
          {errorCount > 0 && (
            <span
              className="rounded-full px-1.5 py-px text-[9px] font-bold"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--color-status-failed)',
              }}
            >
              {errorCount} err
            </span>
          )}
          {warnCount > 0 && (
            <span
              className="rounded-full px-1.5 py-px text-[9px] font-bold"
              style={{
                background: 'rgba(255, 181, 1, 0.12)',
                color: 'var(--color-status-running)',
              }}
            >
              {warnCount} warn
            </span>
          )}
        </button>

        {expanded && (
          <div className="flex items-center gap-2">
            {lines.length > 0 && (
              <button
                type="button"
                onClick={handleCopyAll}
                className="rounded px-2 py-0.5 text-[10px]"
                style={{
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {copied ? '✓ Copied' : 'Copy all'}
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <>
          {/* Search bar */}
          {lines.length > 5 && (
            <div
              className="flex items-center gap-2 px-2 py-1"
              style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
            >
              <span
                className="text-[10px]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Search:
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter logs..."
                className="flex-1 rounded px-2 py-0.5 text-[10.5px]"
                style={{
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'monospace',
                }}
              />
              {search && (
                <span
                  className="text-[10px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {visibleCount}/{lines.length}
                </span>
              )}
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-[10px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Log lines */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="overflow-y-auto font-mono"
            style={{
              maxHeight,
              fontSize: '10.5px',
              direction: 'ltr',
              textAlign: 'left',
            }}
          >
            {lines.length === 0 ? (
              <div
                className="px-3 py-3"
                style={{ color: 'var(--color-text-muted)' }}
              >
                — no output yet —
              </div>
            ) : (
              processed.map(
                (line) =>
                  line.visible && (
                    <div
                      key={line.index}
                      className="group flex cursor-pointer transition-colors"
                      style={{
                        borderBottom: '1px solid rgba(38, 40, 52, 0.4)',
                      }}
                      onClick={() => handleCopyLine(line.text, line.index)}
                      title="Click to copy this line"
                    >
                      {/* Line number */}
                      <span
                        className="shrink-0 select-none px-2 py-px text-right"
                        style={{
                          width: 38,
                          color: 'var(--color-text-muted)',
                          background: 'rgba(26, 28, 37, 0.5)',
                          borderRight: '1px solid var(--color-border-subtle)',
                          fontSize: '9.5px',
                          lineHeight: '1.65',
                        }}
                      >
                        {copiedLine === line.index ? '✓' : line.index + 1}
                      </span>

                      {/* Line kind indicator */}
                      <span
                        className="shrink-0"
                        style={{
                          width: 3,
                          background:
                            line.kind !== 'default'
                              ? KIND_COLORS[line.kind]
                              : 'transparent',
                        }}
                      />

                      {/* Line text */}
                      <span
                        className="flex-1 whitespace-pre-wrap break-all px-2 py-px leading-relaxed"
                        style={{
                          color: KIND_COLORS[line.kind],
                        }}
                      >
                        {highlight(line.text)}
                      </span>
                    </div>
                  ),
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
