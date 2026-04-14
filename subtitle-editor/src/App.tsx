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

  return (
    <div className="relative flex h-screen flex-col bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <KeyboardHandler />

      <Toolbar />

      {/* Main content grid:
          Row 1 (1fr): video preview + subtitle list (side by side)
          Row 2 (200px): waveform full width
          Row 3 (340px): edit panel — wide enough for timing inputs + text +
                        word-movement buttons + Split/Merge/Delete + Play */}
      <div className="grid flex-1 grid-rows-[minmax(0,1fr)_200px_340px] overflow-hidden">
        {/* Top row: video + list */}
        <div className="grid grid-cols-[1fr_360px] overflow-hidden border-b border-[var(--color-border-subtle)]">
          <div className="bg-black">
            <VideoPlayer />
          </div>
          <div className="border-l border-[var(--color-border-subtle)]">
            <SubtitleList />
          </div>
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
