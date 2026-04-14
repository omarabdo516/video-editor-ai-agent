import type { Subtitle, AgentExportShape, AgentSegmentShape } from '../types/subtitle';

/* ─── SRT format ──────────────────────────────────────────────────────── */

/** Parse a full SRT string → Subtitle[] (without word-level data) */
export function parseSRT(content: string): Subtitle[] {
  const blocks = content.replace(/\r\n/g, '\n').trim().split(/\n\n+/);
  const out: Subtitle[] = [];

  blocks.forEach((block, i) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return;

    // Optional numeric index on first line — skip it
    let timingLine = lines[0];
    let textStart = 1;
    if (/^\d+$/.test(lines[0])) {
      timingLine = lines[1];
      textStart = 2;
    }

    const timingMatch = timingLine.match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/);
    if (!timingMatch) return;

    const start = srtToSeconds(timingMatch[1]);
    const end = srtToSeconds(timingMatch[2]);
    if (isNaN(start) || isNaN(end)) return;

    const text = lines.slice(textStart).join(' ').trim();
    if (!text) return;

    out.push({
      id: `sub-${Date.now()}-${i}`,
      index: out.length + 1,
      startTime: start,
      endTime: end,
      text,
    });
  });

  return out;
}

/** Subtitle[] → SRT string (always uses comma decimal separator per spec) */
export function exportSRT(subtitles: Subtitle[]): string {
  return subtitles
    .map((sub, i) => {
      return `${i + 1}\n${secondsToSRT(sub.startTime)} --> ${secondsToSRT(sub.endTime)}\n${sub.text}`;
    })
    .join('\n\n')
    .concat('\n');
}

/** "HH:MM:SS,mmm" or "HH:MM:SS.mmm" → seconds */
export function srtToSeconds(time: string): number {
  const [h, m, rest] = time.split(':');
  if (!rest) return NaN;
  const [s, ms] = rest.split(/[,.]/);
  return (
    parseInt(h, 10) * 3600 +
    parseInt(m, 10) * 60 +
    parseInt(s, 10) +
    (ms ? parseInt(ms.padEnd(3, '0').slice(0, 3), 10) / 1000 : 0)
  );
}

/** seconds → "HH:MM:SS,mmm" (SRT spec — comma) */
export function secondsToSRT(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe % 1) * 1000);
  // Handle the rare case where rounding pushes ms to 1000
  const adjMs = ms === 1000 ? 999 : ms;
  return (
    String(h).padStart(2, '0') +
    ':' +
    String(m).padStart(2, '0') +
    ':' +
    String(s).padStart(2, '0') +
    ',' +
    String(adjMs).padStart(3, '0')
  );
}

/* ─── Agent JSON format (CaptionsData) ────────────────────────────────── */

/**
 * Convert agent-shape CaptionsData → editor Subtitle[]
 * Preserves word-level timings if present.
 */
export function fromAgentJSON(data: AgentExportShape): Subtitle[] {
  return data.segments.map((seg, i) => ({
    id: `sub-${Date.now()}-${i}`,
    index: i + 1,
    startTime: seg.start,
    endTime: seg.end,
    text: seg.text.trim(),
    words: seg.words?.map((w) => ({ word: w.word, start: w.start, end: w.end })),
  }));
}

/**
 * Convert editor Subtitle[] → agent-shape CaptionsData ready to write to disk.
 * If a subtitle's text was edited but the word-level timings still match the
 * old word count, we keep them; otherwise we redistribute proportionally by
 * character length so the agent still gets per-word timings for SmartZoom etc.
 */
export function toAgentJSON(subtitles: Subtitle[], language = 'ar'): AgentExportShape {
  const segments: AgentSegmentShape[] = subtitles.map((sub) => {
    const newWords = sub.text.split(/\s+/).filter(Boolean);
    let words: AgentSegmentShape['words'];

    if (sub.words && sub.words.length === newWords.length) {
      // Edited the spelling but not the word count — keep timings
      words = sub.words.map((w, i) => ({ word: newWords[i], start: w.start, end: w.end }));
    } else {
      // Redistribute proportionally by char length
      const totalChars = newWords.reduce((acc, w) => acc + w.length, 0) || 1;
      const totalDur = sub.endTime - sub.startTime;
      const perChar = totalDur / totalChars;
      let cursor = sub.startTime;
      words = newWords.map((w) => {
        const dur = w.length * perChar;
        const entry = {
          word: w,
          start: round3(cursor),
          end: round3(cursor + dur),
        };
        cursor += dur;
        return entry;
      });
    }

    return {
      start: round3(sub.startTime),
      end: round3(sub.endTime),
      text: sub.text,
      words,
    };
  });

  return {
    language,
    totalDuration: segments.length ? segments[segments.length - 1].end : 0,
    segmentCount: segments.length,
    segments,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
