import type { CaptionSegment, CaptionsData, WordTiming } from '../types';

/**
 * Re-chunk Whisper segments into smaller caption phrases of `wordsPerChunk`
 * words each. Preserves word-level timings so we can highlight the active
 * word in sync with the speaker.
 */
export function rechunkCaptions(
  raw: CaptionsData,
  wordsPerChunk = 6,
  minWordsPerChunk = 3,
): CaptionsData {
  const out: CaptionSegment[] = [];

  for (const seg of raw.segments) {
    const words = seg.words || [];
    if (words.length === 0) {
      out.push(seg);
      continue;
    }

    if (words.length <= wordsPerChunk) {
      out.push({ ...seg, text: words.map((w) => w.word).join(' '), words });
      continue;
    }

    let i = 0;
    while (i < words.length) {
      let chunkSize = wordsPerChunk;
      const remaining = words.length - i;
      if (remaining - chunkSize > 0 && remaining - chunkSize < minWordsPerChunk) {
        chunkSize = Math.ceil(remaining / 2);
      }
      const chunk = words.slice(i, i + chunkSize);
      if (chunk.length === 0) break;
      out.push({
        start: chunk[0].start,
        end: chunk[chunk.length - 1].end,
        text: chunk.map((w: WordTiming) => w.word).join(' '),
        words: chunk,
      });
      i += chunkSize;
    }
  }

  return {
    ...raw,
    segments: out,
    segmentCount: out.length,
    totalDuration: out.length > 0 ? out[out.length - 1].end : raw.totalDuration,
  };
}
