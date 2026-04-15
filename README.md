# Video Editor AI Agent

> **بيلاقي وش المحاضر، بيتسمعه، بيكتب الكابشنز، بيـ zoom في لحظات الحماس، وبيرندر ريل احترافي.**
> Automated Arabic-lecturer Reels (1080×1920) pipeline built around Remotion, faster-whisper, MediaPipe, and Claude Code as the planning brain.

---

## What it does

Feed it a raw lecturer video. It will:

1. **Pre-process** — extract a 16kHz mono WAV, pre-scale to 1080×1920 (center-crop), pull metadata via ffprobe.
2. **Detect faces** — MediaPipe BlazeFace samples every 5 frames → `face_map.json` with normalized face center, size, and confidence.
3. **Analyze audio energy** — librosa RMS analysis → `energy.json` with high-energy and dramatic-pause moments.
4. **Transcribe** — faster-whisper `large-v3` on CUDA + word-level timestamps + a Cairo-Egyptian-accounting initial prompt → `captions.json`.
5. **Auto-fix Egyptian Arabic** — phonetic substitutions (ض↔د, ث↔س, etc.) preserving word timings.
6. **Plan zooms** (Claude in the loop) — read `face_map` + `energy` → produce `zoom_plan.json` with 4-second face-tracked zoom moments.
7. **Render via Remotion** — full 9:16 reel with: highlighted-word captions, lower-third intro, logo bug, smart-zoom on the speaker's face, branded outro.

The current output style is for **RS Financial Services** (`brands/rs/`). The directory layout supports adding more brands later — each gets its own `BRAND.md` and assets.

---

## Quick start

### Prerequisites

- **Node.js ≥ 18** (tested on Windows 11)
- **FFmpeg** at `C:/ffmpeg/bin/ffmpeg.exe` (or edit `preprocess-audio.js`)
- **Python 3.11** with the `whisper-env` venv at `C:/Users/PUZZLE/Documents/Claude/_tools/whisper-env/.venv/`
  - `pip install faster-whisper mediapipe librosa opencv-python soundfile numpy`
- **GPU** strongly recommended — tested on RTX 5060 Ti 16GB
- **Cairo + Tajawal fonts** are loaded via `@remotion/google-fonts` automatically

### Install

```bash
npm install
cd dashboard-api && npm install && cd ..
cd dashboard-ui && npm install && cd ..
```

### Run the Dashboard (recommended — Phase 11+)

The primary interface is the Dashboard UI — a local React app that drives every phase without burning a Claude session on progress output.

```bash
npm run dashboard              # starts API (:7778) + UI (:5174) concurrently
# then open http://localhost:5174
```

See [`docs/dashboard-workflow.md`](docs/dashboard-workflow.md) for the full guide — adding videos, running phases, the Claude Phase 5/6 handoff mechanism, bulk mode, rating, and troubleshooting.

### Run the full pipeline (CLI fallback)

The CLI still works for debugging, range renders, and post-publish performance tracking. The Dashboard wraps these commands under the hood.

```bash
# end-to-end (audio → transcribe → fix → render)
node rs-reels.mjs make path/to/lecture.mp4 \
  --lecturer "اسم المحاضر" \
  --workshop "اسم الورشة" \
  [--output reel.mp4]
```

### Or step by step

```bash
# 1. Pre-processing only (audio + face_map + energy + metadata)
node rs-reels.mjs phase1 path/to/lecture.mp4

# 2. Edit captions in the visual subtitle editor (Vite + wavesurfer.js)
#    Auto-loads the video + captions, runs at http://localhost:5173
node rs-reels.mjs edit path/to/lecture.mp4

# 3. Open Remotion Studio to preview the final reel before render
node rs-reels.mjs studio path/to/lecture.mp4 \
  --lecturer "..." --workshop "..." \
  --skip-audio --skip-transcribe
```

### Edit captions visually (recommended)

The `edit` command opens a full-featured browser-based subtitle editor:

- **Waveform** with draggable regions per caption (resize to retime)
- **Subtitle list** with word-count badges (5–7 = green, otherwise amber)
- **Edit panel** for timing inputs + text + Split / Merge / Delete / Move-word-to-prev/next
- **Keyboard shortcuts:** Space (play), arrows (seek/navigate), Ctrl+Z (undo), Ctrl+Shift+Z (redo), Delete, S (split at playhead), M (merge with next), Ctrl+Shift+← / → (move first/last word)
- **Approve & Save** button writes a `captions.json` ready for the agent

### Edit captions in any text editor (alternative)

If you'd rather use VS Code, Subtitle Edit, Aegisub, etc.:

```bash
# Export the auto-transcribed captions to .srt for hand-editing
node caps.js export path/to/lecture.mp4.captions.json

# (edit the .srt in your editor of choice)

# Re-import the edited .srt back to .json (preserves word timings proportionally)
node caps.js import path/to/lecture.mp4.captions.srt
```

---

## Project structure

```
video-editor-ai-agent/
├── CLAUDE.md                   ← Claude Code instructions / current state
├── README.md                   ← you are here
├── rs-reels.mjs                ← end-to-end CLI (make / studio / phase1)
├── caps.js                     ← SRT export/import for manual caption editing
├── preprocess-audio.js         ← FFmpeg → 16kHz mono WAV
├── transcribe.js               ← Node wrapper around scripts/transcribe.py
├── fix-captions.js             ← Egyptian Arabic phonetic corrections
├── srt-parser.js               ← shared SRT parser
├── remotion.config.ts          ← render config (concurrency, GPU acceleration)
├── package.json
│
├── brands/                     ← multi-brand support (one folder per client)
│   └── rs/
│       ├── BRAND.md            ← RS identity, colors, fonts, logo rules
│       └── assets/
│           ├── logo.png
│           └── logo-alt.png
│
├── docs/                       ← phase-by-phase plan + design system
│   ├── design-system.md
│   ├── error-recovery.md
│   ├── scene-validation-rules.md
│   ├── phase-0-setup.md
│   ├── phase-1-preprocessing.md
│   ├── phase-2-transcription.md
│   ├── phase-3-subtitle-editor.md
│   ├── phase-4-captions-review.md
│   ├── phase-5-content-analysis.md
│   ├── phase-6-animation-planning.md
│   ├── phase-7-remotion-components.md
│   ├── phase-8-render.md
│   ├── phase-9-feedback.md
│   └── phase-B-batch.md
│
├── feedback/                   ← rating loop scaffolding
│   ├── log.json
│   ├── style_evolution.md
│   └── best_components/
│
├── scripts/                    ← Python pipeline scripts
│   ├── transcribe.py           ← faster-whisper
│   ├── face_detect.py          ← MediaPipe BlazeFace
│   ├── audio_energy.py         ← librosa
│   ├── video_metadata.py       ← ffprobe wrapper
│   └── models/
│       └── blaze_face_short_range.tflite
│
├── src/                        ← Remotion composition
│   ├── Root.tsx
│   ├── Reel.tsx                ← main composition
│   ├── tokens.ts               ← runtime design tokens
│   ├── types.ts                ← shared types (also imported by subtitle-editor via @agent/*)
│   ├── preview-props.json      ← auto-written by `studio` command
│   ├── components/
│   │   ├── VideoTrack.tsx
│   │   ├── WordCaption.tsx     ← highlighted-word captions
│   │   ├── LogoBug.tsx
│   │   ├── LowerThird.tsx
│   │   ├── Outro.tsx
│   │   └── SmartZoom.tsx       ← face-tracked spring zoom
│   └── utils/
│       ├── chunk.ts
│       └── fonts.ts
│
├── subtitle-editor/            ← Vite + React + wavesurfer.js (Phase 3 / C)
│   ├── package.json            ← independent deps (React 19, Tailwind v4, Zustand)
│   ├── vite.config.ts
│   ├── tsconfig.app.json       ← path alias @agent/* → ../src/*
│   ├── index.html
│   └── src/
│       ├── App.tsx             ← layout (toolbar / video / list / waveform / edit)
│       ├── main.tsx
│       ├── index.css           ← Tailwind v4 + Cairo/Tajawal + RTL
│       ├── store/useSubtitleStore.ts  ← Zustand with 50-step undo/redo
│       ├── components/
│       │   ├── VideoPlayer.tsx
│       │   ├── WaveformTimeline.tsx   ← wavesurfer + Regions + Timeline
│       │   ├── SubtitleList.tsx       ← search + word-count badges
│       │   ├── SubtitleEditPanel.tsx  ← timing + text + Split/Merge/Move-word
│       │   ├── Toolbar.tsx            ← Import/Export/Approve/Undo/Redo
│       │   ├── KeyboardHandler.tsx    ← global keyboard shortcuts
│       │   └── Dropzone.tsx           ← drag-drop video + .srt/.json
│       ├── store/
│       ├── types/subtitle.ts          ← editor-side types (re-uses @agent/types)
│       └── utils/
│           ├── srt-parser.ts          ← SRT ↔ JSON ↔ Subtitle[]
│           ├── time-utils.ts
│           └── constants.ts
│
├── public/                     ← Remotion staticFile() assets
│   ├── logo.png
│   └── logo-alt.png
│
├── samples/                    ← tiny fixtures for testing
│   ├── test.srt
│   └── test.captions.json
│
└── .screenshots/               ← Smart Zoom verification stills
    ├── 01-no-zoom-14s.png
    ├── 02-zoom-peak-18s.png
    ├── 03-strong-zoom-84s.png
    └── 04-no-zoom-100s.png
```

---

## Output files (per video)

When you process a video at `D:/path/to/lecture.mp4`, the pipeline creates these files **next to the source video** (not inside the repo):

- `lecture.16k.wav` — extracted + normalized audio
- `lecture.1080x1920.mp4` — pre-scaled center-cropped video
- `lecture.1080x1920.mp4.metadata.json` — ffprobe data
- `lecture.1080x1920.mp4.face_map.json` — face positions every 5 frames
- `lecture.16k.wav.energy.json` — emphasis moments
- `lecture.mp4.captions.json` — Whisper output with word timings
- `lecture.mp4.captions.srt` — exported for manual editing (via `caps.js`)
- `lecture.mp4.zoom_plan.json` — manually authored or future Phase-6 generated
- `lecture-reel.mp4` — final output

The repo `.gitignore` excludes all of these — the only thing tracked here is the **code + brand profiles + plan docs**, never the per-video data.

---

## Brand: currently RS Financial Services

The active brand profile lives at [`brands/rs/BRAND.md`](brands/rs/BRAND.md). It defines:

- **Colors:** `#10479D` (primary blue), `#FFB501` (accent gold), `#0D1F3C` (overlay dark)
- **Fonts:** Cairo Bold (headings), Tajawal ExtraBold (captions)
- **Logo placement:** top-center (not bottom-right — the bottom is captions territory in 9:16)
- **Tagline:** "بنحقق طموحاتك المحاسبية"
- **Voice:** Egyptian colloquial, expert + approachable
- **Workshop terminology:** "ورشة" (not "كورس")، "متدرب" (not "طالب")

Adding another brand later means: create `brands/<client>/BRAND.md` + `brands/<client>/assets/`, then a small refactor to make `src/tokens.ts` brand-aware via a CLI flag.

---

## Status

Built incrementally as Phases A → B (current state). See [`CLAUDE.md`](CLAUDE.md) for the full phase-by-phase status. Verified on a real lecture (محمد ريان — ورشة الشامل, ~3.5 minutes):

- 1255 face samples, 95.2% face coverage, confidence median 0.87
- 55 emphasis moments (30 high-energy + 25 dramatic pauses)
- 6-moment manually-authored zoom plan rendered correctly with the speaker's face staying in upper-third frame across all transitions
- Captions, logo, and lower-third correctly sit *outside* the SmartZoom transform — only the video layer is zoomed

---

## Tech notes

**Why faster-whisper (not WhisperX):**
CTranslate2 backend is faster on the RTX 5060 Ti, ships with VAD + word timestamps + condition-on-previous-text out of the box, and avoids manual torch setup.

**Why MediaPipe Tasks API (not legacy `mp.solutions`):**
mediapipe ≥ 0.10.30 removed `mp.solutions` entirely. The Tasks API requires a `.tflite` model file (auto-downloaded to `scripts/models/blaze_face_short_range.tflite`).

**Why pre-scale before render:**
Cropping the source to 1080×1920 once with ffmpeg saves Remotion from re-cropping every frame. ~2× render speedup vs. letting OffthreadVideo do `objectFit: cover`.

**Why an HTTP server for the video:**
Remotion's OffthreadVideo can't load `file://` URLs during headless render. The pipeline spins up a tiny HTTP server with range-request support to stream the video to Remotion.

---

## License

Private project. Not licensed for redistribution.
