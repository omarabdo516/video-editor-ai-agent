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

  // Push video time → store, but only if it actually changed materially.
  // Deps include `videoUrl` so the effect re-runs once the <video> element is
  // actually rendered (the component returns null before videoUrl is set).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    let raf = 0;
    const tick = () => {
      const t = v.currentTime;
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
  }, [videoUrl, setCurrentTime, setIsPlaying, setDuration]);

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

  if (!videoUrl) return null;

  // Audio-only mode: the <video> element is kept so HTMLMediaElement drives
  // playback (time + play/pause sync with the store), but it's rendered
  // off-screen. The editor uses the waveform for visual scrubbing instead.
  return (
    <video
      ref={videoRef}
      src={videoUrl}
      playsInline
      preload="auto"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
        left: -9999,
      }}
    />
  );
}
