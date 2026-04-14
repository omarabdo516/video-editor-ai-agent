import { useEffect, useRef } from 'react';
import { useSubtitleStore } from '../store/useSubtitleStore';

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoUrl = useSubtitleStore((s) => s.videoUrl);
  const currentTime = useSubtitleStore((s) => s.currentTime);
  const isPlaying = useSubtitleStore((s) => s.isPlaying);
  const setCurrentTime = useSubtitleStore((s) => s.setCurrentTime);
  const setIsPlaying = useSubtitleStore((s) => s.setIsPlaying);
  const setDuration = useSubtitleStore((s) => s.setDuration);
  const subtitles = useSubtitleStore((s) => s.subtitles);

  // Push video time → store, but only if it actually changed materially.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    let raf = 0;
    const tick = () => {
      const t = v.currentTime;
      // Avoid feedback loops with the seek effect below
      if (Math.abs(t - useSubtitleStore.getState().currentTime) > 0.02) {
        setCurrentTime(t);
      }
      raf = requestAnimationFrame(tick);
    };

    const onPlay = () => {
      setIsPlaying(true);
      raf = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(raf);
    };
    const onLoadedMetadata = () => {
      setDuration(v.duration);
    };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      cancelAnimationFrame(raf);
    };
  }, [setCurrentTime, setIsPlaying, setDuration]);

  // Sync store time → video (when user clicks a region or subtitle, etc.)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (Math.abs(v.currentTime - currentTime) > 0.05) {
      v.currentTime = currentTime;
    }
  }, [currentTime]);

  // Sync store isPlaying → video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying && v.paused) {
      void v.play();
    } else if (!isPlaying && !v.paused) {
      v.pause();
    }
  }, [isPlaying]);

  // Find the currently displayed caption (matches the playhead)
  const currentSub = subtitles.find(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime,
  );

  if (!videoUrl) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
        <span className="font-cairo text-sm">لا يوجد فيديو محمّل</span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        src={videoUrl}
        className="h-full w-full object-contain"
        controls
        playsInline
      />
      {currentSub && (
        <div
          className="pointer-events-none absolute bottom-20 left-1/2 max-w-[80%] -translate-x-1/2 rounded-lg bg-black/75 px-6 py-3 text-center font-tajawal text-2xl font-extrabold text-white shadow-lg"
          dir="rtl"
          style={{
            textShadow:
              '0 0 12px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.7)',
          }}
        >
          {currentSub.text}
        </div>
      )}
    </div>
  );
}
