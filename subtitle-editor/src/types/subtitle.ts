// Reuse the agent's caption types via the path alias to avoid drift.
// @agent/types lives at ../../src/types.ts (resolved by tsconfig + vite alias).
import type {
  CaptionsData as AgentCaptionsData,
  CaptionSegment as AgentCaptionSegment,
  WordTiming as AgentWordTiming,
} from '@agent/types';

/**
 * The editor uses richer in-memory subtitle objects (id, index for stable keys,
 * dirty flag for the UI, etc.) than the wire format that the agent reads.
 * `toAgent()` / `fromAgent()` convert between them.
 */
export interface Subtitle {
  /** Stable React key — never re-derived from index */
  id: string;
  /** 1-based display index. Recomputed after add/remove/split/merge. */
  index: number;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Caption text (single line or wrapped — no embedded \n) */
  text: string;
  /** Word-level timestamps if available (Whisper output) */
  words?: WordTiming[];
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export type AgentExportShape = AgentCaptionsData;
export type AgentSegmentShape = AgentCaptionSegment;
export type AgentWordShape = AgentWordTiming;
