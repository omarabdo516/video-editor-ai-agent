import { useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

export function AddVideoForm() {
  const addVideo = useDashboardStore((s) => s.addVideo);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [lecturer, setLecturer] = useState('');
  const [workshop, setWorkshop] = useState('');

  const reset = () => {
    setPath('');
    setName('');
    setLecturer('');
    setWorkshop('');
    setError(null);
  };

  const validate = (): string | null => {
    if (!path.trim()) return 'الـ path مطلوب';
    const lower = path.trim().toLowerCase();
    if (!lower.endsWith('.mp4') && !lower.endsWith('.mov')) {
      return 'الفيديو لازم يكون .mp4 أو .mov';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addVideo({
        path: path.trim(),
        name: name.trim() || undefined,
        lecturer: lecturer.trim() || undefined,
        workshop: workshop.trim() || undefined,
      });
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md px-4 py-2 text-sm font-semibold"
        style={{
          background: 'var(--color-brand-accent)',
          color: 'var(--color-brand-dark)',
        }}
      >
        + Add Video
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl border p-6 shadow-2xl"
        style={{
          borderColor: 'var(--color-border-subtle)',
          background: 'var(--color-bg-panel)',
        }}
      >
        <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-brand-accent)' }}>
          إضافة فيديو جديد
        </h2>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Path (مطلوب) <span dir="ltr">— e.g. D:\videos\lesson.mp4</span>
            </span>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="D:\\... "
              autoFocus
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span style={{ color: 'var(--color-text-secondary)' }}>الاسم (اختياري)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="بيتولّد أوتوماتيك من اسم الملف لو سبته فاضي"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span style={{ color: 'var(--color-text-secondary)' }}>المحاضر</span>
              <input
                type="text"
                value={lecturer}
                onChange={(e) => setLecturer(e.target.value)}
                placeholder="مثلاً: محمد ريان"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span style={{ color: 'var(--color-text-secondary)' }}>الورشة</span>
              <input
                type="text"
                value={workshop}
                onChange={(e) => setWorkshop(e.target.value)}
                placeholder="مثلاً: المحاسب الشامل"
              />
            </label>
          </div>
        </div>

        {error && (
          <div
            className="mt-4 rounded-md px-3 py-2 text-xs"
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              color: 'var(--color-status-failed)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            className="rounded-md px-4 py-2 text-sm font-medium"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
            }}
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md px-4 py-2 text-sm font-semibold"
            style={{
              background: 'var(--color-brand-accent)',
              color: 'var(--color-brand-dark)',
            }}
          >
            {submitting ? 'جاري الإضافة...' : 'إضافة'}
          </button>
        </div>
      </form>
    </div>
  );
}
