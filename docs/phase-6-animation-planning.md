# Phase 6: خطة الأنيميشنز

## Input
- `src/data/content_analysis.json` — تحليل المحتوى
- `src/data/subtitles_approved.json` — الكابشنز
- `src/data/face_map.json` — إحداثيات الوش
- `src/data/audio_energy.json` — لحظات الحماس
- `docs/design-system.md` — الألوان والخطوط
- `brand/RS_BRAND.md` — هوية RS
- `docs/scene-validation-rules.md` — قواعد الأنيميشنز

## Output
- `src/data/animation_plan.json`

## Success Criteria
- [ ] الخطة تتبع الـ Scene Validation Rules
- [ ] مفيش Full-Screen Scenes أقرب من 45 ثانية من بعض
- [ ] مفيش overlays أقرب من 20 ثانية من بعض
- [ ] الألوان من الـ brand
- [ ] المستخدم وافق على الخطة

---

## الخطوات

### Step 6.1: اقرأ القواعد أولاً

**إجباري:** اقرأ `docs/scene-validation-rules.md` قبل أي اقتراح.

### Step 6.2: اقرأ كل ملفات البيانات

اقرأ content_analysis + subtitles + face_map + audio_energy + design-system + RS_BRAND

### Step 6.3: بناء الخطة

لكل key_moment في content_analysis، قرر:

**هل يحتاج Full-Screen Scene?**
- ✅ لو: مفهوم مجرد + يتوضح بصرياً + مفيش demo
- ❌ لو: آخر scene من < 45 ثانية + المدة < 5 ثواني

**هل يحتاج Overlay?**
- ✅ لو: كلمة مفتاحية أو رقم مهم أو تنبيه
- ❌ لو: في وقت full-screen scene أو overlay تاني

**هل يحتاج Smart Zoom?**
- ✅ لو: emphasis عالي + face confidence > 0.5
- ❌ لو: أثناء full-screen scene + حركة > 20%

**هل يحتاج Chapter Divider?**
- ✅ لو: بداية قسم جديد في content_analysis.sections

### Step 6.4: أنشئ animation_plan.json

```json
{
  "color_palette": {
    "primary": "#...",      // من RS_BRAND.md
    "secondary": "#...",
    "accent": "#...",
    "background": "#...",
    "text": "#..."
  },
  "font": "Cairo",
  "caption_style": "hormozi",
  
  "elements": [
    {
      "id": 1,
      "type": "chapter_divider | full_screen_scene | overlay | smart_zoom",
      "scene_type": "definition | equation | comparison | process | chart | diagram | timeline",
      "overlay_type": "keyword_highlight | counter | stamp | underline",
      "timestamp_start": "00:00:00.000",
      "timestamp_end": "00:00:05.000",
      "related_subtitles": [1, 2, 3],
      "zoom_level": 1.4,
      "content": {
        "title": "...",
        "description": "...",
        "elements": ["..."]
      },
      "position": "top-center | top-right | top-left | center",
      "background": "gradient(...)",
      "animation": {
        "enter": "fade-in | scale-up | slide-in",
        "duration": "5s",
        "exit": "fade-out | scale-down | slide-out"
      },
      "reason": "ليه اخترنا النوع ده هنا"
    }
  ]
}
```

### Step 6.5: اعرض الخطة على المستخدم

```
Claude Code:
  📋 خطة الأنيميشنز ([X] عنصر):
  ─────────────────────────────────────
  🎬 #1 | 00:00-00:03 | Chapter: "المقدمة"
  🖥️ #2 | 00:45-00:53 | Scene: تعريف الميزانية (definition)
       └ باكجراوند gradient + عنوان + 3 عناصر animated
  🔍 #3 | 01:00-01:05 | Zoom 1.4x
  🏷️ #4 | 01:35-01:39 | Keyword: "الأصول الثابتة"
  🖥️ #5 | 02:15-02:25 | Scene: مقارنة أصول (comparison)
  ...
  
  🎨 الألوان: ■ [primary] ■ [secondary] ■ [accent]
  📝 الكابشنز: Hormozi Style
  
  موافق؟ عايز تعدل حاجة؟
```

### Step 6.6: تعديلات المستخدم

لو المستخدم قال "غيّر #5 من comparison لـ process":
- عدّل الخطة
- اعرضها تاني
- استنى الموافقة

### Step 6.7: Git Commit

```bash
git add .
git commit -m "v6: animation plan approved - [X] elements"
```

---

## بعد ما تخلص
```
نبدأ Phase 7 (كتابة الـ Remotion components)؟
```

---

## 🎨 Caption Style Variation (auto-assigned by Phase 6)

> اتضاف في April 2026 بناءً على feedback من Omar: "عايز أكثر من ستايل كابشنز في نفس الفيديو لكسر الملل."

### الـ styles المتاحة

| Style | الوصف | الاستخدام المثالي |
|-------|-------|-------------------|
| `hormozi` (default) | word-by-word، الكلمة النشطة بـ accent + scale 1.06 | الـ baseline لمعظم الريل |
| `pop` | كلمة واحدة ضخمة في الوقت الواحد، body zone، bouncy | لحظات الـ payoff / punchline |
| `karaoke` | كل الكلمات ظاهرة + underline accent بيملأ الكلمة الحالية RTL | لحظات إيقاعية / music-video |
| `box` | كل كلمة في box خاص بها + الكلمة النشطة accent-bg dark-text | listicle / enumerated / checklist |
| `typewriter` | الكلمات تظهر واحدة وراء الثانية مع cursor accent | setup / contemplative / slow-burn |
| `classic` | سطر أبيض نظيف، مفيش highlighting | لحظات لازم الفيديو يتنفس فيها |

### قاعدة الـ auto-assignment

**الهدف:** كل ريل فيه **3 ستايلات على الأقل** عشان المشاهد ما يملش.

**الخوارزمية اللي Claude Code بيستخدمها في Phase 6:**

1. **Default style = `hormozi`** — الـ baseline. أي segment ما عليهاش range override بتستخدم الـ default.

2. **Switch points = scene boundaries + emphasis peaks.** ما بين كل scene والـ scene اللي بعدها، الستايل يقدر يتغير.

3. **Mapping by segment intent (per `key_moment` concept_type + energy):**
   - High-energy key moment (energy ≥ 0.25) → `pop` (stand-alone word hammer)
   - `definition` / `comparison` key moments → `box` (enumerated feel)
   - `tip` / methodology moments (القسم اللي فيه RS value) → `typewriter` (slow reveal)
   - `metaphor` / payoff moments → `karaoke` (rhythm fill)
   - Low-energy narration / filler → `classic` (let video breathe)
   - Everything else → `hormozi` (default)

4. **Variety constraint:** ما تستخدمش نفس الـ style أكتر من مرتين متتاليتين في segments مجاورة — لو حصل، استبدل الثانية بـ `hormozi` عشان ما يبقاش monotonic.

5. **Minimum variety:** على الريل الـ 70-90s لازم يبقى فيه **3 styles مختلفة على الأقل** ظاهرة. لو الـ auto-assignment طلع 1-2 بس، اختار 1-2 range إضافي على high/medium emphasis moments وحطّ style مختلف عليهم.

### صيغة الـ plan

```jsonc
{
  "caption_style": "hormozi",  // default (fallback)
  "caption_style_ranges": [
    { "start_sec": 0,   "end_sec": 11,  "style": "typewriter", "reason": "setup / hook — slow reveal" },
    { "start_sec": 20,  "end_sec": 26,  "style": "box",        "reason": "definition moment — enumerated feel" },
    { "start_sec": 50,  "end_sec": 58,  "style": "karaoke",    "reason": "rhythm-heavy contrast" },
    { "start_sec": 62,  "end_sec": 68,  "style": "pop",        "reason": "payoff — massive single word" }
  ]
}
```

**ملاحظات:**
- الـ `ranges` بتعمل override على الـ default فقط داخل النافذة بتاعتها. أي segment بره كل النوافذ بتستخدم `caption_style` الافتراضي.
- الـ range بيتحدد للـ segment على أساس الـ **midpoint** (مش الـ start). فـ لو segment start=10s end=12s وفيه range 11-15s، الـ midpoint=11s فيدخل الـ range.
- الـ ranges ما يلزمش تكون مرتبة أو متجاورة — الـ Reel بيلف عليهم لكل caption segment.
- الـ ranges تقدر تتداخل مع scene windows — الكابشنز جوا الـ scenes مخفية أصلاً، فالـ range هيـ apply بس على الكابشنز الظاهرة.

### مثال تشغيل كامل

ريل 70s عن المحاسبة:
- 0-11s: intro + hook → `typewriter` (slow setup feel)
- 11-18s: scene (captions hidden) — no effect
- 18-26s: reframe moment → `box`
- 26-33s: scene (hidden) — no effect
- 33-44s: RS methodology → `hormozi` (default, trustworthy baseline)
- 44-51s: scene (hidden) — no effect
- 51-58s: contrast / warning → `karaoke` (rhythm)
- 58-62s: transition → `hormozi`
- 62-68s: scene (hidden) — no effect
- 68-70s: final caption → `classic` (let the closing breathe)

الـ styles اللي ظهرت فعلياً: typewriter, box, hormozi, karaoke, classic = 5 styles في ريل واحد. كسر الملل ✓.

