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
