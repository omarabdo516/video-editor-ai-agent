import { useEffect, useRef, useState } from 'react';
import { useSubtitleStore } from '../store/useSubtitleStore';
import { formatTimeShort, wordCount, wordCountColor } from '../utils/time-utils';

export function SubtitleList() {
  const subtitles = useSubtitleStore((s) => s.subtitles);
  const selectedId = useSubtitleStore((s) => s.selectedId);
  const currentTime = useSubtitleStore((s) => s.currentTime);
  const isPlaying = useSubtitleStore((s) => s.isPlaying);
  const selectSubtitle = useSubtitleStore((s) => s.selectSubtitle);
  const setCurrentTime = useSubtitleStore((s) => s.setCurrentTime);

  const [search, setSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll the active item into view as the playhead moves — but ONLY during
  // playback. When paused, the user is typically browsing the list manually
  // and auto-scrolling back to the active item fights their intent.
  const activeId = subtitles.find(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime,
  )?.id;

  useEffect(() => {
    if (!activeId || !isPlaying) return;
    const el = itemRefs.current.get(activeId);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeId, isPlaying]);

  const filtered = search.trim()
    ? subtitles.filter((s) => s.text.toLowerCase().includes(search.trim().toLowerCase()))
    : subtitles;

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-panel)]">
      <div className="border-b border-[var(--color-border-subtle)] p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث في الكابشنز…"
          dir="rtl"
          className="w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 font-cairo text-sm placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-accent)]"
        />
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center font-cairo text-sm text-[var(--color-text-muted)]">
            {search.trim() ? 'لا توجد نتائج' : 'مفيش كابشنز محمّلة'}
          </div>
        ) : (
          filtered.map((sub) => {
            const isActive = sub.id === activeId;
            const isSelected = sub.id === selectedId;
            const wc = wordCount(sub.text);
            const wcColor = wordCountColor(wc);

            return (
              <div
                key={sub.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(sub.id, el);
                  else itemRefs.current.delete(sub.id);
                }}
                onClick={() => {
                  selectSubtitle(sub.id);
                  setCurrentTime(sub.startTime);
                }}
                className={[
                  'cursor-pointer border-b border-[var(--color-border-subtle)] p-3 transition-colors',
                  'hover:bg-[var(--color-bg-elevated)]',
                  isSelected && 'bg-[var(--color-bg-elevated)]',
                  isActive && 'border-r-2 border-r-[var(--color-brand-accent)]',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--color-text-muted)] tabular-nums">
                  <span className="font-mono">#{sub.index}</span>
                  <span className="font-mono">
                    {formatTimeShort(sub.startTime)} → {formatTimeShort(sub.endTime)}
                  </span>
                  <span
                    className={[
                      'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                      wcColor === 'good'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-400',
                    ].join(' ')}
                  >
                    {wc} كلمة
                  </span>
                </div>
                <p
                  className="font-cairo text-sm leading-snug text-[var(--color-text-primary)]"
                  dir="rtl"
                >
                  {sub.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
