/** Seconds → "MM:SS.mmm" for compact display in lists */
export function formatTimeShort(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) return '00:00.000';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad2(m)}:${pad2(s)}.${pad3(ms)}`;
}

/** Seconds → "HH:MM:SS.mmm" for the edit panel */
export function formatTimeFull(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) return '00:00:00.000';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${pad3(ms)}`;
}

/** Parse "HH:MM:SS.mmm" or "MM:SS.mmm" or "SS.mmm" → seconds */
export function parseTimeInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':').map((p) => p.trim());
  if (parts.length === 0 || parts.length > 3) return null;

  let h = 0;
  let m = 0;
  let s = 0;

  if (parts.length === 3) {
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    s = parseFloat(parts[2]);
  } else if (parts.length === 2) {
    m = parseInt(parts[0], 10);
    s = parseFloat(parts[1]);
  } else {
    s = parseFloat(parts[0]);
  }

  if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
  if (h < 0 || m < 0 || s < 0) return null;

  return h * 3600 + m * 60 + s;
}

/** Word count of a caption — splits on whitespace, ignores empty tokens */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Color hint for a word count badge — green if 5-7, yellow otherwise */
export function wordCountColor(count: number): 'good' | 'warn' {
  return count >= 5 && count <= 7 ? 'good' : 'warn';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}
