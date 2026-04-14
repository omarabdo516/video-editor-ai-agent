import { useState, type DragEvent } from 'react';
import { useSubtitleStore } from '../store/useSubtitleStore';

/**
 * Full-screen drop overlay for loading a video + a captions file.
 * Accepts: any video file + (.srt | .json). Both can be dropped together.
 */
export function Dropzone() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setVideo = useSubtitleStore((s) => s.setVideo);
  const importSRT = useSubtitleStore((s) => s.importSRT);
  const importAgentJSON = useSubtitleStore((s) => s.importAgentJSON);
  const videoUrl = useSubtitleStore((s) => s.videoUrl);
  const subtitleCount = useSubtitleStore((s) => s.subtitles.length);

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    let loadedVideo = false;
    let loadedSubs = false;

    for (const file of files) {
      const lower = file.name.toLowerCase();

      if (file.type.startsWith('video/') || /\.(mp4|mov|mkv|webm|avi)$/.test(lower)) {
        const url = URL.createObjectURL(file);
        setVideo(url, file.name);
        loadedVideo = true;
      } else if (lower.endsWith('.srt')) {
        const text = await file.text();
        importSRT(text);
        loadedSubs = true;
      } else if (lower.endsWith('.json')) {
        const text = await file.text();
        try {
          importAgentJSON(text);
          loadedSubs = true;
        } catch (err) {
          setError(`Bad JSON: ${(err as Error).message}`);
        }
      }
    }

    if (!loadedVideo && !loadedSubs) {
      setError('Drop a video file (.mp4) and/or a captions file (.srt or .json)');
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Don't render the full overlay once we have content — let the Dropzone hide
  // and let the user use the toolbar's import button to swap files instead.
  if (videoUrl && subtitleCount > 0) return null;

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={[
        'absolute inset-0 z-50 flex items-center justify-center bg-[var(--color-bg-base)]/95 backdrop-blur-sm',
        isDragging && 'border-4 border-dashed border-[var(--color-brand-accent)]',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="max-w-md p-8 text-center">
        <div className="mb-6 text-6xl">🎬</div>
        <h2 className="mb-3 font-cairo text-2xl font-bold text-[var(--color-text-primary)]">
          Subtitle Editor
        </h2>
        <p className="mb-6 font-cairo text-sm text-[var(--color-text-secondary)]">
          اسحب الفيديو + ملف الكابشنز (.srt أو .captions.json) لأي حتة في النافذة.
          <br />
          <span className="text-[var(--color-text-muted)]">
            الفيديو والكابشنز لازم يتحطّوا مع بعض عشان الـ waveform يظهر.
          </span>
        </p>

        <div className="rounded-lg border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-panel)] p-8 font-cairo text-sm text-[var(--color-text-muted)]">
          {videoUrl && !subtitleCount && (
            <div className="text-emerald-400">
              ✓ الفيديو محمّل ({useSubtitleStore.getState().videoFileName}).
              <br />
              دلوقتي اسحب ملف الكابشنز.
            </div>
          )}
          {!videoUrl && subtitleCount > 0 && (
            <div className="text-emerald-400">
              ✓ {subtitleCount} كابشن محمّلة.
              <br />
              دلوقتي اسحب الفيديو.
            </div>
          )}
          {!videoUrl && !subtitleCount && (
            <div>
              اسحب الملفات هنا
              <br />
              <span className="text-xs">.mp4 + .srt أو .json</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-900/60 bg-red-950/40 px-4 py-2 font-cairo text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
