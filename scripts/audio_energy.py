"""
audio_energy.py — Analyze audio for emphasis moments using librosa.

Computes RMS energy over the audio and flags two types of emphasis:
  1. high_energy     — local RMS exceeds mean + 1.5σ
  2. dramatic_pause  — a sudden silence (RMS < 30% of mean) followed within ~0.3s
                      by a sharp return to high energy

Then de-duplicates: moments within 2s of each other are collapsed to the first.

Output JSON shape:
{
  "source": "path/to/audio.wav",
  "duration": 209.2,
  "mean_energy": 0.052,
  "std_energy": 0.031,
  "high_threshold": 0.099,
  "low_threshold": 0.0156,
  "total_emphasis_points": 18,
  "emphasis_moments": [
    {"time": 4.12, "energy": 0.12, "type": "high_energy"},
    {"time": 17.5, "energy": 0.14, "type": "dramatic_pause"},
    ...
  ]
}

Usage:
    python audio_energy.py <audio_path> [--output out.json]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def main() -> int:
    parser = argparse.ArgumentParser(description="librosa audio energy → emphasis moments")
    parser.add_argument("input", help="Path to audio file (WAV or any ffmpeg-readable)")
    parser.add_argument("--output", help="Output JSON path (default: <input>.energy.json)")
    parser.add_argument(
        "--high-sigma",
        type=float,
        default=1.5,
        help="High-energy threshold = mean + N*std (default 1.5)",
    )
    parser.add_argument(
        "--low-ratio",
        type=float,
        default=0.3,
        help="Dramatic-pause low threshold = mean * ratio (default 0.3)",
    )
    parser.add_argument(
        "--min-gap-sec",
        type=float,
        default=2.0,
        help="Minimum gap between emphasis points (default 2.0)",
    )
    args = parser.parse_args()

    audio_path = Path(args.input).resolve()
    if not audio_path.exists():
        print(f"Error: audio not found: {audio_path}", file=sys.stderr)
        return 1

    out_path = Path(args.output).resolve() if args.output else Path(str(audio_path) + ".energy.json")

    try:
        import librosa
        import numpy as np
    except ImportError as e:
        print(f"Error: missing dependency: {e.name}. Install with: uv pip install librosa numpy", file=sys.stderr)
        return 2

    print(f"Loading: {audio_path.name}")
    y, sr = librosa.load(str(audio_path), sr=16000, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    print(f"  Duration: {duration:.1f}s  (sr={sr})")

    hop_length = 512
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)

    mean_energy = float(np.mean(rms))
    std_energy = float(np.std(rms))
    high_threshold = mean_energy + (args.high_sigma * std_energy)
    low_threshold = mean_energy * args.low_ratio

    print(f"  RMS:      mean={mean_energy:.4f}  std={std_energy:.4f}")
    print(f"  Thresh:   high={high_threshold:.4f}  low={low_threshold:.4f}")

    moments: list[dict] = []

    # Pass 1: high-energy moments (local maxima above threshold)
    for i in range(1, len(rms) - 1):
        if rms[i] > high_threshold and rms[i] > rms[i - 1] and rms[i] > rms[i + 1]:
            moments.append(
                {
                    "time": round(float(times[i]), 3),
                    "energy": round(float(rms[i]), 4),
                    "type": "high_energy",
                }
            )

    # Pass 2: dramatic pauses (silence followed by sharp return)
    lookahead = 10
    for i in range(1, len(rms) - lookahead):
        if rms[i] < low_threshold:
            window = rms[i + 3 : i + lookahead]
            if len(window) and window.max() > high_threshold:
                moments.append(
                    {
                        "time": round(float(times[i]), 3),
                        "energy": round(float(window.max()), 4),
                        "type": "dramatic_pause",
                    }
                )

    # Sort by time, then de-duplicate: merge moments within min_gap_sec
    moments.sort(key=lambda m: m["time"])
    cleaned: list[dict] = []
    for m in moments:
        if not cleaned or m["time"] - cleaned[-1]["time"] > args.min_gap_sec:
            cleaned.append(m)

    output = {
        "source": str(audio_path),
        "duration": round(duration, 3),
        "mean_energy": round(mean_energy, 6),
        "std_energy": round(std_energy, 6),
        "high_threshold": round(high_threshold, 6),
        "low_threshold": round(low_threshold, 6),
        "total_emphasis_points": len(cleaned),
        "emphasis_moments": cleaned,
    }

    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    by_type: dict[str, int] = {}
    for m in cleaned:
        by_type[m["type"]] = by_type.get(m["type"], 0) + 1

    print()
    print(f"Emphasis moments: {len(cleaned)}")
    for t, n in sorted(by_type.items()):
        print(f"  {t}: {n}")
    print(f"Wrote: {out_path}")

    if not cleaned:
        print()
        print("⚠️  No emphasis moments detected. The lecturer may be unusually monotone.")
        print("   Smart Zoom will rely on the caption text only, not audio energy.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
