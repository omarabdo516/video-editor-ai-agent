/** Maximum number of undo steps the store keeps */
export const MAX_HISTORY = 50;

/** Wavesurfer region colors */
export const REGION_COLOR_NORMAL = 'rgba(16, 71, 157, 0.18)';
export const REGION_COLOR_SELECTED = 'rgba(255, 181, 1, 0.35)';
export const REGION_COLOR_ACTIVE = 'rgba(16, 71, 157, 0.45)';

/** Caption length sweet spot (matches the agent's wordsPerChunk) */
export const WORDS_MIN = 5;
export const WORDS_MAX = 7;

/** Minimum allowed segment duration (seconds). Anything shorter the editor warns about. */
export const MIN_SEGMENT_SEC = 0.3;

/** Default zoom level for the waveform (px per second) */
export const DEFAULT_WAVEFORM_ZOOM = 50;
export const MIN_WAVEFORM_ZOOM = 10;
export const MAX_WAVEFORM_ZOOM = 500;
