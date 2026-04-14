# Phase 5: تحليل المحتوى

## Input
- `src/data/subtitles_approved.json` — الكابشنز المعتمدة
- `src/data/audio_energy.json` — لحظات الحماس
- `data/video_metadata.json` — معلومات الفيديو

## Output
- `src/data/content_analysis.json`

## Success Criteria
- [ ] الملف فيه: summary, topics, sections, key_moments, keywords, emphasis_moments
- [ ] كل key_moment فيه: subtitle_ids, timestamp, content, importance, concept_type, suggested_animation
- [ ] الـ emphasis_moments مبنية على دمج النص + audio_energy

---

## الخطوات

### Step 5.1: اقرأ الملفات الثلاثة

اقرأ:
1. `src/data/subtitles_approved.json` — النص الكامل مع التوقيتات
2. `src/data/audio_energy.json` — لحظات الطاقة العالية
3. `data/video_metadata.json` — المدة والأبعاد

### Step 5.2: حلل المحتوى

**أنت (Claude Code) هتعمل التحليل بنفسك — مش API.**

حلل الكابشنز واستخرج:

1. **ملخص عام** (3-5 جمل)
2. **المواضيع الرئيسية** (array of strings)
3. **الأقسام** — قسّم الفيديو لأجزاء منطقية:
   ```json
   {
     "title": "المقدمة",
     "start": "00:00:00",
     "end": "00:00:30",
     "subtitle_range": [1, 8]
   }
   ```
4. **النقاط المفتاحية** — لحظات تحتاج توضيح بصري:
   ```json
   {
     "subtitle_ids": [12, 13, 14],
     "timestamp_start": "00:00:45",
     "timestamp_end": "00:00:55",
     "content": "الميزانية العمومية هي قائمة بتوضح أصول وخصوم المنشأة",
     "importance": "high",
     "concept_type": "definition",
     "suggested_animation": "full_screen_scene",
     "animation_description": "تعريف الميزانية مع أيقونات توضيحية"
   }
   ```
   أنواع الـ concept_type: `definition | example | comparison | process | equation | statistic | tip`
   
5. **الكلمات المفتاحية** — مصطلحات مهمة أول مرة تتذكر
6. **لحظات التأكيد** — دمج النص + audio_energy:
   - audio energy عالية + كلمة مفتاحية = **emphasis قوي** → smart_zoom + overlay
   - dramatic pause + تعريف = **emphasis قوي** → full_screen_scene
   - audio energy عالية لوحدها = **emphasis متوسط** → smart_zoom فقط
   - نص مهم بدون energy عالية = **emphasis منخفض** → overlay فقط

### Step 5.3: احفظ النتيجة

احفظ في `src/data/content_analysis.json`

### Step 5.4: اعرض الملخص

```
Claude Code:
  🧠 تحليل المحتوى:
  ─────────────────────────
  📝 الموضوع: [summary قصير]
  📑 الأقسام: [X] أقسام
  ⭐ نقاط مفتاحية: [Y] (تحتاج أنيميشنز)
  🏷️ كلمات مفتاحية: [Z]
  🔍 لحظات تأكيد: [N]
  ─────────────────────────
  
  نبدأ Phase 6 (خطة الأنيميشنز)؟
```

### Step 5.5: Git Commit

```bash
git add .
git commit -m "v5: content analysis done - [Y] key moments"
```
