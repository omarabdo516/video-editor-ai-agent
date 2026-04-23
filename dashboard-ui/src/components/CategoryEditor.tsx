import { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

interface Props {
  videoId: string;
  currentCategory: string | null;
}

export function CategoryEditor({ videoId, currentCategory }: Props) {
  const updateVideoMeta = useDashboardStore((s) => s.updateVideoMeta);
  const videos = useDashboardStore((s) => s.videos);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentCategory ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Collect existing categories for suggestions
  const suggestions = useMemo(() => {
    const cats = new Set<string>();
    for (const v of videos) {
      if (v.category) cats.add(v.category);
    }
    return [...cats].sort();
  }, [videos]);

  useEffect(() => {
    if (editing) {
      setValue(currentCategory ?? '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editing, currentCategory]);

  const handleSave = () => {
    const trimmed = value.trim();
    void updateVideoMeta(videoId, { category: trimmed || null });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setEditing(false);
          }}
          list="category-suggestions"
          placeholder="Category name..."
          className="w-28 rounded px-2 py-0.5 text-[11px]"
          style={{
            background: 'var(--color-bg-base)',
            border: '1px solid var(--color-brand-accent)',
            color: 'var(--color-text-primary)',
          }}
        />
        <datalist id="category-suggestions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={handleSave}
          className="rounded px-1.5 py-0.5 text-[10px] font-bold"
          style={{
            background: 'var(--color-brand-accent)',
            color: '#000',
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-[10px]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (currentCategory) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors"
        style={{
          background: 'rgba(255, 181, 1, 0.1)',
          border: '1px solid rgba(255, 181, 1, 0.3)',
          color: 'var(--color-brand-accent)',
        }}
        title="Click to edit category"
      >
        {currentCategory}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="rounded-full px-2 py-0.5 text-[10px] transition-colors"
      style={{
        background: 'var(--color-bg-base)',
        border: '1px dashed var(--color-border-strong)',
        color: 'var(--color-text-muted)',
      }}
      title="Add category"
    >
      + Category
    </button>
  );
}
