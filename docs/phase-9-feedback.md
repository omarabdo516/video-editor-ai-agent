# Phase 9: التقييم + التطوير الذاتي

## Input
- الفيديو النهائي (المستخدم شافه)
- `src/data/animation_plan.json` — الخطة اللي اتنفذت

## Output
- `feedback/log.json` — تقييمات المشروع (يتضاف عليه)
- `feedback/style_evolution.md` — يتحدث
- `feedback/best_components/` — أفضل components يتحفظوا
- `docs/design-system.md` — يتحدث لو فيه تغيير
- Template (لو المستخدم طلب)

## ⚠️ هذه المرحلة إجبارية — لا تتخطاها أبداً!

---

## الخطوات

### Step 9.1: اسأل عن التقييم

```
Claude Code:
  📊 قيّم كل عنصر من 1-5:
  
  🖥️ Scene "تعريف الميزانية" (00:45):     [?/5] ملاحظة؟
  🖥️ Scene "معادلة الميزانية" (01:20):     [?/5] ملاحظة؟
  🔍 Smart Zoom (01:00):                   [?/5] ملاحظة؟
  🏷️ Keyword "الأصول الثابتة" (01:35):    [?/5] ملاحظة؟
  📝 Captions (Hormozi):                   [?/5] ملاحظة؟
  🎬 الفيديو ككل:                          [?/5] ملاحظة؟
```

### Step 9.2: سجّل في feedback/log.json

أضف entry جديدة للـ array (ما تمسحش القديم):

```json
{
  "project": "اسم المشروع",
  "date": "2026-XX-XX",
  "template_used": "rs-accounting أو null",
  "overall_rating": 4.5,
  "feedback": [
    {
      "element_type": "full_screen_scene",
      "element_name": "تعريف الميزانية",
      "timestamp": "00:00:45",
      "rating": 5,
      "note": "ملاحظة المستخدم",
      "action_taken": "ايه اللي اتعمل بناءً على الملاحظة"
    }
  ]
}
```

### Step 9.3: حدّث feedback/style_evolution.md

أضف/عدّل في الأقسام:
- **✅ حاجات بيحبها** — عناصر خدت 4-5
- **❌ حاجات مش بيحبها** — عناصر خدت 1-2
- **📐 القيم المعدّلة** — لو غيرت قيمة
- **🏆 أفضل مشاريع** — رتّبهم بالتقييم

### Step 9.4: احفظ أفضل Components

لو عنصر خد **5/5** → انسخ الـ component:
```bash
cp src/components/animations/scenes/DefinitionScene.tsx feedback/best_components/definition-scene-v1.tsx
```

### Step 9.5: حدّث Design System (لو لزم)

لو المستخدم قال "الخط كبير" أو "الزووم بطيء" → عدّل القيمة في `docs/design-system.md`

### Step 9.6: حفظ Template (لو المستخدم طلب)

```
Claude Code:
  عايز أحفظ الستايل ده كـ template؟ اكتب الاسم.
```

لو قال أيوه:
```bash
mkdir -p templates/[name]
cp docs/design-system.md templates/[name]/
cp src/data/animation_plan.json templates/[name]/template.config.json
cp -r src/components/ templates/[name]/components/
```

### Step 9.7: اقتراح Variation (كل 3 مشاريع)

لو ده المشروع الـ 3+:
```
Claude Code:
  💡 عايز تجرّب ستايل جديد لعنصر واحد في المرة الجاية؟
  مثلاً: Keyword Highlight بـ underline animated بدل glow
```

لو وافق → سجّل في `feedback/experiments.json`

### Step 9.8: Git Commit

```bash
git add .
git commit -m "v9: feedback recorded - [X]/5 overall"
```

---

## بعد ما تخلص
```
Claude Code:
  ✅ المشروع خلص!
  📊 التقييم: [X]/5
  💾 Template: [محفوظ/لا]
  
  عايز تبدأ فيديو جديد؟
```
