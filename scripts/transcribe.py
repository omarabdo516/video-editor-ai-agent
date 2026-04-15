"""
transcribe.py — RS Hero lecturer video → captions.json with word-level timings.

Uses faster-whisper (CTranslate2 backend) for fast GPU inference on RTX 5060 Ti.
Outputs the same JSON shape as srt-parser.js so build-reels.jsx can consume it
without changes.

Usage:
    python transcribe.py <video_or_audio_path> [--output captions.json] [--model large-v3] [--language ar]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

# Windows cp1252 codec can't encode Arabic characters — reconfigure stdout
# to UTF-8 so `print(file.name)` on Arabic filenames doesn't crash.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def format_timestamp(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(segments, path: Path) -> None:
    lines = []
    for i, seg in enumerate(segments, start=1):
        lines.append(str(i))
        lines.append(f"{format_timestamp(seg['start'])} --> {format_timestamp(seg['end'])}")
        lines.append(seg["text"])
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


DEFAULT_ARABIC_PROMPT = (
    "المتكلم محاضر مصري محترف يشرح في مجال المحاسبة المالية والضرائب والتدقيق. "
    "يتحدث بلهجة عامية مصرية ولكن يستخدم مصطلحات محاسبية عربية فصحى. "
    "استخدم الكتابة الفصحى مع علامات التنقيط الصحيحة مثل: مثلاً، شركة، محاسبة، "
    "ضرائب، ورشة، شهادة، معايير، دولية، شامل، مالي، تحليل، ثم، ثلاثة، كذلك، "
    "المحاسب، المتدرب، المحاضر، التشغيل، الدراسة، التطبيق، العملي، المعايير، "
    "الشركة، المالية، الضريبية، الدولية، المهنية، الإدارة، التقارير."
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe video/audio → captions.json")
    parser.add_argument("input", help="Path to video or audio file")
    parser.add_argument("--output", help="Output captions JSON path (default: <input>.captions.json)")
    parser.add_argument("--srt", help="Also write an .srt file at this path")
    parser.add_argument("--model", default="large-v3", help="Whisper model size")
    parser.add_argument("--language", default="ar", help="Source language code (default: ar)")
    parser.add_argument("--device", default="cuda", choices=["cuda", "cpu", "auto"])
    parser.add_argument("--compute-type", default="float16", help="float16 / int8_float16 / int8")
    parser.add_argument("--beam-size", type=int, default=10)
    parser.add_argument("--patience", type=float, default=2.0)
    parser.add_argument("--initial-prompt", default=DEFAULT_ARABIC_PROMPT)
    parser.add_argument("--no-prompt", action="store_true", help="Disable the initial prompt")
    parser.add_argument("--no-speech-threshold", type=float, default=0.55)
    parser.add_argument("--compression-ratio-threshold", type=float, default=2.4)
    parser.add_argument("--vad-filter", action="store_true", default=True)
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.exists():
        print(f"Error: input file not found: {input_path}", file=sys.stderr)
        return 1

    output_path = Path(args.output).resolve() if args.output else input_path.with_suffix(input_path.suffix + ".captions.json")

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("Error: faster-whisper is not installed. Run: pip install faster-whisper", file=sys.stderr)
        return 2

    print(f"Loading Whisper model: {args.model} ({args.device}, {args.compute_type})")
    t0 = time.time()
    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    print(f"Model loaded in {time.time() - t0:.1f}s")

    initial_prompt = None if args.no_prompt else args.initial_prompt

    print(f"Transcribing: {input_path.name}")
    if initial_prompt:
        print(f"  Initial prompt: {initial_prompt[:80]}...")
    print(f"  Beam size: {args.beam_size}  patience: {args.patience}")

    t0 = time.time()
    segments_iter, info = model.transcribe(
        str(input_path),
        language=args.language,
        beam_size=args.beam_size,
        patience=args.patience,
        temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
        word_timestamps=True,
        vad_filter=args.vad_filter,
        vad_parameters=dict(min_silence_duration_ms=500),
        condition_on_previous_text=True,
        initial_prompt=initial_prompt,
        no_speech_threshold=args.no_speech_threshold,
        compression_ratio_threshold=args.compression_ratio_threshold,
    )

    segments = []
    for seg in segments_iter:
        words = []
        if seg.words:
            for w in seg.words:
                words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                })

        segments.append({
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": seg.text.strip(),
            "words": words,
        })
        # Live progress
        print(f"  [{seg.start:6.2f} → {seg.end:6.2f}]  {seg.text.strip()[:60]}")

    elapsed = time.time() - t0
    audio_dur = info.duration
    rtf = elapsed / audio_dur if audio_dur > 0 else 0
    print(f"\nTranscribed {audio_dur:.1f}s of audio in {elapsed:.1f}s  (RTF: {rtf:.2f}, {1/rtf:.1f}x real-time)")
    print(f"Detected language: {info.language} (prob: {info.language_probability:.2f})")

    output = {
        "source": str(input_path),
        "model": args.model,
        "language": info.language,
        "segmentCount": len(segments),
        "totalDuration": segments[-1]["end"] if segments else 0,
        "segments": segments,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(segments)} segments → {output_path}")

    if args.srt:
        srt_path = Path(args.srt).resolve()
        write_srt(segments, srt_path)
        print(f"Wrote SRT → {srt_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
