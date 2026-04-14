import { useEffect } from 'react';
import { useSubtitleStore } from '../store/useSubtitleStore';

/**
 * Mounts global keyboard shortcuts. Renders nothing.
 *
 * Shortcuts:
 *   Space            → toggle play/pause
 *   ←  / →           → seek -1s / +1s
 *   Shift+← / Shift+→ → seek -0.1s / +0.1s
 *   Ctrl+← / Ctrl+→  → previous / next subtitle
 *   Enter            → next subtitle
 *   Ctrl+Z           → undo
 *   Ctrl+Shift+Z     → redo
 *   Delete           → delete selected
 *   S                → split at playhead
 *   M                → merge with next
 *   Ctrl+Shift+→     → move last word to next caption
 *   Ctrl+Shift+←     → move first word to previous caption
 *
 * Disabled while typing in <input> or <textarea>.
 */
export function KeyboardHandler() {
  const undo = useSubtitleStore((s) => s.undo);
  const redo = useSubtitleStore((s) => s.redo);
  const splitSubtitle = useSubtitleStore((s) => s.splitSubtitle);
  const mergeWithNext = useSubtitleStore((s) => s.mergeWithNext);
  const deleteSubtitle = useSubtitleStore((s) => s.deleteSubtitle);
  const moveLastWordToNext = useSubtitleStore((s) => s.moveLastWordToNext);
  const moveFirstWordToPrev = useSubtitleStore((s) => s.moveFirstWordToPrev);
  const selectSubtitle = useSubtitleStore((s) => s.selectSubtitle);
  const setCurrentTime = useSubtitleStore((s) => s.setCurrentTime);
  const setIsPlaying = useSubtitleStore((s) => s.setIsPlaying);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const state = useSubtitleStore.getState();
      const subs = state.subtitles;
      const selectedIdx = subs.findIndex((s) => s.id === state.selectedId);

      // ─── Playback ───────────────────────────────────────────────────
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!state.isPlaying);
        return;
      }

      // ─── Navigation ────────────────────────────────────────────────
      if (e.code === 'ArrowLeft' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        if (state.selectedId) moveFirstWordToPrev(state.selectedId);
        return;
      }
      if (e.code === 'ArrowRight' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        if (state.selectedId) moveLastWordToNext(state.selectedId);
        return;
      }
      if (e.code === 'ArrowLeft' && e.ctrlKey) {
        e.preventDefault();
        const target = subs[Math.max(0, selectedIdx - 1)];
        if (target) {
          selectSubtitle(target.id);
          setCurrentTime(target.startTime);
        }
        return;
      }
      if (e.code === 'ArrowRight' && e.ctrlKey) {
        e.preventDefault();
        const target = subs[Math.min(subs.length - 1, selectedIdx + 1)];
        if (target) {
          selectSubtitle(target.id);
          setCurrentTime(target.startTime);
        }
        return;
      }
      if (e.code === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        setCurrentTime(Math.max(0, state.currentTime - 0.1));
        return;
      }
      if (e.code === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        setCurrentTime(Math.min(state.duration, state.currentTime + 0.1));
        return;
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime(Math.max(0, state.currentTime - 1));
        return;
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime(Math.min(state.duration, state.currentTime + 1));
        return;
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        const target = subs[Math.min(subs.length - 1, selectedIdx + 1)];
        if (target) {
          selectSubtitle(target.id);
          setCurrentTime(target.startTime);
        }
        return;
      }

      // ─── Edit actions ──────────────────────────────────────────────
      if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.key === 'Backspace' && !e.ctrlKey) return; // don't trigger on stray Backspace
        e.preventDefault();
        if (state.selectedId) deleteSubtitle(state.selectedId);
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        if (e.ctrlKey) return; // don't intercept Ctrl+S
        e.preventDefault();
        if (state.selectedId) splitSubtitle(state.selectedId, state.currentTime);
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (state.selectedId) mergeWithNext(state.selectedId);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    undo,
    redo,
    splitSubtitle,
    mergeWithNext,
    deleteSubtitle,
    moveLastWordToNext,
    moveFirstWordToPrev,
    selectSubtitle,
    setCurrentTime,
    setIsPlaying,
  ]);

  return null;
}
