import { useRef } from 'react';
import { useSubtitleStore } from '../store/useSubtitleStore';

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleCount = useSubtitleStore((s) => s.subtitles.length);
  const videoFileName = useSubtitleStore((s) => s.videoFileName);
  const historyIndex = useSubtitleStore((s) => s.historyIndex);
  const historyLength = useSubtitleStore((s) => s.history.length);
  const undo = useSubtitleStore((s) => s.undo);
  const redo = useSubtitleStore((s) => s.redo);
  const importSRT = useSubtitleStore((s) => s.importSRT);
  const importAgentJSON = useSubtitleStore((s) => s.importAgentJSON);
  const exportSRT = useSubtitleStore((s) => s.exportSRT);
  const exportAgentJSON = useSubtitleStore((s) => s.exportAgentJSON);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (file.name.endsWith('.srt')) {
      importSRT(text);
    } else if (file.name.endsWith('.json')) {
      try {
        importAgentJSON(text);
      } catch (err) {
        alert(`Failed to parse JSON: ${(err as Error).message}`);
      }
    } else {
      alert('Drop a .srt or .json file');
    }
    e.target.value = ''; // allow re-selecting the same file
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSRT = () => {
    const baseName = videoFileName?.replace(/\.[^.]+$/, '') ?? 'subtitles';
    downloadFile(exportSRT(), `${baseName}.srt`, 'text/plain;charset=utf-8');
  };

  const handleApprove = () => {
    const baseName = videoFileName?.replace(/\.[^.]+$/, '') ?? 'subtitles';
    downloadFile(
      exportAgentJSON(),
      `${baseName}.captions.json`,
      'application/json;charset=utf-8',
    );
  };

  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-4 py-2.5">
      <div className="flex items-center gap-2">
        <h1 className="font-cairo text-sm font-bold text-[var(--color-brand-accent)]">
          Subtitle Editor
        </h1>
        {videoFileName && (
          <span
            className="ml-3 max-w-xs truncate font-cairo text-xs text-[var(--color-text-secondary)]"
            title={videoFileName}
          >
            • {videoFileName}
          </span>
        )}
        <span className="ml-3 font-cairo text-xs text-[var(--color-text-muted)]">
          {subtitleCount} كابشن
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.json"
          className="hidden"
          onChange={handleFileSelected}
        />

        <ToolbarBtn onClick={handleImportClick} title="Import .srt or .json">
          📥 Import
        </ToolbarBtn>

        <ToolbarBtn onClick={handleExportSRT} title="Download as .srt">
          📤 SRT
        </ToolbarBtn>

        <div className="mx-1 h-6 w-px bg-[var(--color-border-subtle)]" />

        <ToolbarBtn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          ↶ Undo
        </ToolbarBtn>
        <ToolbarBtn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          ↷ Redo
        </ToolbarBtn>

        <div className="mx-1 h-6 w-px bg-[var(--color-border-subtle)]" />

        <button
          type="button"
          onClick={handleApprove}
          className="rounded-md bg-emerald-600 px-4 py-1.5 font-cairo text-sm font-bold text-white hover:bg-emerald-500"
          title="Save as captions.json (the agent's input format)"
        >
          ✅ Approve & Save JSON
        </button>
      </div>
    </div>
  );
}

interface ToolbarBtnProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

function ToolbarBtn({ onClick, disabled, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-1.5 font-cairo text-xs text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-brand-accent)] disabled:hover:border-[var(--color-border-subtle)]"
    >
      {children}
    </button>
  );
}
