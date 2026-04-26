import { memo, useEffect, useState } from 'react';
import { getReflection } from '../../api/client';

interface Props {
  videoId: string;
  /** If the parent already has the reflection text (e.g. from the store after
   *  render-done), pass it in to skip the fetch. */
  initialText?: string | null;
}

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; text: string }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

export const ReflectionDisplay = memo(function ReflectionDisplay({
  videoId,
  initialText,
}: Props) {
  const [state, setState] = useState<FetchState>(
    initialText ? { kind: 'ok', text: initialText } : { kind: 'idle' },
  );

  useEffect(() => {
    if (initialText) {
      setState({ kind: 'ok', text: initialText });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    getReflection(videoId)
      .then((r) => {
        if (cancelled) return;
        setState({ kind: 'ok', text: r.text });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (/404|not available/i.test(msg)) {
          setState({ kind: 'missing' });
        } else {
          setState({ kind: 'error', message: msg });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, initialText]);

  if (state.kind === 'loading' || state.kind === 'idle') {
    return (
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        … جاري تحميل الـ reflection
      </div>
    );
  }

  if (state.kind === 'missing') {
    return (
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        مفيش reflection محفوظة لهذا الفيديو بعد.
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="text-xs" style={{ color: 'var(--color-status-failed)' }}>
        تعذّر تحميل الـ reflection: {state.message}
      </div>
    );
  }

  return (
    <blockquote
      className="rounded-md px-4 py-3 text-sm leading-relaxed"
      dir="rtl"
      style={{
        background: 'var(--color-bg-elevated)',
        borderInlineStartWidth: 3,
        borderInlineStartStyle: 'solid',
        borderInlineStartColor: 'var(--color-brand-accent)',
        color: 'var(--color-text-primary)',
        whiteSpace: 'pre-wrap',
        maxHeight: 240,
        overflowY: 'auto',
      }}
    >
      {state.text}
    </blockquote>
  );
});
