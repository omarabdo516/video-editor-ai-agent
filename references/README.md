# References

Folder for **external reference videos** — reels and edits made by other creators that we want to study and learn from. Each reference gets analyzed, frame by frame, into structured design notes that feed back into the RS Reels brand and animation system.

This is **separate** from `feedback/`. `feedback/` tracks Omar's own iterations on RS Reels output. This folder tracks **external inspiration**.

## Folder convention

```
references/
├── README.md                    (this file)
├── <creator-or-style>-<topic>/
│   ├── source.mp4               (the reference video — gitignored)
│   ├── notes.md                 (free-form context: where it came from, why it caught your eye)
│   └── _analysis/
│       ├── metadata.json        ffprobe (duration, fps, codecs)
│       ├── scene_cuts.json      detected cut timestamps + frame index
│       ├── audio_energy.json    emphasis moments (high-energy / dramatic-pause)
│       ├── frames/
│       │   ├── uniform/         JPEG every 2s (default)
│       │   └── scene_cuts/      JPEG at each scene change
│       ├── analysis.template.md (auto-generated stub)
│       └── analysis.md          (Claude fills this in)
```

**Naming convention:** `<creator-or-style>-<topic>` (kebab-case). Examples:
- `hormozi-financial-hook/`
- `vox-explainer-typography/`
- `aljazeera-news-lower-third/`

## Workflow

### Step 1 — Drop the video

```bash
mkdir references/<name>
# copy or move the video into the folder, naming it source.<ext>
cp ~/Downloads/cool-reel.mp4 references/<name>/source.mp4
```

Optionally write a quick `notes.md` with where it came from + what caught your eye.

### Step 2 — Run the analyzer

```bash
node scripts/analyze_reference.mjs references/<name>/source.mp4
```

This extracts frames (uniform sampling + scene-cut detection), ffprobe metadata, audio-energy emphasis moments, and writes an `analysis.template.md` stub.

Idempotent — re-running skips work that's already done. Pass `--force` to regenerate.

### Step 3 — Ask Claude to analyze

In Claude Code, say:

> حلّل الـ reference بتاع `references/<name>/`

Claude will:
1. Read `metadata.json`, `scene_cuts.json`, `audio_energy.json`
2. Read frames from `frames/uniform/` and `frames/scene_cuts/` (using the multimodal Read tool)
3. Fill in `_analysis/analysis.md` with structured findings
4. Optionally promote key learnings to `feedback/reference_library.md`

### Step 4 — Promote to library

If a reference has tactics worth replicating across all RS Reels work, Claude promotes them to [`feedback/reference_library.md`](../feedback/reference_library.md) — the cumulative cross-reference design knowledge base. Individual `analysis.md` files stay as the per-reference deep dive.

## What gets committed vs. ignored

- **Committed:** `_analysis/**` (frames + JSON + analysis.md) — small files, worth keeping
- **Ignored:** `source.*` — the reference video itself (often copyrighted; keep it out of git)

See `.gitignore` in this folder.

## Tuning the extraction

Default settings are tuned for reels (~20-90s). For longer videos, you may want to lower `--fps`:

```bash
# 30-second reel: default fps=0.5 → ~15 uniform frames (good)
# 5-minute video: default would be 150 frames; auto-throttles to stay under --max-frames=200

# Want denser sampling for a complex 30s reel?
node scripts/analyze_reference.mjs references/<name>/source.mp4 --fps 1

# Want more scene cuts (sensitive)?
node scripts/analyze_reference.mjs references/<name>/source.mp4 --scene-threshold 0.3

# Skip audio analysis for music-only references
node scripts/analyze_reference.mjs references/<name>/source.mp4 --no-audio
```
