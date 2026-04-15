import { useEffect, useRef, useState } from 'react';

interface Props {
  lines: string[];
  maxHeight?: number;
  defaultExpanded?: boolean;
  title?: string;
}

export function LogViewer({
  lines,
  maxHeight = 240,
  defaultExpanded = false,
  title = 'Logs',
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  // Auto-scroll to bottom when new lines arrive, but only if the user hasn't
  // scrolled up. Threshold 40px gives a little slack for sub-pixel rounding.
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
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 40;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: create a temporary textarea.
      const ta = document.createElement('textarea');
      ta.value = lines.join('\n');
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <div
      className="rounded-md border text-xs"
      style={{
        borderColor: 'var(--color-border-subtle)',
        background: 'var(--color-bg-base)',
      }}
    >
      <div
        className="flex items-center justify-between px-2 py-1"
        style={{ borderBottom: expanded ? '1px solid var(--color-border-subtle)' : 'none' }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <span aria-hidden>{expanded ? '▾' : '▸'}</span>
          <span>
            {title} ({lines.length})
          </span>
        </button>
        {expanded && lines.length > 0 && (
          <button
            type="button"
            onClick={handleCopy}
            className="rounded px-2 py-0.5 text-[10px]"
            style={{
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        )}
      </div>
      {expanded && (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="overflow-y-auto px-2 py-1 font-mono leading-relaxed"
          style={{
            maxHeight,
            color: 'var(--color-text-secondary)',
            fontSize: '10.5px',
            direction: 'ltr',
            textAlign: 'left',
          }}
        >
          {lines.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)' }}>— no output yet —</div>
          ) : (
            lines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
