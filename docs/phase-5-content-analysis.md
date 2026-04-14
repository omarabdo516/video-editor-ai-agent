# Phase 5: تحليل المحتوى

> **آخر تحديث:** 2026-04-14 — اتعدّل عشان يطابق pattern الـ files جنب الفيديو
> (اللي بيتولّد من Phase 1 + 2) بدل ما يعتمد على فولدر `src/data/` static.

## المبدأ

**أنت (Claude Code) بتعمل التحليل ده بنفسك في الـ context — مفيش API calls، مفيش
script Python أو Node بيشغّل LLM. إنت بتقرا الـ inputs، تفكّر فيهم، وتكتب الـ JSON.**

ده اللي بيخلي الـ pipeline ذكي بدون تكلفة API.

---

## Inputs

كل الـ inputs بتتولّد في Phase 1 + 2 وبتعيش **جنب الفيديو** (مش في `src/data/`):

| الملف | بيتولّد في | الوصف |
|------|-----------|------|
| `<video>.mp4.captions.json` | Phase 2 (`scripts/transcribe.py`) ثم approve في الـ subtitle editor | النص الكامل + word-level timestamps |
| `<video>.16k.wav.energy.json` | Phase 1 (`scripts/audio_energy.py`) | RMS energy + emphasis_moments (high_energy / dramatic_pause) |
| `<video>.1080x1920.mp4.metadata.json` | Phase 1 (`scripts/video_metadata.py`) | مدة + أبعاد + fps + codec |

> **مهم:** الـ captions لازم تكون **approved** (المستخدم فتح الـ subtitle editor، عدّل،
> ضغط Approve & Save). من غير الـ approval، الـ analysis هيتعمل على text فيه أخطاء.

---

## Output

`src/data/<video_basename>/content_analysis.json`

ليه `src/data/` مش جنب الفيديو؟
1. **Learning loop:** الـ AI agent محتاج يقرا الـ analyses القديمة عشان يطوّر نفسه، فلازم يكونوا في مكان واحد جوّا الـ repo.
2. **Privacy:** ممكن يكون الفيديو الخام موجود على hard drive خارجي (`D:/Work/...`) مش على نفس الـ disk بتاع الـ agent.
3. **Multi-video:** كل فيديو بياخد فولدر بإسمه الكامل تحت `src/data/` — كل الـ artifacts الخاصة بيه (analysis, plan, eval) في مكان واحد.

البنية:
```
src/data/
  <video_basename>/
    content_analysis.json    ← Phase 5 output
    animation_plan.json      ← Phase 6 output (مستقبلاً)
    feedback.json            ← Phase 9 output (مستقبلاً)
```

---

## Schema

```json
{
  "schema_version": 1,
  "phase": 5,
  "generated_at": "YYYY-MM-DD",
  "generated_by": "Claude Code (model)",

  "source": {
    "video": "absolute path to original mp4",
    "video_scaled": "absolute path to 1080x1920 mp4",
    "captions": "absolute path to captions.json",
    "energy": "absolute path to energy.json",
    "metadata": "absolute path to metadata.json"
  },

  "video": {
    "duration_sec": 209.173,
    "duration_str": "03:29",
    "fps": 30,
    "width": 1080,
    "height": 1920,
    "language": "ar",
    "dialect": "egyptian",
    "segment_count": 203
  },

  "lecturer": {
    "name": "محمد ريان",
    "title": "خبير محاسبة",
    "workshop": "ورشة المحاسب الشامل"
  },

  "summary": "ملخص 3-5 جمل بالعامية المصرية",

  "topics": ["موضوع 1", "موضوع 2", "..."],

  "sections": [
    {
      "id": 1,
      "title": "...",
      "start_sec": 0.10,
      "end_sec": 25.10,
      "start_str": "00:00",
      "end_str": "00:25",
      "subtitle_range": [0, 23],
      "summary": "..."
    }
  ],

  "key_moments": [
    {
      "id": 1,
      "subtitle_ids": [25, 26, 27, 28, 29, 30, 31],
      "timestamp_start_sec": 27.30,
      "timestamp_end_sec": 33.77,
      "timestamp_start": "00:27",
      "timestamp_end": "00:33",
      "content": "نص اللحظة المفتاحية",
      "importance": "high",
      "concept_type": "process",
      "suggested_animation": "full_screen_scene",
      "animation_description": "وصف بصري تفصيلي للأنيميشن المقترح"
    }
  ],

  "keywords": [
    {
      "term": "RS",
      "first_seen_subtitle": 25,
      "first_seen_sec": 27.30,
      "category": "brand",
      "weight": 5
    }
  ],

  "emphasis_moments": [
    {
      "energy_time_sec": 26.464,
      "energy": 0.186,
      "energy_type": "high_energy",
      "subtitle_id": 25,
      "text": "النص في اللحظة دي",
      "intensity": "strong",
      "suggested_treatment": "smart_zoom_plus_overlay",
      "key_moment_ref": 1,
      "rationale": "ليه قويّ"
    }
  ],

  "stats": { ... },
  "phase_6_hints": { ... }
}
```

### الـ Enums

**`importance`**: `high | medium | low`

**`concept_type`**: `definition | example | comparison | process | equation | statistic | tip | metaphor`

**`suggested_animation`** (للـ key_moments): `full_screen_scene | overlay | keyword_highlight | smart_zoom_plus_overlay | smart_zoom_only`

**`intensity`** (للـ emphasis_moments): `strong | medium | low`

**`suggested_treatment`** (للـ emphasis_moments):
- `full_screen_scene_anchor` — اللحظة دي تبقى مرساة لـ full-screen scene
- `smart_zoom_plus_overlay` — zoom على الوش + overlay فوق
- `smart_zoom_only` — zoom بس
- `keyword_highlight` — كلمة بـ accent + scale
- `overlay_only` — overlay صغير من غير zoom

---

## الخطوات

### Step 5.1: اقرا الـ 3 inputs

اقرا (بـ Read tool):
1. `<video>.mp4.captions.json` — لو كبير، استخدم Node script يطلّع compact version (start/end/text بدون word-level)
2. `<video>.16k.wav.energy.json` — صغير، اقراه كله
3. `<video>.1080x1920.mp4.metadata.json` — صغير، اقراه كله

### Step 5.2: حلّل المحتوى

اشتغل في الـ context:

1. **Summary** (3-5 جمل عامية مصرية)
2. **Topics** (5-10 موضوع)
3. **Sections** — قسّم الفيديو لـ 4-7 أقسام منطقية. كل قسم: title, subtitle range, time range, summary
4. **Key Moments** — لحظات تحتاج treatment بصري:
   - عرّف importance بناءً على القيمة التعليمية
   - اختار concept_type بدقة
   - اقترح animation type واكتب animation_description تفصيلي يقدر Phase 6 يحوّله لـ component
5. **Keywords** — مصطلحات مهمة (workshop names, roles, concepts, brand terms, metaphors)
6. **Emphasis Moments** — لكل entry في `energy.json`:
   - لاقي الـ subtitle المتطابق زمنياً (segment.start ≤ energy_time ≤ segment.end)
   - حدّد intensity حسب: text importance + energy value + علاقة بـ key_moment
   - اقترح treatment

### Step 5.3: اكتب الـ JSON

`src/data/<video_basename>/content_analysis.json`

استخدم اسم الفيديو زي ما هو (Arabic OK — الـ filesystem بيدعم).

### Step 5.4: ولّد phase_6_hints

عشان Phase 6 يبقى عنده:
- **recommended_scene_count** — حسب الـ duration والـ key_moments density
- **top_priority_scenes** — اختار أحسن 4-5 key_moments للـ full-screen treatment
- **smart_zoom_density** + **overlays_density** — تذكير بحدود الـ scene-validation-rules

### Step 5.5: اعرض الملخص

```
🧠 تحليل المحتوى — <video_basename>
─────────────────────────────────
⏱  المدة: MM:SS (X segments)
📑 الأقسام: N
⭐ نقاط مفتاحية: M (X high / Y medium)
🏷  كلمات مفتاحية: K
🔍 لحظات تأكيد: Z (strong: A | medium: B | low: C)
🎬 Phase 6 هيختار: 4-5 full-screen scenes max
─────────────────────────────────

نبدأ Phase 6 (خطة الأنيميشنز)؟
```

### Step 5.6: استنى موافقة قبل الـ commit

ما تـ commit إلا لما المستخدم يقول. لو وافق:

```bash
git add docs/phase-5-content-analysis.md src/data/<basename>/content_analysis.json
git commit -m "Phase 5: content analysis for <video_basename>"
```

---

## ملاحظات على الـ Implementation

### الـ captions.json كبير

الـ Read tool عنده حد ~10k tokens. لو الـ captions.json أكبر (203 segment ≈ 35k tokens
بسبب الـ word-level timestamps)، استخدم Node script يطلّع compact:

```js
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('PATH_TO_CAPTIONS', 'utf8'));
const lines = data.segments.map((s, i) => i + '|' + s.start.toFixed(2) + '|' + s.end.toFixed(2) + '|' + s.text);
fs.writeFileSync('./tmp_captions_compact.txt', lines.join('\n'));
console.log('segments:', data.segments.length);
"
```

بعدها اقرا الـ tmp file بـ Read tool (بيكون أصغر بكتير — segment-level بدون word-level).
احذف الـ tmp بعد الانتهاء.

### الـ basename فيه عربي

استخدم اسم الفيديو original (مع المسافات والعربي). الـ filesystem على Windows/Mac/Linux بيدعمه.
لو حصلت مشكلة في path في bash، استخدم double-quotes حواليه.

### مفيش commit تلقائي

الـ task ده generative — المستخدم لازم يراجع الـ analysis قبل ما يـ commit. ما تـ commit إلا لما يقول.
