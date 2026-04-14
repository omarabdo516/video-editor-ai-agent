import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { VideoPlayer } from './components/VideoPlayer';
import { WaveformTimeline } from './components/WaveformTimeline';
import { SubtitleList } from './components/SubtitleList';
import { SubtitleEditPanel } from './components/SubtitleEditPanel';
import { KeyboardHandler } from './components/KeyboardHandler';
import { Dropzone } from './components/Dropzone';
import { useSubtitleStore } from './store/useSubtitleStore';

function App() {
  // ── Auto-load from URL params ────────────────────────────────────────
  // The agent's `rs-reels.mjs edit` command opens the editor with:
  //   ?video=http://127.0.0.1:7777/video.mp4&captions=http://127.0.0.1:7777/captions.json
  // So users don't have to drag-drop every time.
  const setVideo = useSubtitleStore((s) => s.setVideo);
  const importAgentJSON = useSubtitleStore((s) => s.importAgentJSON);
  const importSRT = useSubtitleStore((s) => s.importSRT);
  const followPlayback = useSubtitleStore((s) => s.followPlayback);
  const isPlaying = useSubtitleStore((s) => s.isPlaying);
  const currentTime = useSubtitleStore((s) => s.currentTime);
  const selectSubtitle = useSubtitleStore((s) => s.selectSubtitle);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const videoParam = params.get('video');
    const captionsParam = params.get('captions');
    const nameParam = params.get('name') ?? 'lecture';

    if (videoParam) {
      setVideo(videoParam, nameParam);
    }
    if (captionsParam) {
      fetch(captionsParam)
        .then((r) => r.text())
        .then((text) => {
          if (captionsParam.endsWith('.json')) {
            importAgentJSON(text);
          } else {
            importSRT(text);
          }
        })
        .catch((err) => console.warn('Failed to auto-load captions:', err));
    }
  }, [setVideo, importAgentJSON, importSRT]);

  // Follow-playback: when enabled + playing, the edit panel's selection tracks
  // the playhead. We read subtitles + selectedId from the store via getState()
  // to avoid re-subscribing (they change often and would cause loops).
  useEffect(() => {
    if (!followPlayback || !isPlaying) return;
    const state = useSubtitleStore.getState();
    const active = state.subtitles.find(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime,
    );
    if (active && active.id !== state.selectedId) {
      selectSubtitle(active.id);
    }
  }, [followPlayback, isPlaying, currentTime, selectSubtitle]);

  return (
    <div className="relative flex h-screen flex-col bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <KeyboardHandler />

      <Toolbar />

      {/* Audio-only mode: <video> is hidden off-screen but still drives playback.
          The editor uses the waveform (not a video preview) for visual scrubbing,
          which leaves more room for the subtitle list. */}
      <VideoPlayer />

      {/* Main content grid:
          Row 1 (1fr): subtitle list full-width
          Row 2 (200px): waveform full-width
          Row 3 (340px): edit panel */}
      <div className="grid flex-1 grid-rows-[minmax(0,1fr)_200px_340px] overflow-hidden">
        {/* Top: subtitle list */}
        <div className="overflow-hidden border-b border-[var(--color-border-subtle)]">
          <SubtitleList />
        </div>

        {/* Middle: waveform */}
        <div className="overflow-hidden border-b border-[var(--color-border-subtle)]">
          <WaveformTimeline />
        </div>

        {/* Bottom: edit panel */}
        <div className="overflow-hidden">
          <SubtitleEditPanel />
        </div>
      </div>

      <Dropzone />
    </div>
  );
}

export default App;
