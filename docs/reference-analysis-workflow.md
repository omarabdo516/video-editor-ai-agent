# Reference Analysis Workflow

> **اللي بيعمله النظام ده باختصار:** Omar بيبعت لـ Claude reel أو فيديو من أي حد تاني (Hormozi, MrBeast, Vox, الجزيرة، أي حد) — Claude بيقطّعه frames ويحلّله frame-by-frame ويطلع منه design references محفوظة وقابلة للاستخدام في RS Reels.

## ليه احنا محتاجين النظام ده

كل الـ analysis infrastructure القديمة في المشروع (audio_energy.py, face_detect.py, speech_rhythm.py) مصمّمة لتحليل **فيديوهات Omar نفسه** كـ input للـ pipeline. مفيش حاجة كانت بتحلل **مصادر خارجية** عشان نتعلم منها.

`feedback/style_evolution.md` بيتراكم فيه الـ iterations اللي Omar بيعملها على شغله، بس مفيش track للـ inspiration الخارجية. ده الفجوة اللي النظام ده بيسدها.

## Mental model

تخيله زي **مفكرة inspiration بصرية**:
- كل reference بيدخل بـ folder ليه
- Claude بيشوف الـ frames زي ما إنت بتشوف الفيديو في عينك
- بيكتب ملاحظات structured (مش حشو) على caption style + scene composition + color + motion + retention
- اللي يستحق يبقى reusable بيتنقل لـ `feedback/reference_library.md`

## Architecture (الـ files المشاركة)

```
scripts/
├── extract_reference_frames.mjs   ← Pass 1: ffmpeg uniform + scene-cut sampling
└── analyze_reference.mjs           ← Orchestrator: frames + ffprobe + audio_energy + template

references/
├── README.md                       ← الـ folder convention
├── .gitignore                      ← يـ ignore source.* بس يـ track _analysis/
└── <name>/
    ├── source.mp4                  ← الفيديو نفسه (gitignored)
    ├── notes.md                    ← اختياري — context من Omar
    └── _analysis/                  ← Claude بيقرا من هنا
        ├── metadata.json
        ├── scene_cuts.json
        ├── audio_energy.json
        ├── frames/uniform/         ← JPEGs كل 2s
        ├── frames/scene_cuts/      ← JPEGs عند كل scene change
        ├── analysis.template.md    ← stub structured (auto-generated)
        └── analysis.md             ← Claude بيكتبه

feedback/
└── reference_library.md            ← الـ synthesis layer (cumulative patterns)
```

## الـ Workflow الكامل (5 خطوات)

### 1. Drop the video

```bash
mkdir references/hormozi-financial-hook
cp ~/Downloads/that-cool-reel.mp4 references/hormozi-financial-hook/source.mp4
```

اختياري — اكتب `notes.md` فيها مين عمل الفيديو، فين لقيته، إيه اللي خد عينك فيه.

### 2. Run the analyzer

```bash
node scripts/analyze_reference.mjs references/hormozi-financial-hook/source.mp4
```

اللي هيحصل:
- ffprobe على الفيديو → `metadata.json`
- ffmpeg uniform sampling عند 0.5 fps (frame كل 2 ثانية، max 200 frame)
- ffmpeg scene-cut detection (default threshold 0.4)
- Audio extraction → 16k mono WAV → audio_energy.py → `audio_energy.json`
- Template generation → `analysis.template.md` فيها structured sections فاضية

ده **idempotent** — لو شغلت الأمر تاني هيـ skip اللي خلصان. لو عايز تـ force regenerate: `--force`.

**Tunable flags:**

| Flag | Default | When to change |
|------|---------|----------------|
| `--fps` | 0.5 | أرفع لـ 1 لو الـ reel فيه تغييرات سريعة جداً |
| `--scene-threshold` | 0.4 | نزّل لـ 0.3 لو عايز يلقط cuts أكتر |
| `--max-frames` | 200 | الـ frame extraction بيـ throttle نفسه لو الفيديو طويل |
| `--no-audio` | (off) | استخدمه لو الفيديو موسيقى بس مفيش كلام |

### 3. Tell Claude to analyze

في Claude Code session:

> حلّل الـ reference بتاع `references/hormozi-financial-hook/`

Claude هيعمل:
1. يقرا `metadata.json` + `scene_cuts.json` + `audio_energy.json`
2. يقرا frames من `frames/uniform/` و `frames/scene_cuts/` (الـ Read tool بيـ accept JPEG)
3. يـ synthesize ويملا `_analysis/analysis.md` بالـ structured sections:
   - At-a-glance (vibe + format type)
   - Caption / typography system
   - Scene composition (table مع timestamps)
   - Color & atmosphere (palette)
   - Motion & pacing (rhythm + transitions)
   - Retention tricks observed
   - Brand fit verdict for RS (steal / adapt / skip)
4. يقترح أي patterns تستحق تتنقل لـ `reference_library.md`

### 4. Promote to library

لو فيه pattern قوي جداً ومتكرر، Claude بيـ propose entry جديد في `feedback/reference_library.md` تحت السكشن المناسب (Captions / Scenes / Color / Motion / Retention / Hooks / Overlays).

كل entry ليها:
- **Status:** `steal` (انسخ كما هو) / `adapt` (طبّق بتعديل) / `study` (فهم بس) / `avoid` (anti-pattern)
- **Source:** المرجع + الـ timestamp
- **Pattern:** الوصف (2-3 جمل)
- **Why it works:** الـ underlying mechanic (attention, contrast, rhythm)
- **RS application:** أي scene/overlay/caption mode في نظامنا يستخدمها

### 5. Use the library

لما Phase 6 (animation planning) بيشتغل على فيديو جديد، الـ planner بيقرا `feedback/reference_library.md` كجزء من الـ context (نفس فكرة `feedback/style_evolution.md`). الـ patterns المسجّلة بتأثر على الـ scene type + entrance style + caption variant + zoom curve اللي الـ planner بيختاره.

## Output schema

### `metadata.json` (ffprobe output — same shape as `scripts/video_metadata.py`)

```json
{
  "path": "...",
  "duration": 23.45,
  "width": 1080,
  "height": 1920,
  "fps": 30.0,
  "frame_count": 704,
  "aspect_ratio": "1080:1920",
  "video_codec": "h264",
  "audio_codec": "aac",
  "raw": { ... }
}
```

### `scene_cuts.json` (new — emitted by extract_reference_frames.mjs)

```json
{
  "source": "...",
  "duration_sec": 23.45,
  "threshold": 0.4,
  "cut_count": 8,
  "cuts": [
    { "time": 1.2, "file": "frames/scene_cuts/cut_t0001.2s.jpg" },
    ...
  ],
  "uniform_fps": 0.5,
  "uniform_frame_count": 12,
  "uniform_frames": [
    { "time": 0.0, "file": "frames/uniform/frame_t0000.0s.jpg" },
    ...
  ]
}
```

### `audio_energy.json` (reused from `scripts/audio_energy.py`)

```json
{
  "source": "...",
  "duration": 23.45,
  "mean_energy": 0.052,
  "emphasis_moments": [
    { "time": 4.12, "energy": 0.12, "type": "high_energy" },
    { "time": 17.5, "energy": 0.14, "type": "dramatic_pause" }
  ]
}
```

## Common gotchas

- **الـ source video gitignored.** لو committed عن طريق الخطأ، الـ ignore بيتأثر بس بعد ما تـ `git rm --cached`. متخافش — `_analysis/` بيتـ track عادي.
- **Scene-cut count بيـ mismatch مع uniform count عشان الـ scene cuts vfr (variable frame rate output)**. الـ extractor بيتعامل مع الفرق ويـ rename بـ pts_time من showinfo.
- **الـ frames بيتنزّلوا لـ max-side 960px** — كافي للـ vision analysis، صغير كفاية بحيث 200 frame ميحرقش الـ context.
- **لو الـ scene threshold عالي قوي**، ممكن يطلع 0 cuts. نزّله. لو واطي قوي، هتلاقي 50 cut على فيديو 30s. ابدأ من 0.4 وعدّل.
- **الـ Whisper venv path بيتحدد من `process.env.USERPROFILE`**. لو شغلت الـ script على جهاز جديد بـ user مختلف عن `omara`، الـ Python اللي بيشغّل audio_energy ممكن ما يبقاش متوفر — set `WHISPER_PY` env var.

## Example session

```bash
# 1. Drop a 28s Hormozi reel
mkdir references/hormozi-financial-hook
cp ~/Downloads/hormozi-money-mistake.mp4 references/hormozi-financial-hook/source.mp4

# 2. Run extraction (~30 seconds)
node scripts/analyze_reference.mjs references/hormozi-financial-hook/source.mp4
# → 14 uniform frames + 9 scene cuts + audio energy + template

# 3. In Claude Code:
# > حلّل الـ reference بتاع references/hormozi-financial-hook/

# Claude reads frames, fills analysis.md.

# 4. Read the analysis:
cat references/hormozi-financial-hook/_analysis/analysis.md

# 5. If a pattern is gold, it's in feedback/reference_library.md now.
```

## Relationship to existing systems

| System | Purpose | Direction |
|--------|---------|-----------|
| `_pipeline/` (Phase 1-8) | Process Omar's videos | Inward (raw → reel) |
| `feedback/log.json` | Track per-project ratings on RS Reels output | Self-feedback |
| `feedback/style_evolution.md` | Cumulative preferences from Omar's projects | Self-iteration |
| `references/<name>/_analysis/` | **Study external reels frame-by-frame** | **Outward (steal → bank)** |
| `feedback/reference_library.md` | Cumulative cross-reference patterns | **External-feedback** |
| `brands/rs/BRAND.md` | Hard brand constraints | Constraint layer |

The reference workflow lives **parallel** to Omar's editing pipeline — feeding the brand/animation system with external knowledge instead of consuming his own footage.
