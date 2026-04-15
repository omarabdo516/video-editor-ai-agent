// Parses a video filename into { name, lecturer, workshop }.
//
// Omar's convention: "<lecturer> - <workshop>" (lecturer first, workshop
// second, separated by a dash). Examples from the existing library:
//   "محمد ريان - ورشة الشامل"            → lecturer="محمد ريان",  workshop="ورشة الشامل"
//   "محمد علاء - ورشة المحاسب المالي"    → lecturer="محمد علاء",   workshop="ورشة المحاسب المالي"
//
// The parser tolerates a few separators (` - `, `_`, `—`) and tries to
// identify the workshop side by the presence of keywords like ورشة/دورة/
// محاضرة. If neither side has a keyword we fall back to the convention
// (first part = lecturer, rest = workshop).

const WORKSHOP_KEYWORDS = /ورشة|دورة|محاضرة|كورس|جلسة/;
const SEPARATORS = /\s*[-_—–]\s*/;

/**
 * @param {string} basename - filename with or without extension
 * @returns {{ name: string, lecturer: string|null, workshop: string|null }}
 */
export function parseVideoName(basename) {
  if (!basename || typeof basename !== 'string') {
    return { name: basename || '', lecturer: null, workshop: null };
  }

  // Strip extension
  const name = basename.replace(/\.[^.]+$/, '').trim();
  if (!name) return { name: '', lecturer: null, workshop: null };

  const parts = name.split(SEPARATORS).map((p) => p.trim()).filter(Boolean);

  if (parts.length < 2) {
    // Single-part name — can't split. Treat the whole thing as the name
    // and leave lecturer/workshop blank for the user to fill in.
    return { name, lecturer: null, workshop: null };
  }

  // Find which part looks like the workshop (contains a known keyword).
  const workshopIdx = parts.findIndex((p) => WORKSHOP_KEYWORDS.test(p));

  if (workshopIdx !== -1) {
    const workshop = parts[workshopIdx];
    const lecturerParts = parts.filter((_, i) => i !== workshopIdx);
    const lecturer = lecturerParts.join(' - ').trim();
    return {
      name,
      lecturer: lecturer || null,
      workshop: workshop || null,
    };
  }

  // Fallback: no workshop keyword detected. Assume the first token is the
  // lecturer and everything after is the workshop — matches the naming
  // convention Omar mentioned.
  return {
    name,
    lecturer: parts[0] || null,
    workshop: parts.slice(1).join(' - ').trim() || null,
  };
}
