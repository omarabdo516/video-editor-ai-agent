# Phase 9: التقييم + التطوير الذاتي

> **آخر تحديث:** 2026-04-14 — اتحدّث ليطابق الـ in-context implementation الفعلي.

## Input

- الفيديو النهائي (المستخدم شافه)
- [`src/data/<basename>/animation_plan.json`](../src/data/) — الخطة اللي اتنفذت
- Memory files في `~/.claude/projects/.../memory/` — user-level preferences
- [`feedback/log.json`](../feedback/log.json) — repo-level history
- [`feedback/style_evolution.md`](../feedback/style_evolution.md) — repo-level learnings

## Output

- [`feedback/log.json`](../feedback/log.json) — entry جديد للـ projects array (ما يمحيش القديم)
- [`feedback/style_evolution.md`](../feedback/style_evolution.md) — entries جديدة حسب الأقسام
- `feedback/best_components/` — كوبي من الـ components اللي خدت 5/5 (اختياري)
- Memory files — تحديثات user-level للـ patterns اللي اتأكدت
- [`src/tokens.ts`](../src/tokens.ts) — تحديثات على قيم (لو الـ user قال يغير حاجة)
- `templates/<name>/` — template مستقل (اختياري — لو الـ user طلب)

## ⚠️ Phase دي إجبارية — لا تتخطاها بعد أي full render!

---

## 🧠 Implementation: In-Context مش Script

**Phase 9 مش script أو CLI.** هي workflow Claude Code بيشغله في الـ conversation مع الـ user. الأسباب:

1. الـ feedback بيتكون من قرارات نوعية (مش عدد rating بسيط)
2. الـ actions المطلوبة بتعتمد على السياق (تعديل component، تحديث token، حفظ memory)
3. الـ memory system (user-level) مع الـ feedback files (repo-level) محتاج Claude يوزّع الـ learning بينهم

الـ spec القديم كان فيه "اسأل عن rating من 1-5 لكل عنصر" بس ده مش عملي في الواقع — الـ user غالباً بيدي feedback نوعي ("مش عاجبني")، مش أرقام.

---

## الخطوات

### Step 9.1: اجمع الـ feedback من الـ conversation

لا تطلب rating لكل عنصر صراحة إلا لو الـ user طلب. بدل كده:
- راقب الـ reactions في الـ conversation (إعجاب / رفض / سؤال / تعديل)
- كل مرة الـ user بيقول "لا" أو "بس" أو "عدل" → ده feedback تقييم منخفض
- كل مرة الـ user بيقول "تمام" أو "حلو" أو "خلاص كويس" → ده feedback تقييم عالي
- كل مرة الـ user بيدي توجيه محدد ("خلي X بدل Y") → ده preference دائم

### Step 9.2: صنّف الـ feedback

لكل feedback point، قرر:

| الصنف | المكان | الأثر |
|-------|--------|------|
| **User preference دائم** (طريقة شغل / تفضيل style ثابت) | Memory: `feedback_*.md` (user-level) | يتطبق في كل الـ sessions الجاية |
| **Project-specific learning** (فيديو محدد / scene محددة) | `feedback/log.json` entry | historical record |
| **Brand rule** (قاعدة إجبارية تعكس الـ brand) | `brands/<client>/BRAND.md` | highest priority في الـ decision making |
| **Design system value** (رقم يتغير) | `src/tokens.ts` + `docs/design-system.md` | runtime behavior |
| **Pattern validated** (أسلوب اتأكد يشتغل) | `feedback/style_evolution.md` "حاجات بيحبها" | repo-level reference |
| **Pattern rejected** (أسلوب اتأكد إنه فاشل) | `feedback/style_evolution.md` "حاجات مش بيحبها" | repo-level reference |

الـ user-level memory + الـ repo-level style_evolution هما **مختلفين**:
- **Memory** بيتقرا في كل الـ sessions (حتى لو repos تانية) — للـ meta-patterns اللي بتشتغل مع الـ user ده
- **style_evolution** بيتقرا في الـ repo ده بس — للـ learnings الخاصة بالـ brand/project

### Step 9.3: سجّل في `feedback/log.json`

أضف entry جديدة للـ `projects` array. الـ schema:

```json
{
  "project": "اسم الفيديو",
  "date": "YYYY-MM-DD",
  "template_used": null,
  "brand": "rs",
  "video_duration_sec": 209.173,
  "pipeline": { "phase_1": "done", ... },
  "counts": {
    "scenes": 4,
    "smart_zooms": 4,
    "big_overlays": 5,
    "micro_events": 30,
    "total_events": 43,
    "cadence_sec": 4.86
  },
  "output_files": ["path/to/final.mp4"],
  "overall_rating": 4,
  "overall_note": "ملاحظة عامة من الـ user",
  "feedback": [
    {
      "element_type": "scene_stepper",
      "element_name": "وصف قصير",
      "timestamp": "00:27.30",
      "rating": 2,
      "note": "اللي الـ user قاله",
      "action_taken": "اللي Claude عمله بناءً على الـ feedback"
    }
  ]
}
```

**المهم:** `action_taken` هو الـ field الأهم — بيخلي الـ entry قابلة للمراجعة بعد شهر. لو المشكلة اتحلت في الـ session، لازم يكون واضح.

### Step 9.4: حدّث `feedback/style_evolution.md`

الأقسام:
- **✅ حاجات بيحبها** — عناصر خدت 4-5 أو أسلوب اتأكد
- **❌ حاجات مش بيحبها** — عناصر خدت 1-2 أو أسلوب اتأكد إنه فاشل
- **📐 القيم المعدّلة** — أي token اتغير
- **🏆 أفضل مشاريع** — مرتبة بالتقييم
- **🧪 Experiments للمرة الجاية** — variations الـ user وافق يجربها

كل entry: **اسم** + **السبب** (quote من الـ user أو شرح) + **المصدر** (اسم المشروع + التاريخ).

### Step 9.5: احفظ Memory لأي user preference

لو الـ feedback بيعكس preference دائم (مش project-specific):
1. اكتب memory file في `~/.claude/projects/<repo-key>/memory/feedback_<topic>.md`
2. أضف pointer في `MEMORY.md`

الـ schema:
```markdown
---
name: <short name>
description: <one-line>
type: feedback
---

<rule>

**Why:** <reason — often a direct quote + incident>

**How to apply:** <concrete guidance>
```

### Step 9.6: حدّث Design System لو لزم

لو الـ user قال "الخط كبير" أو "الزووم بطيء":
1. عدّل [`src/tokens.ts`](../src/tokens.ts)
2. حدّث [`docs/design-system.md`](design-system.md) + أضف سطر شرح للتغيير
3. ذكر التغيير في `feedback/style_evolution.md` → "📐 القيم المعدّلة"

### Step 9.7: احفظ أفضل Components

لو component خد 5/5:
```bash
cp src/components/scenes/ProcessStepperScene.tsx \
   feedback/best_components/process-stepper-v1.tsx
```

الـ components في `feedback/best_components/` بتتقرا في بداية Phase 7 في الـ sessions الجاية كـ reference.

### Step 9.8: اقترح Variation (كل 3 مشاريع)

لو ده المشروع الـ 3+:
```
💡 عايز تجرّب ستايل جديد لعنصر واحد في المرة الجاية؟
مثلاً: Caption style Karaoke بدل Hormozi
```

لو وافق → سجّل في `feedback/experiments.json` (ملف ممكن يتعمل لو مش موجود).

### Step 9.9: Git Commit

```bash
git add CLAUDE.md brands/ docs/ feedback/ src/data/ src/ scripts/ rs-reels.mjs
git commit -m "Phase 9: feedback loop — <project_name> (<overall_rating>/5)"
```

---

## بعد ما تخلص

```
✅ Phase 9 خلصت
📊 Rating: <X>/5
💾 Memory: <N> files updated
📝 style_evolution: <M> entries added

عايز تبدأ فيديو جديد، ولا نكمل polish على الفيديو الحالي؟
```

---

## مثال حقيقي من session 2026-04-14

فيديو: "محمد ريان - ورشة الشامل"
- **Overall rating:** 4/5
- **Feedback entries:** 8 (WordPop rejection, scene centering, logo visibility, overlay position, retention rhythm, etc.)
- **Memory files added:** 7 (`feedback_review_via_render`, `feedback_logo_visible_in_scenes`, `feedback_scene_layout`, `feedback_overlay_position`, `feedback_safe_zones`, `feedback_inline_emphasis_pattern`)
- **style_evolution entries added:** 8 ✅ + 5 ❌ + 4 📐 (values changed)
- **Design tokens updated:** `tokens.overlays.defaultY` 280 → 1140, `tokens.scenes.*` new block, `tokens.overlays.*` new block, `tokens.springs.*` new block
- **Brand spec updated:** `brands/rs/BRAND.md` — logo visible during scenes rule
- **Best components saved:** (لسه لم يتقرر — سننتظر iteration الجاية)

الـ entry ده في `feedback/log.json` محفوظ بالكامل. الـ next session هيقرا الـ memory + style_evolution الأول قبل أي شغل.
