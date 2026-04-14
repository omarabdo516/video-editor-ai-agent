# RS Reels — Manual Setup Checklist

> **هتعمل الخطوات دي مرة واحدة بس.** بعدها الـ workflow كله بيشتغل من Claude مباشرة.

بعد ما Claude خلّص الـ installation الأوتوماتيكي، في **6 حاجات يدوية** محتاج تعملها بنفسك.

---

## ✅ 1. Install Bridge Script في After Effects

الـ MCP عندنا محتاج ScriptUI panel صغير يتنصّب جوا فولدر AE. محتاج صلاحيات Administrator.

**افتح PowerShell كـ Administrator** وشغّل:

```powershell
cd "C:\Users\PUZZLE\Documents\Claude\_tools\after-effects-mcp"
npm run install-bridge
```

هيفتحلك UAC prompt — اقبل. هينسخ ملف `mcp-bridge-auto.jsx` لفولدر:

```
C:\Program Files\Adobe\Adobe After Effects 2025\Support Files\Scripts\ScriptUI Panels\
```

**تأكيد النجاح**: تشوف رسالة `Bridge script installed successfully!`

---

## ✅ 2. تفعيل Scripting Permissions في AE

افتح After Effects → `Edit → Preferences → Scripting & Expressions`

فعّل الاختيارين دول:
- ☑️ **Allow Scripts to Write Files and Access Network**
- ☑️ **Enable JavaScript Debugger** (اختياري، بيساعد في debugging)

اضغط OK.

---

## ✅ 3. تفعيل Middle Eastern Text Engine (مهم جداً للعربي)

في AE برضو: `Edit → Preferences → Type`

غيّر **Paragraph Style** من `English/Latin` إلى **`South Asian and Middle Eastern`**

اضغط OK → **اقفل AE وافتحه تاني** (ضروري عشان التغيير يتفعّل).

**لو نسيت دي**: الحروف العربي هتطلع مش متوصلة ببعض (شكل مكسور).

---

## ✅ 4. تنصيب فونتات Cairo + Tajawal

- روح [Google Fonts → Cairo](https://fonts.google.com/specimen/Cairo) → Download Family
- روح [Google Fonts → Tajawal](https://fonts.google.com/specimen/Tajawal) → Download Family
- فك الـ zip → مرر كل الـ `.ttf` files → right-click → **Install for all users**
- **اقفل AE** قبل ما تنصّب الفونتات، وافتحه بعد التنصيب (AE بيعمل cache للفونتات عند الفتح)

---

## ✅ 5. تنصيب FFmpeg (اختياري لكن مفيد)

للـ subtitle burn-in السريع بدون AE، أو للـ audio extraction:

1. نزّل من [gyan.dev FFmpeg builds](https://www.gyan.dev/ffmpeg/builds/) → **release full build**
2. فك الـ zip في `C:\ffmpeg\`
3. ضيف `C:\ffmpeg\bin` للـ PATH:
   - `Win + R` → `sysdm.cpl` → Advanced → Environment Variables
   - System variables → Path → Edit → New → `C:\ffmpeg\bin`
4. افتح terminal جديد وجرّب: `ffmpeg -version`

---

## ✅ 6. افتح الـ Bridge Panel في AE

كل مرة هتستخدم الـ workflow، لازم الـ panel ده يكون مفتوح في AE:

`Window → mcp-bridge-auto.jsx`

هيظهر panel صغير. فعّل الاختيار: **"Auto-run commands"** — خلّيه مفتوح طول ما بتشتغل.

---

## 🧪 Smoke Test

بعد ما خلّصت كل الخطوات دي:

1. افتح AE + افتح الـ bridge panel + فعّل Auto-run
2. ارجع Claude Code واعمل restart للـ session (عشان يقرأ `.mcp.json` الجديد)
3. قول لـ Claude:
   > "تأكد إن الـ after-effects MCP شغال — جيب list الـ compositions في المشروع الحالي"

لو اتجاوبت بـ list فاضي أو فيه comps، يبقى كله تمام.

**لو فشل**: اتأكد إن:
- الـ bridge panel مفتوح في AE وAuto-run مفعّل
- Claude Code اتعمله restart
- مفيش error في الـ MCP server (شوف الـ terminal اللي فتح الـ node server)

---

## 🎬 أول فيديو تجريبي

اتبع [README.md](./README.md) في نفس الفولدر — فيه workflow كامل خطوة بخطوة.

أو اسأل Claude مباشرة:
> "اعمل RS Reels من الفيديو `C:/videos/test.mp4` والـ SRT `C:/videos/test.srt` — المحاضر محمد رايان، الورشة المحاسب الشامل"

Claude هيستخدم الـ `/rs-reels` skill ويشتغل.

---

## خلاصة الخطوات

| # | الخطوة | المدة | احتياج Admin |
|---|--------|------|--------------|
| 1 | Install Bridge Script | 30 ثانية | ✅ |
| 2 | AE Scripting Permissions | 1 دقيقة | ❌ |
| 3 | Middle Eastern Text Engine | 1 دقيقة + restart AE | ❌ |
| 4 | Cairo + Tajawal fonts | 3 دقائق | ✅ |
| 5 | FFmpeg (optional) | 5 دقائق | ✅ |
| 6 | Open bridge panel في AE | 10 ثواني | ❌ |

**إجمالي**: ~10 دقائق، مرة واحدة بس.
