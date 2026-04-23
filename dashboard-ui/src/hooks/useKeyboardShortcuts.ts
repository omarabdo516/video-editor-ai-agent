import { useEffect } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';

interface ShortcutActions {
  onToggleHelp: () => void;
  onPhase: (phase: 'phase1' | 'transcribe' | 'edit' | 'analyze' | 'microEvents' | 'render') => void;
  onAutoPrep: () => void;
  onAutoFinish: () => void;
}

/** Returns true if the event target is an input element. */
function isInputFocused(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((e.target as HTMLElement)?.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Never intercept when typing in inputs
      if (isInputFocused(e)) return;

      const store = useDashboardStore.getState();
      const { videos, activeVideoId, setActiveVideo, toggleSelect, selectAll, clearSelection } = store;

      // ─── ? — Toggle shortcuts help ───
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        actions.onToggleHelp();
        return;
      }

      // ─── ↑/↓ — Navigate videos ───
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (videos.length === 0) return;
        const currentIdx = videos.findIndex((v) => v.id === activeVideoId);
        let nextIdx: number;
        if (e.key === 'ArrowUp') {
          nextIdx = currentIdx <= 0 ? videos.length - 1 : currentIdx - 1;
        } else {
          nextIdx = currentIdx >= videos.length - 1 ? 0 : currentIdx + 1;
        }
        setActiveVideo(videos[nextIdx].id);
        return;
      }

      // ─── Space — Toggle select active video ───
      if (e.key === ' ' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (activeVideoId) toggleSelect(activeVideoId);
        return;
      }

      // ─── a — Select all ───
      if (e.key === 'a' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        selectAll();
        return;
      }

      // ─── d — Deselect all ───
      if (e.key === 'd' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        clearSelection();
        return;
      }

      // ─── 1-6 — Trigger phase on active video ───
      const phaseMap: Record<string, 'phase1' | 'transcribe' | 'edit' | 'analyze' | 'microEvents' | 'render'> = {
        '1': 'phase1',
        '2': 'transcribe',
        '3': 'edit',
        '4': 'analyze',
        '5': 'microEvents',
        '6': 'render',
      };
      if (phaseMap[e.key] && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (activeVideoId) actions.onPhase(phaseMap[e.key]);
        return;
      }

      // ─── p — Auto-Prep ───
      if (e.key === 'p' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        actions.onAutoPrep();
        return;
      }

      // ─── f — Auto-Finish ───
      if (e.key === 'f' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        actions.onAutoFinish();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);
}

/** Shortcut definitions for the help modal. */
export const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: '↑ / ↓', description: 'Navigate videos' },
      { keys: 'Space', description: 'Toggle select for batch' },
      { keys: 'A', description: 'Select all videos' },
      { keys: 'D', description: 'Deselect all' },
    ],
  },
  {
    title: 'Phases',
    shortcuts: [
      { keys: '1', description: 'Phase 1' },
      { keys: '2', description: 'Transcribe' },
      { keys: '3', description: 'Edit' },
      { keys: '4', description: 'Send to Claude' },
      { keys: '5', description: 'Micro Events' },
      { keys: '6', description: 'Render' },
    ],
  },
  {
    title: 'Quick Actions',
    shortcuts: [
      { keys: 'P', description: 'Auto-Prep (Phase1 → Transcribe)' },
      { keys: 'F', description: 'Auto-Finish (Micro → Render)' },
      { keys: '?', description: 'Show this help' },
    ],
  },
];
