# Scene Validation Rules

**اقرأ هذا الملف قبل اقتراح أي animation في Phase 6.**

---

## Full-Screen Explainer Scenes

### ✅ اقترح لو:
- المحاضر بيشرح مفهوم مجرد (مش بيشاور على حاجة مرئية)
- النقطة تقدر تتوضح بصرياً أحسن من الكلام
- فيه مقارنة أو عملية أو معادلة
- المحاضر مش بيعمل demo أو بيوري حاجة على الشاشة
- Audio energy عالية في النقطة دي

### ❌ لا تقترح لو:
- آخر Full-Screen Scene كانت من أقل من **45 ثانية**
- المدة أقل من **5 ثواني**
- المحتوى بسيط ومش محتاج توضيح بصري (overlay كافي)
- المحاضر بيشاور بإيده على حاجة مهمة في الكادر
- المحاضر بيعرض screen share أو document أو whiteboard
- المحاضر في نص حوار أو بيرد على سؤال

### الحدود:
- **المدة لكل scene:** 5-10 ثواني
- **Spacing (إجباري):** 45 ثانية على الأقل بين بداية كل scene والـ scene اللي بعدها. 60 ثانية مثالي.
- **Total count = content-driven.** مفيش cap ثابت على عدد الـ scenes في الفيديو. العدد بيطلع من:
  1. كل الـ high/medium importance key_moments في `content_analysis.json` اللي تقدر تعيش جنب بعض ضمن قاعدة الـ 45s spacing
  2. الـ upper bound العملي: الـ scenes ما تغطيش أكتر من ~50% من مدة الفيديو
- **أمثلة:** فيديو 3:30 → 3-5 scenes · 5 min → 4-7 · 10 min → 8-12 · 15 min → 12-18
- **transition:** fade 15 frames دخول / 12 frames خروج

---

## Overlays

### ✅ اقترح لو:
- كلمة مفتاحية بتتذكر لأول مرة → **keyword_highlight**
- رقم مهم أو إحصائية → **counter**
- نقطة مهمة المحاضر بيأكد عليها → **stamp**
- مصطلح محتاج underline → **underline**

### ❌ لا تقترح لو:
- في نفس وقت Full-Screen Scene
- في نفس وقت overlay تاني
- الكلمة اتذكرت قبل كده (overlay مرة واحدة بس لكل keyword)

### الحدود:
- **حد أقصى:** 1 كل 20 ثانية
- **المدة:** 3-5 ثواني
- **المكان:** أعلى الشاشة أو الجوانب — **لا تغطي وش المحاضر** (استخدم face_map.json)

---

## Smart Zoom

### ✅ اقترح لو:
- Face confidence > 0.5 في face_map.json
- Audio energy > threshold في audio_energy.json
- المحاضر بيأكد على نقطة (emphasis moment)

### ❌ لا تقترح لو:
- أثناء Full-Screen Scene
- آخر zoom من أقل من **30 ثانية**
- Face confidence < 0.5 (الوش مش واضح)
- المحاضر بيتحرك كتير (movement > 20% من الشاشة)

### الحدود:
- **حد أقصى:** 1 كل 30 ثانية
- **المدة:** 3-5 ثواني
- **Zoom level:** 1.3x - 1.5x (default 1.4)
- **Smoothing:** moving average 15 نقطة
- **Spring:** damping من design-system (default 18)

---

## Chapter Dividers

### اقترح لو:
- بداية قسم جديد في content_analysis.sections
- تغيير واضح في الموضوع

### الحدود:
- **المدة:** 2-3 ثواني
- **fade to dark + عنوان + fade back**

---

## ملخص القواعد

| النوع | الحد الأدنى بين عنصرين | المدة | المكان | Total count |
|-------|----------------------|-------|--------|-------------|
| Full-Screen Scene | 45 ثانية | 5-10s | full screen | content-driven (ما فيش cap) |
| Overlay | 20 ثانية | 3-5s | top / sides | content-driven |
| Smart Zoom | 30 ثانية | 3-5s | على الوش | content-driven |
| Chapter Divider | حسب الأقسام | 2-3s | full screen | = عدد sections |

**مهم:** كل العناصر دي بيتحكم فيها الـ spacing rule (الحد الأدنى بين عنصرين من نفس النوع)، مش cap ثابت على العدد الكلي. العدد الكلي بيطلع من الـ content analysis + الـ gaps المتاحة.
