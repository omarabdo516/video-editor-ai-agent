import { useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { parseVideoPath, scanFolder } from '../api/client';
import type { ScanFolderEntry } from '../api/types';

type Mode = 'single' | 'folder';

// Local per-row editable state for the folder-scan results grid.
interface ScanRow extends ScanFolderEntry {
  selected: boolean;
  editedLecturer: string;
  editedWorkshop: string;
}

export function AddVideoForm() {
  const addVideo = useDashboardStore((s) => s.addVideo);
  const bulkAddVideos = useDashboardStore((s) => s.bulkAddVideos);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('single');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Single-video form state ─────────────────────────────────────────
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [lecturer, setLecturer] = useState('');
  const [workshop, setWorkshop] = useState('');

  // ── Folder-scan state ───────────────────────────────────────────────
  const [folderPath, setFolderPath] = useState('');
  const [recursive, setRecursive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const resetSingle = () => {
    setPath('');
    setName('');
    setLecturer('');
    setWorkshop('');
    setError(null);
  };

  const resetFolder = () => {
    setFolderPath('');
    setRecursive(false);
    setRows([]);
    setScanMessage(null);
    setError(null);
  };

  const closeAll = () => {
    setOpen(false);
    setMode('single');
    resetSingle();
    resetFolder();
  };

  // ── Auto-parse on path blur (single mode) ───────────────────────────
  const handlePathBlur = async () => {
    const trimmed = path.trim();
    if (!trimmed) return;
    // Only auto-fill if user hasn't already typed values
    if (lecturer || workshop) return;
    try {
      const parsed = await parseVideoPath(trimmed);
      if (parsed.lecturer && !lecturer) setLecturer(parsed.lecturer);
      if (parsed.workshop && !workshop) setWorkshop(parsed.workshop);
      if (parsed.name && !name) setName(parsed.name);
    } catch {
      // Silent — the user can still type manually.
    }
  };

  const validateSingle = (): string | null => {
    if (!path.trim()) return 'الـ path مطلوب';
    const lower = path.trim().toLowerCase();
    const validExt = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];
    if (!validExt.some((ext) => lower.endsWith(ext))) {
      return 'الفيديو لازم يكون .mp4 / .mov / .mkv / .avi / .webm';
    }
    return null;
  };

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateSingle();
    if (v) {
      setError(v);
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
      closeAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Folder scan ─────────────────────────────────────────────────────
  const handleScan = async () => {
    if (!folderPath.trim()) {
      setError('الـ folder path مطلوب');
      return;
    }
    setScanning(true);
    setError(null);
    setScanMessage(null);
    try {
      const resp = await scanFolder(folderPath.trim(), recursive);
      const nextRows: ScanRow[] = resp.found.map((e) => ({
        ...e,
        selected: !e.alreadyTracked,
        editedLecturer: e.suggestedLecturer ?? '',
        editedWorkshop: e.suggestedWorkshop ?? '',
      }));
      setRows(nextRows);
      if (nextRows.length === 0) {
        setScanMessage('مفيش فيديوهات في الفولدر ده');
      } else {
        const newCount = nextRows.filter((r) => !r.alreadyTracked).length;
        setScanMessage(
          `لقيت ${nextRows.length} فيديو — ${newCount} جديد، ${nextRows.length - newCount} متسجّل قبل كده`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const toggleRow = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, selected: !r.selected } : r,
      ),
    );
  };

  const updateRow = (idx: number, field: 'editedLecturer' | 'editedWorkshop', value: string) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const selectAll = () => {
    setRows((prev) =>
      prev.map((r) => ({ ...r, selected: !r.alreadyTracked })),
    );
  };

  const clearAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: false })));
  };

  const handleSubmitFolder = async () => {
    const toAdd = rows.filter((r) => r.selected && !r.alreadyTracked);
    if (toAdd.length === 0) {
      setError('اختار فيديو واحد على الأقل');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await bulkAddVideos(
        toAdd.map((r) => ({
          path: r.path,
          name: r.suggestedName,
          lecturer: r.editedLecturer.trim() || undefined,
          workshop: r.editedWorkshop.trim() || undefined,
        })),
      );
      if (resp.errors.length > 0) {
        setError(
          `اتضاف ${resp.added.length} — فشل ${resp.errors.length}: ${resp.errors[0].error}`,
        );
        setSubmitting(false);
        return;
      }
      closeAll();
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
        if (e.target === e.currentTarget) closeAll();
      }}
    >
      <div
        className="w-full max-w-4xl rounded-xl border p-6 shadow-2xl"
        style={{
          borderColor: 'var(--color-border-subtle)',
          background: 'var(--color-bg-panel)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* ── Header tabs ────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-brand-accent)' }}>
            إضافة فيديوهات
          </h2>
          <div
            className="flex gap-1 rounded-md p-1"
            style={{ background: 'var(--color-bg-elevated)' }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('single');
                setError(null);
              }}
              className="rounded px-3 py-1 text-xs font-medium"
              style={{
                background:
                  mode === 'single' ? 'var(--color-brand-accent)' : 'transparent',
                color:
                  mode === 'single'
                    ? 'var(--color-brand-dark)'
                    : 'var(--color-text-secondary)',
              }}
            >
              فيديو واحد
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('folder');
                setError(null);
              }}
              className="rounded px-3 py-1 text-xs font-medium"
              style={{
                background:
                  mode === 'folder' ? 'var(--color-brand-accent)' : 'transparent',
                color:
                  mode === 'folder'
                    ? 'var(--color-brand-dark)'
                    : 'var(--color-text-secondary)',
              }}
            >
              فولدر كامل
            </button>
          </div>
        </div>

        {/* ── Single mode ──────────────────────────────────────────── */}
        {mode === 'single' && (
          <form onSubmit={handleSubmitSingle} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span style={{ color: 'var(--color-text-secondary)' }}>
                Path (مطلوب) <span dir="ltr">— e.g. D:\videos\lesson.mp4</span>
              </span>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onBlur={handlePathBlur}
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
                  placeholder="بيتعبّى من اسم الملف تلقائياً"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span style={{ color: 'var(--color-text-secondary)' }}>الورشة</span>
                <input
                  type="text"
                  value={workshop}
                  onChange={(e) => setWorkshop(e.target.value)}
                  placeholder="بيتعبّى من اسم الملف تلقائياً"
                />
              </label>
            </div>

            {error && (
              <div
                className="rounded-md px-3 py-2 text-xs"
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: 'var(--color-status-failed)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                }}
              >
                {error}
              </div>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAll}
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
        )}

        {/* ── Folder mode ──────────────────────────────────────────── */}
        {mode === 'folder' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1 text-xs">
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  Folder path <span dir="ltr">— e.g. D:\videos\batch-april</span>
                </span>
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="D:\\videos\\..."
                  dir="ltr"
                  style={{ textAlign: 'left' }}
                  autoFocus
                />
              </label>
              <label className="flex items-center gap-1.5 pb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={recursive}
                  onChange={(e) => setRecursive(e.target.checked)}
                />
                Recursive
              </label>
              <button
                type="button"
                onClick={handleScan}
                disabled={scanning}
                className="rounded-md px-4 py-2 text-sm font-semibold"
                style={{
                  background: 'var(--color-brand-accent)',
                  color: 'var(--color-brand-dark)',
                }}
              >
                {scanning ? '...' : 'Scan'}
              </button>
            </div>

            {scanMessage && (
              <div
                className="rounded-md px-3 py-2 text-xs"
                style={{
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {scanMessage}
              </div>
            )}

            {rows.length > 0 && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <div style={{ color: 'var(--color-text-secondary)' }}>
                    {rows.filter((r) => r.selected).length} / {rows.length} محدد
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="rounded px-2 py-1"
                      style={{
                        border: '1px solid var(--color-border-subtle)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      اختار الكل
                    </button>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="rounded px-2 py-1"
                      style={{
                        border: '1px solid var(--color-border-subtle)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      امسح الكل
                    </button>
                  </div>
                </div>

                <div
                  className="overflow-hidden rounded-lg border"
                  style={{ borderColor: 'var(--color-border-subtle)' }}
                >
                  <div
                    className="grid gap-2 px-3 py-2 text-[10px] font-semibold uppercase"
                    style={{
                      gridTemplateColumns: '32px 1fr 180px 220px 80px',
                      background: 'var(--color-bg-elevated)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <div></div>
                    <div>الملف</div>
                    <div>المحاضر</div>
                    <div>الورشة</div>
                    <div>الحالة</div>
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {rows.map((row, idx) => (
                      <div
                        key={row.path}
                        className="grid items-center gap-2 px-3 py-2 text-xs"
                        style={{
                          gridTemplateColumns: '32px 1fr 180px 220px 80px',
                          borderTop: '1px solid var(--color-border-subtle)',
                          opacity: row.alreadyTracked ? 0.45 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={row.alreadyTracked}
                          onChange={() => toggleRow(idx)}
                        />
                        <div
                          className="truncate"
                          dir="ltr"
                          title={row.path}
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {row.basename}
                        </div>
                        <input
                          type="text"
                          value={row.editedLecturer}
                          disabled={row.alreadyTracked}
                          onChange={(e) =>
                            updateRow(idx, 'editedLecturer', e.target.value)
                          }
                          placeholder="—"
                          className="rounded px-2 py-1"
                          style={{
                            background: 'var(--color-bg-elevated)',
                            border: '1px solid var(--color-border-subtle)',
                            color: 'var(--color-text-primary)',
                          }}
                        />
                        <input
                          type="text"
                          value={row.editedWorkshop}
                          disabled={row.alreadyTracked}
                          onChange={(e) =>
                            updateRow(idx, 'editedWorkshop', e.target.value)
                          }
                          placeholder="—"
                          className="rounded px-2 py-1"
                          style={{
                            background: 'var(--color-bg-elevated)',
                            border: '1px solid var(--color-border-subtle)',
                            color: 'var(--color-text-primary)',
                          }}
                        />
                        <div
                          className="text-[10px]"
                          style={{
                            color: row.alreadyTracked
                              ? 'var(--color-text-muted)'
                              : 'var(--color-brand-accent)',
                          }}
                        >
                          {row.alreadyTracked ? 'متسجّل' : 'جديد'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {error && (
              <div
                className="rounded-md px-3 py-2 text-xs"
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: 'var(--color-status-failed)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                }}
              >
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAll}
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
                type="button"
                onClick={handleSubmitFolder}
                disabled={
                  submitting || rows.filter((r) => r.selected).length === 0
                }
                className="rounded-md px-4 py-2 text-sm font-semibold"
                style={{
                  background: 'var(--color-brand-accent)',
                  color: 'var(--color-brand-dark)',
                }}
              >
                {submitting
                  ? 'جاري الإضافة...'
                  : `أضف ${rows.filter((r) => r.selected).length} فيديو`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
