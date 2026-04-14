"""
video_metadata.py — Extract video metadata using ffprobe.

Outputs a compact JSON with the fields Claude Code needs for animation planning:
duration, width, height, fps, frame_count. The raw ffprobe output is also
preserved under "raw" for completeness.

Usage:
    python video_metadata.py <video_path> [--output <out.json>]
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")


FFPROBE = "C:/ffmpeg/bin/ffprobe.exe"


def run_ffprobe(video_path: Path) -> dict:
    result = subprocess.run(
        [
            FFPROBE,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")
    return json.loads(result.stdout)


def extract_video_stream(raw: dict) -> dict:
    streams = raw.get("streams", [])
    for s in streams:
        if s.get("codec_type") == "video":
            return s
    raise RuntimeError("No video stream found")


def parse_fps(fps_str: str) -> float:
    if not fps_str or fps_str == "0/0":
        return 0.0
    return float(Fraction(fps_str))


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract video metadata via ffprobe")
    parser.add_argument("input", help="Path to video file")
    parser.add_argument("--output", help="Output JSON path (default: <input>.metadata.json)")
    args = parser.parse_args()

    video_path = Path(args.input).resolve()
    if not video_path.exists():
        print(f"Error: video not found: {video_path}", file=sys.stderr)
        return 1

    out_path = Path(args.output).resolve() if args.output else Path(str(video_path) + ".metadata.json")

    print(f"Running ffprobe on {video_path.name}")
    raw = run_ffprobe(video_path)
    vstream = extract_video_stream(raw)

    duration = float(raw["format"].get("duration", 0))
    width = int(vstream.get("width", 0))
    height = int(vstream.get("height", 0))
    fps = parse_fps(vstream.get("r_frame_rate", "0/0"))
    frame_count = int(vstream.get("nb_frames") or round(duration * fps))

    metadata = {
        "path": str(video_path),
        "duration": round(duration, 3),
        "width": width,
        "height": height,
        "fps": round(fps, 4),
        "frame_count": frame_count,
        "aspect_ratio": f"{width}:{height}" if width and height else None,
        "video_codec": vstream.get("codec_name"),
        "audio_codec": next(
            (s.get("codec_name") for s in raw.get("streams", []) if s.get("codec_type") == "audio"),
            None,
        ),
        "raw": raw,
    }

    out_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  Duration:  {duration:.2f}s ({frame_count} frames @ {fps:.2f}fps)")
    print(f"  Size:      {width}x{height}")
    print(f"  Wrote:     {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
