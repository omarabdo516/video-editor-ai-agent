import { useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

interface Props {
  videoId: string;
  currentRating: number | null;
  currentNote: string | null;
}

export function RatingInput({ videoId, currentRating, currentNote }: Props) {
  const submitRating = useDashboardStore((s) => s.submitRating);
  const [editing, setEditing] = useState(currentRating == null);
  const [rating, setRating] = useState<number>(currentRating ?? 0);
  const [hover, setHover] = useState<number | null>(null);
  const [note, setNote] = useState<string>(currentNote ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!rating || rating < 1 || rating > 5) {
      setError('اختار rating من 1 لـ 5');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitRating(videoId, rating, note.trim() || undefined);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!editing && currentRating != null) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
        style={{
          borderColor: 'var(--color-border-subtle)',
          background: 'var(--color-bg-elevated)',
        }}
      >
        <span style={{ color: 'var(--color-brand-accent)' }}>
          {'★'.repeat(Math.floor(currentRating))}
          {currentRating % 1 >= 0.5 ? '½' : ''}
        </span>
        <span style={{ color: 'var(--color-text-secondary)' }}>
          {currentRating.toFixed(1)}/5
        </span>
        {currentNote && (
          <span
            className="truncate"
            style={{ color: 'var(--color-text-muted)' }}
            title={currentNote}
          >
            — {currentNote}
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ms-auto text-[11px] underline"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          تعديل
        </button>
        {saved && (
          <span
            className="text-[11px]"
            style={{ color: 'var(--color-status-done)' }}
          >
            ✓ Saved
          </span>
        )}
      </div>
    );
  }

  const displayRating = hover ?? rating;

  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-3"
      style={{
        borderColor: 'var(--color-border-subtle)',
        background: 'var(--color-bg-elevated)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-semibold"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          تقييم الريل:
        </span>
        <div
          className="flex items-center gap-1"
          onMouseLeave={() => setHover(null)}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHover(star)}
              onClick={() => setRating(star)}
              className="text-xl leading-none transition-transform hover:scale-110"
              style={{
                color:
                  star <= displayRating
                    ? 'var(--color-brand-accent)'
                    : 'var(--color-text-muted)',
                background: 'transparent',
                padding: 0,
                border: 'none',
              }}
              aria-label={`${star} stars`}
            >
              ★
            </button>
          ))}
        </div>
        {rating > 0 && (
          <span
            className="text-xs tabular-nums"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {rating}/5
          </span>
        )}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة اختيارية (إيه اللي اشتغل / إيه اللي محتاج تحسين)"
        rows={2}
        className="w-full text-xs"
        style={{ resize: 'vertical' }}
      />
      {error && (
        <div
          className="rounded-md px-2 py-1 text-[11px]"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            color: 'var(--color-status-failed)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
          }}
        >
          {error}
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        {currentRating != null && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setRating(currentRating);
              setNote(currentNote ?? '');
              setError(null);
            }}
            className="rounded-md px-3 py-1.5 text-xs"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
            }}
          >
            إلغاء
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting || rating < 1}
          className="rounded-md px-3 py-1.5 text-xs font-semibold"
          style={{
            background: 'var(--color-brand-accent)',
            color: 'var(--color-brand-dark)',
          }}
        >
          {submitting ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </div>
    </div>
  );
}
