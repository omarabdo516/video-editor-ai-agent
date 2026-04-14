# Local Whisper Transcription Setup

Uses **faster-whisper** (CTranslate2 port) running locally on GPU. Free, fast, and produces word-level timestamps for highlighted-phrase captions.

## Hardware in use

- GPU: NVIDIA RTX 5060 Ti 16 GB (Blackwell, CUDA 13.1 driver)
- Python: 3.11.9 (via uv + separate venv — does NOT touch system Python 3.14)
- Model: `large-v3` (~3 GB VRAM at float16)
- Expected speed: ~10× real-time (1 hour of audio → ~6 min transcription)

## Files

| File | Purpose |
|------|---------|
| `transcribe.py` | Python entry point — loads Whisper, transcribes, writes `captions.json` |
| `transcribe.js` | Node wrapper — activates the venv and calls `transcribe.py` |
| `_tools/whisper-env/.venv/` | Python 3.11 virtual environment (isolated from system) |

## One-time installation

These steps were executed automatically. Re-run if the venv breaks or you move machines:

```bash
# 1. Create the venv
cd C:/Users/PUZZLE/Documents/Claude/_tools/whisper-env
uv venv --python 3.11

# 2. Install PyTorch with CUDA 12.8 (required for Blackwell GPU)
uv pip install --python .venv/Scripts/python.exe torch torchaudio --index-url https://download.pytorch.org/whl/cu128

# 3. Install faster-whisper
uv pip install --python .venv/Scripts/python.exe faster-whisper
```

**First-run model download**: The first time you run `transcribe.py`, it downloads the `large-v3` model (~3 GB) from Hugging Face and caches it in `%USERPROFILE%\.cache\huggingface\`. Subsequent runs are instant.

## Usage

### Via Node wrapper (recommended)

```bash
cd C:/Users/PUZZLE/Documents/Claude/video-editor-ai-agent
node transcribe.js "C:/videos/lecture.mp4"
```

Outputs `C:/videos/lecture.mp4.captions.json` in the same shape as `srt-parser.js` produces.

Write an SRT too:

```bash
node transcribe.js "C:/videos/lecture.mp4" --srt "C:/videos/lecture.srt"
```

### Direct Python (for debugging)

```bash
cd C:/Users/PUZZLE/Documents/Claude/_tools/whisper-env
.venv/Scripts/python.exe "C:/Users/PUZZLE/Documents/Claude/video-editor-ai-agent/scripts/transcribe.py" "C:/videos/lecture.mp4"
```

## Arguments

| Flag | Default | Description |
|------|---------|-------------|
| `input` | — | Video or audio path (any ffmpeg-readable format) |
| `--output` | `<input>.captions.json` | Captions JSON output path |
| `--srt` | none | Also write an SRT file at this path |
| `--model` | `large-v3` | Whisper model size |
| `--language` | `ar` | Source language (use `en`, `ar`, `auto`, etc.) |
| `--device` | `cuda` | `cuda` / `cpu` / `auto` |
| `--compute-type` | `float16` | `float16` (GPU) / `int8_float16` / `int8` (CPU fallback) |
| `--beam-size` | `5` | Higher = more accurate but slower |

## Output JSON schema

Same shape as `srt-parser.js` output — `build-reels.jsx` reads both interchangeably.

```json
{
  "source": "C:/videos/lecture.mp4",
  "model": "large-v3",
  "language": "ar",
  "segmentCount": 47,
  "totalDuration": 182.4,
  "segments": [
    {
      "start": 0.5,
      "end": 3.2,
      "text": "أهلاً بيكم في ورشة المحاسب الشامل",
      "words": [
        { "word": "أهلاً", "start": 0.5, "end": 0.9 },
        { "word": "بيكم",  "start": 0.9, "end": 1.2 }
      ]
    }
  ]
}
```

## Model sizes — tradeoff table

| Model | VRAM | Speed (RTF on 5060 Ti) | Arabic quality |
|-------|------|------------------------|----------------|
| `tiny` | ~1 GB | ~100× RT | Poor |
| `base` | ~1 GB | ~50× RT | Fair |
| `small` | ~2 GB | ~25× RT | Good |
| `medium` | ~5 GB | ~15× RT | Very good |
| **`large-v3`** | **~3 GB (int8)** | **~10× RT** | **Best** ✅ |

`large-v3` with float16 fits comfortably on the 16 GB GPU. No need to drop to smaller models.

## Troubleshooting

**"CUDA out of memory"**
→ Switch to `int8_float16` compute type: `node transcribe.js video.mp4 --compute-type int8_float16`. Halves VRAM usage with negligible quality loss.

**"torch.cuda.is_available() returns False"**
→ PyTorch was installed without CUDA support. Reinstall with the `--index-url https://download.pytorch.org/whl/cu128` flag (or cu121 / cu124 depending on your driver).

**"Could not load library cudnn_ops_infer64_8.dll"**
→ Install the cuDNN runtime. On Windows: `uv pip install nvidia-cudnn-cu12` in the same venv.

**Transcription starts but is stuck at 0%**
→ First-run model download is silent. Wait 5–10 min. Check `%USERPROFILE%\.cache\huggingface\hub\` — you should see `models--Systran--faster-whisper-large-v3` growing.

**Arabic words are misrecognized (dialect issues)**
→ Whisper `large-v3` handles Modern Standard Arabic and most dialects well, but Egyptian slang ("بتاع", "يسطا", etc.) can trip it. For the lecturer content this is rarely a problem, but you can:
1. Manually edit the resulting SRT
2. Or fine-tune with a dialect-specific model (advanced)

**Output file is empty**
→ VAD filter removed all audio as silence. Disable it: add `--vad-filter=False` in `transcribe.py` call, or drop the flag.

## Why this setup over WhisperX?

| | faster-whisper | WhisperX |
|---|---|---|
| Python support | 3.9–3.12 | 3.10–3.11 |
| Word timing accuracy | ±100 ms | ±30 ms |
| Setup complexity | Minimal | Needs wav2vec2 alignment model per language |
| Arabic alignment model | Built-in | Needs separate Arabic wav2vec2 |
| GPU utilization | Excellent | Excellent |

The ±100 ms difference is imperceptible in highlighted-phrase captions. Faster-whisper wins on simplicity.

## Integration with RS Reels workflow

The `/rs-reels` Claude skill detects which input you provided:

- **You give it an SRT file** → uses `srt-parser.js` (no Whisper needed)
- **You give it only a video file** → runs `transcribe.js` first, then feeds the result into `build-reels.jsx`

Either way the downstream build script is the same.
