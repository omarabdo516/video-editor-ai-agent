# Round 5: Engagement

## الهدف
عناصر تفاعلية بتزود الـ engagement — notifications + CTA.

## المدة المتوقعة
45-60 دقيقة

## ⚠️ قبل ما تبدأ
- تأكد إن Round 4 خلصت و committed

---

### Feature 15: Notification Pop-ups

**المشكلة:** النقاط المهمة بتعدي بسرعة — المشاهد ممكن يفوّتها.

**الحل:** notification زي الموبايل — slide-down من فوق — فيه ملخص النقطة.

**التنفيذ:**

```tsx
// src/components/overlays/NotificationPopup.tsx

// الشكل:
// ┌─────────────────────────┐
// │ 💡 القاعدة الذهبية:      │
// │ الأصول = الخصوم + الملكية │
// └─────────────────────────┘

// الأنيميشن:
// - slide-down من فوق بـ spring (damping 18)
// - visible 2.5 ثانية
// - slide-up يختفي
// - المكان: top-center (تحت الـ progress bar)
// - الخلفية: brand colors مع border-radius
// - الخط: Cairo Bold
```

**القواعد:**
- حد أقصى 1 كل 45 ثانية
- النص مختصر (10 كلمات max)
- بيظهر لما المحاضر يقول قاعدة أو معادلة أو نقطة ملخّصة
- مش بيظهر أثناء Full-Screen Scene
- Claude Code بيقرر المحتوى في Phase 6

**في animation_plan.json:**

```json
{
  "notifications": [
    {
      "id": "notif_1",
      "time_sec": 45.0,
      "duration_sec": 3.0,
      "icon": "💡",
      "title": "القاعدة الذهبية",
      "body": "الأصول = الخصوم + حقوق الملكية"
    }
  ]
}
```

**الملفات المتأثرة:**
- `src/components/overlays/NotificationPopup.tsx` (جديد)
- `src/Reel.tsx` (إضافة notifications rendering)
- `src/types.ts` (إضافة Notification type)

**Success Criteria:**
- [ ] الـ notification بيظهر slide-down ناعم
- [ ] 3 ثواني visible ثم يختفي
- [ ] مش بيظهر أثناء scenes
- [ ] الخط والألوان من الـ brand
- [ ] `git commit -m "feat: notification pop-up overlays"`

---

### Feature 11: Auto-CTA Overlay

**المشكلة:** المشاهد بيتفرج بدون ما ياخد action — مفيش دعوة للتفاعل.

**الحل:** CTA overlay خفيف بعد نقاط مهمة.

**التنفيذ:**

```tsx
// src/components/overlays/CtaOverlay.tsx

// نصوص CTA متنوعة (Claude Code يختار المناسب):
// "تابعنا عشان تعرف أكتر 👆"
// "احفظ البوست ده 🔖"
// "شارك مع زميلك 📤"

// الأنيميشن:
// - slide-up من تحت (فوق الكابشنز)
// - 3 ثواني visible
// - fade-out
// - semi-transparent background
```

**القواعد:**
- حد أقصى 1 كل 30 ثانية
- يظهر بعد key_moment مهم (مش عشوائي)
- الأفضل في الثلث الأخير من الفيديو
- مش بيظهر مع notification أو scene
- Claude Code بيقرر في Phase 6

**في animation_plan.json:**

```json
{
  "cta_overlays": [
    {
      "id": "cta_1",
      "time_sec": 55.0,
      "duration_sec": 3.0,
      "text": "احفظ البوست ده 🔖",
      "reason": "بعد key_moment: معادلة الميزانية"
    }
  ]
}
```

**الملفات المتأثرة:**
- `src/components/overlays/CtaOverlay.tsx` (جديد)
- `src/Reel.tsx` (إضافة CTA rendering)
- `src/types.ts` (إضافة CtaOverlay type)

**Success Criteria:**
- [ ] CTA بيظهر في المكان الصح
- [ ] مش مزعج — خفيف وسريع
- [ ] بيختفي بعد 3 ثواني
- [ ] `git commit -m "feat: auto-CTA overlay component"`

---

## تأكيد نهائي

```
اعمل preview ورّيني:
1. notification popup عند نقطة مهمة
2. CTA overlay في الثلث الأخير
ورّيني "جاهز للجولة 6".
```
