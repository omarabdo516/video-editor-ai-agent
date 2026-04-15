#!/usr/bin/env python
"""
Phase 10 Round B — F20: Speech Rhythm analysis.

Reads a captions.json (with word-level timestamps from faster-whisper)
and produces a speech_rhythm.json with:
  - per-segment pace (fast / normal / slow_emphasis / very_slow)
  - words-per-second rate
  - pause locations (micro < 0.4s / breath 0.4-0.8s / dramatic > 0.8s)
  - summary stats (dramatic pause count, overall speaking style)

Used by Phase 6 animation planning to sync visual effects with the
lecturer's natural rhythm:
  - dramatic pause + revelation word → Smart Zoom crash curve
  - fast pace → accent flashes every beat
  - slow emphasis → glow variant on WordCaption

Usage:
  python speech_rhythm.py <captions.json> [<output.json>]

If the output path is omitted, writes next to the captions file with a
"speech_rhythm.json" suffix.
"""

import json
import sys
from pathlib import Path

# Windows cp1252 codec can't encode Arabic paths — reconfigure stdout
# to UTF-8 so print(output_path) on Arabic filenames doesn't crash.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def classify_pause(gap_sec: float) -> str:
    if gap_sec > 0.8:
        return "dramatic"
    if gap_sec > 0.4:
        return "breath"
    return "micro"


def classify_pace(words_per_sec: float) -> str:
    if words_per_sec > 4.0:
        return "fast"
    if words_per_sec > 2.5:
        return "normal"
    if words_per_sec > 1.5:
        return "slow_emphasis"
    return "very_slow"


def analyze(captions_path: Path) -> dict:
    data = json.loads(captions_path.read_text(encoding="utf-8"))
    segments = data.get("segments", [])

    rhythm_segments = []
    total_words = 0
    total_duration = 0.0
    dramatic_pauses = 0
    pace_counts = {
        "fast": 0,
        "normal": 0,
        "slow_emphasis": 0,
        "very_slow": 0,
    }

    for i, seg in enumerate(segments):
        words = seg.get("words", [])
        if not words:
            continue

        seg_start = seg["start"]
        seg_end = seg["end"]
        seg_duration = seg_end - seg_start
        wps = len(words) / seg_duration if seg_duration > 0 else 0.0

        # Walk the word list, recording each inter-word gap > 0.15s as a
        # pause. Dramatic pauses (>0.8s) are especially valuable for
        # Phase 6 — they often land right before a key word.
        pauses = []
        for j in range(1, len(words)):
            prev = words[j - 1]
            curr = words[j]
            gap = curr["start"] - prev["end"]
            if gap > 0.15:
                ptype = classify_pause(gap)
                pauses.append(
                    {
                        "start": round(prev["end"], 3),
                        "end": round(curr["start"], 3),
                        "duration": round(gap, 3),
                        "type": ptype,
                        "word_after": curr.get("word", "").strip(),
                    }
                )
                if ptype == "dramatic":
                    dramatic_pauses += 1

        pace = classify_pace(wps)
        pace_counts[pace] += 1

        rhythm_segments.append(
            {
                "segment_index": i,
                "start": round(seg_start, 3),
                "end": round(seg_end, 3),
                "pace": pace,
                "words_per_sec": round(wps, 2),
                "pauses": pauses,
                "has_dramatic_pause": any(p["type"] == "dramatic" for p in pauses),
            }
        )

        total_words += len(words)
        total_duration += seg_duration

    # Overall speaking style: dynamic = mixes fast + slow; steady = mostly
    # one pace. This guides whether Phase 6 should bias toward visual
    # variety (dynamic) or steady rhythm (steady).
    has_fast = pace_counts["fast"] > 0
    has_slow = pace_counts["slow_emphasis"] + pace_counts["very_slow"] > 0
    speaking_style = "dynamic" if (has_fast and has_slow) else "steady"

    avg_wps = (total_words / total_duration) if total_duration > 0 else 0.0

    return {
        "source": str(captions_path.name),
        "summary": {
            "total_segments": len(rhythm_segments),
            "total_words": total_words,
            "total_duration_sec": round(total_duration, 2),
            "avg_words_per_sec": round(avg_wps, 2),
            "dramatic_pauses": dramatic_pauses,
            "pace_distribution": pace_counts,
            "speaking_style": speaking_style,
        },
        "segments": rhythm_segments,
    }


def main() -> int:
    if len(sys.argv) < 2:
        print(
            "Usage: python speech_rhythm.py <captions.json> [<output.json>]",
            file=sys.stderr,
        )
        return 2

    captions_path = Path(sys.argv[1])
    if not captions_path.exists():
        print(f"Error: captions file not found: {captions_path}", file=sys.stderr)
        return 1

    if len(sys.argv) >= 3:
        output_path = Path(sys.argv[2])
    else:
        output_path = captions_path.with_name(
            captions_path.stem.replace(".captions", "") + ".speech_rhythm.json"
        )

    result = analyze(captions_path)
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    summary = result["summary"]
    print(
        f"OK speech rhythm: {summary['total_segments']} segments, "
        f"{summary['avg_words_per_sec']} w/s avg, "
        f"{summary['dramatic_pauses']} dramatic pauses, "
        f"style={summary['speaking_style']}"
    )
    print(f"   wrote {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
