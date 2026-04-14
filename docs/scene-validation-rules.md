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
- آخر Full-Screen Scene كانت من أقل من **15 ثانية**
- المدة أقل من **5 ثواني**
- المحتوى بسيط ومش محتاج توضيح بصري (overlay كافي)
- المحاضر بيشاور بإيده على حاجة مهمة في الكادر
- المحاضر بيعرض screen share أو document أو whiteboard
- المحاضر في نص حوار أو بيرد على سؤال

### الحدود:
- **المدة لكل scene:** 5-8 ثواني (أقصر في الـ reels القصيرة)
- **Spacing (إجباري):** **15 ثانية** على الأقل بين بداية كل scene والـ scene اللي بعدها.
  - السبب: معظم الريلز 60-90 ثانية، وفي المدة دي لازم يحصل scenes متعددة عشان نكسر الملل.
  - الـ rule القديم (45s) كان مناسب للفيديوهات الطويلة، لكن Omar صحّحه: "45s دا كتير أوي... عايزها 15 ثانية عشان نكسر الملل".
- **Total count = content-driven.** مفيش cap ثابت على عدد الـ scenes. العدد بيطلع من:
  1. كل الـ high/medium importance key_moments في `content_analysis.json` اللي تحترم الـ 15s spacing
  2. الـ upper bound العملي: الـ scenes ما تغطيش أكتر من ~60% من مدة الفيديو (عشان المحاضر يفضل ظاهر كمان)
- **أمثلة:**
  - 60s reel → 3-4 scenes (عادي)
  - 90s reel → 5-6 scenes
  - 2 min → 7-8 scenes
  - 3:30 → 10-13 scenes (لو المحتوى بيستحق)
  - 5 min → 15+ scenes
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
| Full-Screen Scene | **15 ثانية** | 5-8s | full screen | content-driven (ما فيش cap) |
| Overlay | 20 ثانية | 3-5s | top / sides | content-driven |
| Smart Zoom | 30 ثانية | 3-5s | على الوش | content-driven |
| Chapter Divider | حسب الأقسام | 2-3s | full screen | = عدد sections |

**مهم:** كل العناصر دي بيتحكم فيها الـ spacing rule (الحد الأدنى بين عنصرين من نفس النوع)، مش cap ثابت على العدد الكلي. العدد الكلي بيطلع من الـ content analysis + الـ gaps المتاحة.

**ملاحظة على الـ Smart Zoom vs Scene:** الـ smart zoom spacing لسه 30s لأنه transform subtle على الوش — لو بيحصل كل 15s ممكن يحس الـ viewer بـ dizziness. الـ scene مختلف — كل scene محتوى بصري مختلف، فـ 15s spacing مناسب.
