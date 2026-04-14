"""
face_detect.py — Run MediaPipe face detection on a video and output a face map.

Uses the MediaPipe Tasks API (mediapipe >= 0.10.x) with the BlazeFace short-range
model. Samples every N frames (default 5) — at 30fps that's 6 samples/sec —
enough for Smart Zoom without processing every frame.

For each sample: records the bounding box center (normalized 0-1) + size +
confidence. When no face is detected, falls back to a neutral center position so
Smart Zoom can detect "no face" gaps and skip them.

Output JSON shape:
{
  "source": "path/to/video.mp4",
  "video_fps": 30.0,
  "video_width": 1080,
  "video_height": 1920,
  "total_frames": 6275,
  "sample_interval": 5,
  "total_samples": 1255,
  "no_face_samples": 42,
  "no_face_percentage": 3.3,
  "faces": [
    {
      "frame": 0,
      "time": 0.0,
      "face_center_x": 0.48,  // normalized 0-1 (0 = left edge)
      "face_center_y": 0.35,
      "face_width": 0.12,     // bbox width as fraction of frame
      "face_height": 0.18,
      "confidence": 0.92
    },
    ...
  ]
}

Usage:
    python face_detect.py <video_path> [--output out.json] [--interval 5]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_MODEL = Path(__file__).parent / "models" / "blaze_face_short_range.tflite"


def main() -> int:
    parser = argparse.ArgumentParser(description="MediaPipe face detection → face_map.json")
    parser.add_argument("input", help="Path to video file")
    parser.add_argument("--output", help="Output JSON path (default: <input>.face_map.json)")
    parser.add_argument("--interval", type=int, default=5, help="Sample every N frames (default 5)")
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.5,
        help="Min detection confidence (default 0.5)",
    )
    parser.add_argument(
        "--model",
        default=str(DEFAULT_MODEL),
        help="Path to BlazeFace .tflite model",
    )
    args = parser.parse_args()

    video_path = Path(args.input).resolve()
    if not video_path.exists():
        print(f"Error: video not found: {video_path}", file=sys.stderr)
        return 1

    model_path = Path(args.model).resolve()
    if not model_path.exists():
        print(f"Error: model file not found: {model_path}", file=sys.stderr)
        print("Download with:", file=sys.stderr)
        print(
            "  curl -o scripts/models/blaze_face_short_range.tflite "
            "https://storage.googleapis.com/mediapipe-models/face_detector/"
            "blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
            file=sys.stderr,
        )
        return 2

    out_path = Path(args.output).resolve() if args.output else Path(str(video_path) + ".face_map.json")

    try:
        import cv2
        import mediapipe as mp
        from mediapipe.tasks import python as mptasks
        from mediapipe.tasks.python import vision
    except ImportError as e:
        print(
            f"Error: missing dependency: {e.name}. Install with: uv pip install mediapipe opencv-python",
            file=sys.stderr,
        )
        return 3

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"Error: cv2 could not open video: {video_path}", file=sys.stderr)
        return 4

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Video:      {video_path.name}")
    print(f"  Frames:   {total_frames} @ {fps:.2f}fps  ({total_frames / fps:.1f}s)")
    print(f"  Size:     {width}x{height}")
    print(f"  Sample:   every {args.interval} frames → ~{total_frames // args.interval} samples")
    print(f"  Model:    {model_path.name}")
    print()

    options = vision.FaceDetectorOptions(
        base_options=mptasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=vision.RunningMode.VIDEO,
        min_detection_confidence=args.min_confidence,
    )

    face_data: list[dict] = []
    no_face_count = 0
    t0 = time.time()

    with vision.FaceDetector.create_from_options(options) as detector:
        frame_num = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_num % args.interval == 0:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                timestamp_ms = int(round(frame_num / fps * 1000))
                result = detector.detect_for_video(mp_image, timestamp_ms)

                if result.detections:
                    # Pick the largest face (closest to camera)
                    det = max(
                        result.detections,
                        key=lambda d: d.bounding_box.width * d.bounding_box.height,
                    )
                    bbox = det.bounding_box  # pixel coords
                    cx_px = bbox.origin_x + bbox.width / 2
                    cy_px = bbox.origin_y + bbox.height / 2
                    score = det.categories[0].score if det.categories else 0.0

                    face_data.append(
                        {
                            "frame": frame_num,
                            "time": round(frame_num / fps, 3),
                            "face_center_x": round(cx_px / width, 4),
                            "face_center_y": round(cy_px / height, 4),
                            "face_width": round(bbox.width / width, 4),
                            "face_height": round(bbox.height / height, 4),
                            "confidence": round(float(score), 3),
                        }
                    )
                else:
                    no_face_count += 1
                    face_data.append(
                        {
                            "frame": frame_num,
                            "time": round(frame_num / fps, 3),
                            "face_center_x": 0.5,
                            "face_center_y": 0.4,
                            "face_width": 0.0,
                            "face_height": 0.0,
                            "confidence": 0.0,
                        }
                    )

                # Progress every ~5%
                step = max(1, total_frames // 20)
                if total_frames and frame_num % step == 0:
                    pct = round(frame_num / total_frames * 100)
                    elapsed = time.time() - t0
                    print(f"  [{pct:3d}%] frame {frame_num}/{total_frames}  ({elapsed:.1f}s elapsed)")

            frame_num += 1

    cap.release()

    elapsed = time.time() - t0
    total_samples = len(face_data)
    no_face_pct = round(no_face_count / total_samples * 100, 1) if total_samples else 0

    output = {
        "source": str(video_path),
        "video_fps": fps,
        "video_width": width,
        "video_height": height,
        "total_frames": frame_num,
        "sample_interval": args.interval,
        "total_samples": total_samples,
        "no_face_samples": no_face_count,
        "no_face_percentage": no_face_pct,
        "min_confidence": args.min_confidence,
        "faces": face_data,
    }

    out_path.write_text(json.dumps(output, ensure_ascii=False), encoding="utf-8")

    print()
    print(f"Done in {elapsed:.1f}s")
    print(f"  Samples:  {total_samples}")
    print(f"  No-face:  {no_face_count} ({no_face_pct}%)")
    print(f"  Wrote:    {out_path}")

    if no_face_pct > 30:
        print()
        print(f"⚠️  Warning: {no_face_pct}% of samples have no detected face.")
        print("   Smart Zoom may not work well. Check that the lecturer is visible.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
