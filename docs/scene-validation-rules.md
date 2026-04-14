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
- **حد أقصى:** 1 كل 60 ثانية (مثالي) / 1 كل 45 ثانية (minimum)
- **المدة:** 5-10 ثواني
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

| النوع | الحد الأدنى بين عنصرين | المدة | المكان |
|-------|----------------------|-------|--------|
| Full-Screen Scene | 45 ثانية | 5-10s | full screen |
| Overlay | 20 ثانية | 3-5s | top / sides |
| Smart Zoom | 30 ثانية | 3-5s | على الوش |
| Chapter Divider | حسب الأقسام | 2-3s | full screen |
