export type WordTiming = {
  word: string;
  start: number;
  end: number;
};

export type CaptionSegment = {
  id?: number;
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
};

export type CaptionsData = {
  language: string;
  totalDuration: number;
  segmentCount: number;
  segments: CaptionSegment[];
};

export type ZoomMoment = {
  /** Start time in seconds, relative to the lecture timeline */
  startSec: number;
  /** End time in seconds */
  endSec: number;
  /** Target zoom level (e.g. 1.4 for 1.4x) */
  zoomLevel: number;
  /** Face center X (0-1 normalized to comp width). Defaults to 0.5 if absent. */
  centerX?: number;
  /** Face center Y (0-1 normalized to comp height). Defaults to 0.4 if absent. */
  centerY?: number;
  /** Optional human-readable reason — appears in dev logs / Studio inspector */
  reason?: string;
};

export type ZoomPlan = {
  /** Source identifier (video filename or hash) — for sanity checks */
  source?: string;
  /** Spring config name from tokens.springs (default 'smooth') */
  spring?: 'enter' | 'exit' | 'bounce' | 'smooth';
  moments: ZoomMoment[];
};

export type ReelProps = {
  videoSrc: string;
  captions: CaptionsData;
  lecturer: string;
  workshop: string;
  /** Optional Smart Zoom plan — if absent, video plays at 1.0x with no transform */
  zoomPlan?: ZoomPlan | null;
  durationInFrames?: number;
};
