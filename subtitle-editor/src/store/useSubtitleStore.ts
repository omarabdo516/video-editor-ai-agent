import { create } from 'zustand';
import type { Subtitle } from '../types/subtitle';
import { MAX_HISTORY } from '../utils/constants';
import { exportSRT, fromAgentJSON, parseSRT, toAgentJSON } from '../utils/srt-parser';

interface SubtitleState {
  /* ─── Data ─── */
  subtitles: Subtitle[];
  selectedId: string | null;
  videoUrl: string | null;
  videoFileName: string | null;

  /* ─── Playback ─── */
  currentTime: number;
  duration: number;
  isPlaying: boolean;

  /* ─── History ─── */
  history: Subtitle[][];
  historyIndex: number;

  /* ─── Setters ─── */
  setVideo: (url: string, name: string) => void;
  setSubtitles: (subs: Subtitle[]) => void;
  selectSubtitle: (id: string | null) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;

  /* ─── Edit actions (each pushes history) ─── */
  updateText: (id: string, text: string) => void;
  updateTiming: (id: string, start: number, end: number) => void;
  splitSubtitle: (id: string, splitAtTime: number) => void;
  mergeWithNext: (id: string) => void;
  deleteSubtitle: (id: string) => void;
  moveLastWordToNext: (id: string) => void;
  moveFirstWordToPrev: (id: string) => void;

  /* ─── History ─── */
  undo: () => void;
  redo: () => void;

  /* ─── Import/Export ─── */
  importSRT: (content: string) => void;
  importAgentJSON: (jsonText: string) => void;
  exportSRT: () => string;
  exportAgentJSON: () => string;

  /* ─── Helpers ─── */
  getSelected: () => Subtitle | null;
  getActive: () => Subtitle | null;
}

export const useSubtitleStore = create<SubtitleState>((set, get) => ({
  subtitles: [],
  selectedId: null,
  videoUrl: null,
  videoFileName: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  history: [],
  historyIndex: -1,

  setVideo: (url, name) => set({ videoUrl: url, videoFileName: name }),

  setSubtitles: (subs) => {
    const reindexed = reindex(subs);
    set({
      subtitles: reindexed,
      history: [reindexed],
      historyIndex: 0,
      selectedId: reindexed[0]?.id ?? null,
    });
  },

  selectSubtitle: (id) => set({ selectedId: id }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  updateText: (id, text) => {
    const next = get().subtitles.map((s) => (s.id === id ? { ...s, text } : s));
    pushAndCommit(set, get, next);
  },

  updateTiming: (id, start, end) => {
    if (end <= start) return; // invalid — silently ignore
    const next = get().subtitles.map((s) =>
      s.id === id ? { ...s, startTime: start, endTime: end } : s,
    );
    pushAndCommit(set, get, next);
  },

  splitSubtitle: (id, splitAtTime) => {
    const subs = get().subtitles;
    const idx = subs.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const sub = subs[idx];
    if (splitAtTime <= sub.startTime || splitAtTime >= sub.endTime) return;

    // Split text by word position proportional to time
    const words = sub.text.split(/\s+/).filter(Boolean);
    if (words.length < 2) return;

    const ratio = (splitAtTime - sub.startTime) / (sub.endTime - sub.startTime);
    const splitWordIdx = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)));

    const firstText = words.slice(0, splitWordIdx).join(' ');
    const secondText = words.slice(splitWordIdx).join(' ');

    let firstWords = sub.words?.slice(0, splitWordIdx);
    let secondWords = sub.words?.slice(splitWordIdx);

    // If we don't have word timings, leave them undefined for both halves.
    const first: Subtitle = {
      ...sub,
      text: firstText,
      endTime: splitAtTime,
      words: firstWords,
    };

    const second: Subtitle = {
      id: makeId(),
      index: sub.index + 1,
      startTime: splitAtTime,
      endTime: sub.endTime,
      text: secondText,
      words: secondWords,
    };

    const next = [...subs.slice(0, idx), first, second, ...subs.slice(idx + 1)];
    pushAndCommit(set, get, next, second.id);
  },

  mergeWithNext: (id) => {
    const subs = get().subtitles;
    const idx = subs.findIndex((s) => s.id === id);
    if (idx === -1 || idx >= subs.length - 1) return;
    const a = subs[idx];
    const b = subs[idx + 1];

    const merged: Subtitle = {
      ...a,
      text: `${a.text} ${b.text}`.trim(),
      endTime: b.endTime,
      words: a.words && b.words ? [...a.words, ...b.words] : undefined,
    };

    const next = [...subs.slice(0, idx), merged, ...subs.slice(idx + 2)];
    pushAndCommit(set, get, next, merged.id);
  },

  deleteSubtitle: (id) => {
    const subs = get().subtitles;
    const idx = subs.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const next = [...subs.slice(0, idx), ...subs.slice(idx + 1)];
    const newSelected = next[idx]?.id ?? next[idx - 1]?.id ?? null;
    pushAndCommit(set, get, next, newSelected);
  },

  moveLastWordToNext: (id) => {
    const subs = get().subtitles;
    const idx = subs.findIndex((s) => s.id === id);
    if (idx === -1 || idx >= subs.length - 1) return;
    const sub = subs[idx];
    const nextSub = subs[idx + 1];

    const words = sub.text.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return; // don't leave the source empty

    const movedWord = words[words.length - 1];
    const remainingText = words.slice(0, -1).join(' ');

    let updatedSub: Subtitle;
    let updatedNext: Subtitle;

    if (sub.words && sub.words.length > 1) {
      const movedWordData = sub.words[sub.words.length - 1];
      const remainingWords = sub.words.slice(0, -1);
      updatedSub = {
        ...sub,
        text: remainingText,
        words: remainingWords,
        endTime: remainingWords[remainingWords.length - 1].end,
      };
      updatedNext = {
        ...nextSub,
        text: `${movedWord} ${nextSub.text}`,
        words: nextSub.words ? [movedWordData, ...nextSub.words] : undefined,
        startTime: movedWordData.start,
      };
    } else {
      // No word timings — estimate proportionally
      const wordDuration = (sub.endTime - sub.startTime) / words.length;
      const newEnd = sub.endTime - wordDuration;
      updatedSub = { ...sub, text: remainingText, endTime: newEnd };
      updatedNext = {
        ...nextSub,
        text: `${movedWord} ${nextSub.text}`,
        startTime: newEnd,
      };
    }

    const next = [
      ...subs.slice(0, idx),
      updatedSub,
      updatedNext,
      ...subs.slice(idx + 2),
    ];
    pushAndCommit(set, get, next);
  },

  moveFirstWordToPrev: (id) => {
    const subs = get().subtitles;
    const idx = subs.findIndex((s) => s.id === id);
    if (idx <= 0) return;
    const sub = subs[idx];
    const prevSub = subs[idx - 1];

    const words = sub.text.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return;

    const movedWord = words[0];
    const remainingText = words.slice(1).join(' ');

    let updatedSub: Subtitle;
    let updatedPrev: Subtitle;

    if (sub.words && sub.words.length > 1) {
      const movedWordData = sub.words[0];
      const remainingWords = sub.words.slice(1);
      updatedSub = {
        ...sub,
        text: remainingText,
        words: remainingWords,
        startTime: remainingWords[0].start,
      };
      updatedPrev = {
        ...prevSub,
        text: `${prevSub.text} ${movedWord}`,
        words: prevSub.words ? [...prevSub.words, movedWordData] : undefined,
        endTime: movedWordData.end,
      };
    } else {
      const wordDuration = (sub.endTime - sub.startTime) / words.length;
      const newStart = sub.startTime + wordDuration;
      updatedSub = { ...sub, text: remainingText, startTime: newStart };
      updatedPrev = {
        ...prevSub,
        text: `${prevSub.text} ${movedWord}`,
        endTime: newStart,
      };
    }

    const next = [
      ...subs.slice(0, idx - 1),
      updatedPrev,
      updatedSub,
      ...subs.slice(idx + 1),
    ];
    pushAndCommit(set, get, next);
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    set({
      historyIndex: newIndex,
      subtitles: reindex(history[newIndex]),
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({
      historyIndex: newIndex,
      subtitles: reindex(history[newIndex]),
    });
  },

  importSRT: (content) => {
    const parsed = parseSRT(content);
    get().setSubtitles(parsed);
  },

  importAgentJSON: (jsonText) => {
    const data = JSON.parse(jsonText);
    const parsed = fromAgentJSON(data);
    get().setSubtitles(parsed);
  },

  exportSRT: () => exportSRT(get().subtitles),
  exportAgentJSON: () => JSON.stringify(toAgentJSON(get().subtitles), null, 2),

  getSelected: () => {
    const { selectedId, subtitles } = get();
    return subtitles.find((s) => s.id === selectedId) ?? null;
  },

  getActive: () => {
    const { currentTime, subtitles } = get();
    return subtitles.find((s) => currentTime >= s.startTime && currentTime <= s.endTime) ?? null;
  },
}));

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function makeId(): string {
  return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function reindex(subs: Subtitle[]): Subtitle[] {
  return subs.map((s, i) => ({ ...s, index: i + 1 }));
}

/**
 * Push the new state onto the history stack and commit it as the current
 * subtitles. Drops any "future" history if we're not at the tip (i.e. user
 * undoed then made a fresh edit).
 */
function pushAndCommit(
  set: (
    partial:
      | Partial<SubtitleState>
      | ((state: SubtitleState) => Partial<SubtitleState>),
  ) => void,
  get: () => SubtitleState,
  next: Subtitle[],
  newSelectedId?: string | null,
) {
  const reindexed = reindex(next);
  const { history, historyIndex } = get();

  // Drop any future entries (we're branching off from historyIndex)
  const trimmed = history.slice(0, historyIndex + 1);
  trimmed.push(reindexed);

  // Cap at MAX_HISTORY by dropping oldest entries
  const overflow = Math.max(0, trimmed.length - MAX_HISTORY);
  const newHistory = overflow > 0 ? trimmed.slice(overflow) : trimmed;

  set({
    subtitles: reindexed,
    history: newHistory,
    historyIndex: newHistory.length - 1,
    ...(newSelectedId !== undefined ? { selectedId: newSelectedId } : {}),
  });
}
