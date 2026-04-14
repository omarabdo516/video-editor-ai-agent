import { useEffect, useState } from 'react';
import { useSubtitleStore } from '../store/useSubtitleStore';
import {
  formatTimeFull,
  parseTimeInput,
  wordCount,
  wordCountColor,
} from '../utils/time-utils';
import { MIN_SEGMENT_SEC } from '../utils/constants';

export function SubtitleEditPanel() {
  const subtitles = useSubtitleStore((s) => s.subtitles);
  const selectedId = useSubtitleStore((s) => s.selectedId);
  const currentTime = useSubtitleStore((s) => s.currentTime);
  const updateText = useSubtitleStore((s) => s.updateText);
  const updateTiming = useSubtitleStore((s) => s.updateTiming);
  const splitSubtitle = useSubtitleStore((s) => s.splitSubtitle);
  const mergeWithNext = useSubtitleStore((s) => s.mergeWithNext);
  const deleteSubtitle = useSubtitleStore((s) => s.deleteSubtitle);
  const moveLastWordToNext = useSubtitleStore((s) => s.moveLastWordToNext);
  const moveFirstWordToPrev = useSubtitleStore((s) => s.moveFirstWordToPrev);
  const setCurrentTime = useSubtitleStore((s) => s.setCurrentTime);
  const setIsPlaying = useSubtitleStore((s) => s.setIsPlaying);

  const sub = subtitles.find((s) => s.id === selectedId) ?? null;

  // Local edit state — flush to store on blur or Enter
  const [text, setText] = useState('');
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');

  useEffect(() => {
    if (sub) {
      setText(sub.text);
      setStartStr(formatTimeFull(sub.startTime));
      setEndStr(formatTimeFull(sub.endTime));
    } else {
      setText('');
      setStartStr('');
      setEndStr('');
    }
  }, [sub]);

  if (!sub) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-bg-panel)] p-6 text-center font-cairo text-sm text-[var(--color-text-muted)]">
        اختار كابشن من القائمة عشان تعدّله
      </div>
    );
  }

  const wc = wordCount(text);
  const wcColor = wordCountColor(wc);
  const duration = sub.endTime - sub.startTime;
  const isTooShort = duration < MIN_SEGMENT_SEC;

  const flushText = () => {
    if (text !== sub.text) updateText(sub.id, text);
  };

  const flushTiming = () => {
    const start = parseTimeInput(startStr);
    const end = parseTimeInput(endStr);
    if (start === null || end === null) {
      // Reset to last good values
      setStartStr(formatTimeFull(sub.startTime));
      setEndStr(formatTimeFull(sub.endTime));
      return;
    }
    if (end <= start) {
      setStartStr(formatTimeFull(sub.startTime));
      setEndStr(formatTimeFull(sub.endTime));
      return;
    }
    if (start !== sub.startTime || end !== sub.endTime) {
      updateTiming(sub.id, start, end);
    }
  };

  const playRegion = () => {
    setCurrentTime(sub.startTime);
    setIsPlaying(true);
    // Stop at the end — handled by App-level effect that watches currentTime
    // (we don't enforce it here to keep this component dumb)
  };

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-panel)]">
      <div className="border-b border-[var(--color-border-subtle)] px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-cairo text-sm font-semibold text-[var(--color-text-primary)]">
            تعديل #{sub.index}
          </h2>
          <span
            className={[
              'rounded px-2 py-0.5 text-[10px] font-semibold',
              wcColor === 'good'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-amber-500/15 text-amber-400',
            ].join(' ')}
          >
            {wc} كلمة
          </span>
        </div>
        <div className="mt-1 font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
          المدة: {duration.toFixed(2)}s
          {isTooShort && (
            <span className="ml-2 text-amber-400">⚠ قصيرة جداً</span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Timing inputs */}
        <div className="space-y-2">
          <label className="block font-cairo text-[11px] text-[var(--color-text-secondary)]">
            البداية
            <input
              type="text"
              value={startStr}
              onChange={(e) => setStartStr(e.target.value)}
              onBlur={flushTiming}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              dir="ltr"
              className="mt-1 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2 py-1.5 font-mono text-sm tabular-nums focus:border-[var(--color-brand-accent)]"
            />
          </label>
          <label className="block font-cairo text-[11px] text-[var(--color-text-secondary)]">
            النهاية
            <input
              type="text"
              value={endStr}
              onChange={(e) => setEndStr(e.target.value)}
              onBlur={flushTiming}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              dir="ltr"
              className="mt-1 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2 py-1.5 font-mono text-sm tabular-nums focus:border-[var(--color-brand-accent)]"
            />
          </label>
        </div>

        {/* Text */}
        <label className="block font-cairo text-[11px] text-[var(--color-text-secondary)]">
          النص
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={flushText}
            dir="rtl"
            rows={3}
            className="mt-1 w-full resize-y rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 font-cairo text-base leading-relaxed focus:border-[var(--color-brand-accent)]"
          />
        </label>

        {/* Word movement */}
        <div className="grid grid-cols-2 gap-2" dir="rtl">
          <button
            type="button"
            onClick={() => moveFirstWordToPrev(sub.id)}
            disabled={sub.index === 1 || wordCount(text) <= 1}
            className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 font-cairo text-xs hover:border-[var(--color-brand-accent)] disabled:hover:border-[var(--color-border-subtle)]"
          >
            ◀ أول كلمة → السابق
          </button>
          <button
            type="button"
            onClick={() => moveLastWordToNext(sub.id)}
            disabled={sub.index === subtitles.length || wordCount(text) <= 1}
            className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 font-cairo text-xs hover:border-[var(--color-brand-accent)] disabled:hover:border-[var(--color-border-subtle)]"
          >
            آخر كلمة → التالي ▶
          </button>
        </div>

        {/* Edit actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => splitSubtitle(sub.id, currentTime)}
            disabled={
              currentTime <= sub.startTime ||
              currentTime >= sub.endTime ||
              wordCount(text) < 2
            }
            className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2 py-2 font-cairo text-xs hover:border-[var(--color-brand-accent)] disabled:hover:border-[var(--color-border-subtle)]"
            title="قسّم عند موضع الـ playhead الحالي"
          >
            ✂️ Split
          </button>
          <button
            type="button"
            onClick={() => mergeWithNext(sub.id)}
            disabled={sub.index === subtitles.length}
            className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2 py-2 font-cairo text-xs hover:border-[var(--color-brand-accent)] disabled:hover:border-[var(--color-border-subtle)]"
            title="ادمج مع الكابشن اللي بعده"
          >
            🔗 Merge
          </button>
          <button
            type="button"
            onClick={() => deleteSubtitle(sub.id)}
            className="rounded-md border border-red-900/50 bg-red-950/30 px-2 py-2 font-cairo text-xs text-red-400 hover:border-red-500 hover:bg-red-950/60"
            title="احذف الكابشن"
          >
            🗑 Delete
          </button>
        </div>

        <button
          type="button"
          onClick={playRegion}
          className="w-full rounded-md border border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/20 px-3 py-2 font-cairo text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-brand-primary)]/40"
        >
          ▶ شغّل الكابشن
        </button>
      </div>
    </div>
  );
}
