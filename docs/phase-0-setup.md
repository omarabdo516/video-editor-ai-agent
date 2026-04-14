# Phase 0: إعداد المشروع

## Input
- لا شيء (مشروع جديد أو مشروع موجود بشغل سابق)

## Output
- مشروع Remotion جاهز مع Agent Skills
- Python environment مع Whisper + MediaPipe + librosa
- بنية المجلدات كاملة
- Git initialized

## Success Criteria
- [ ] `npx remotion studio` بيفتح بدون أخطاء
- [ ] `python -c "import whisperx; print('OK')"` بيطبع OK
- [ ] `python -c "import mediapipe; print('OK')"` بيطبع OK
- [ ] `python -c "import librosa; print('OK')"` بيطبع OK
- [ ] `ffmpeg -version` بيشتغل
- [ ] `git status` بيشتغل
- [ ] مجلد `brand/` فيه RS_BRAND.md واللوجوهات
- [ ] ملف `docs/design-system.md` موجود

---

## الخطوات

### Step 0.1: إنشاء مشروع Remotion

```bash
npx create-video@latest ai-video-editor
# اختر: Blank template
# اختر: Yes لـ TailwindCSS
# اختر: Yes لـ Install Skills

cd ai-video-editor
npm install
```

### Step 0.2: تثبيت Remotion Agent Skills

```bash
npx skills add remotion-dev/skills
```

**تأكد:** مجلد `.claude/skills/` فيه ملفات Remotion.

### Step 0.3: تثبيت Node packages إضافية

```bash
npm install @wavesurfer/react wavesurfer.js @remotion/player @remotion/captions zustand
```

### Step 0.4: تثبيت Python packages

```bash
pip install whisperx mediapipe opencv-python librosa numpy pysrt --break-system-packages
```

**لو WhisperX مش شغال** جرّب:
```bash
pip install openai-whisper --break-system-packages
```

### Step 0.5: إنشاء بنية المجلدات

```bash
mkdir -p brand/logo
mkdir -p feedback/best_components
mkdir -p templates
mkdir -p scripts
mkdir -p input
mkdir -p output
mkdir -p docs
mkdir -p subtitle-editor/src/{components,store,utils,types}
```

### Step 0.6: نسخ ملفات الخطة

تأكد إن الملفات دي موجودة:
- `CLAUDE.md` — في root المشروع
- `docs/` — كل ملفات الـ phases
- `brand/RS_BRAND.md` — هوية RS (المستخدم هيملأه)
- `brand/logo/` — اللوجوهات (المستخدم هيحطها)

### Step 0.7: إنشاء design-system.md

اقرأ `docs/design-system.md` وتأكد إنه موجود.
لو مش موجود — أنشئه من الـ template الموجود في الخطة.
لو `brand/RS_BRAND.md` موجود — حدّث الـ design system بألوان RS.

### Step 0.8: Git Init

```bash
git init
echo "node_modules/\n.next/\noutput/*.mp4\ndata/audio.wav" > .gitignore
git add .
git commit -m "v0: project setup"
```

### Step 0.9: تشغيل Remotion Studio

```bash
npm run dev
```

تأكد إنه بيفتح في المتصفح بدون أخطاء.

---

## Verification Script

```bash
#!/bin/bash
echo "=== Phase 0 Verification ==="

# Check Remotion
npx remotion --version && echo "✅ Remotion" || echo "❌ Remotion"

# Check FFmpeg
ffmpeg -version 2>/dev/null | head -1 && echo "✅ FFmpeg" || echo "❌ FFmpeg"

# Check Python deps
python3 -c "import whisperx; print('✅ WhisperX')" 2>/dev/null || \
python3 -c "import whisper; print('✅ Whisper (fallback)')" 2>/dev/null || \
echo "❌ Whisper"

python3 -c "import mediapipe; print('✅ MediaPipe')" 2>/dev/null || echo "❌ MediaPipe"
python3 -c "import librosa; print('✅ librosa')" 2>/dev/null || echo "❌ librosa"

# Check directories
[ -d "brand" ] && echo "✅ brand/" || echo "❌ brand/"
[ -d "feedback" ] && echo "✅ feedback/" || echo "❌ feedback/"
[ -d "docs" ] && echo "✅ docs/" || echo "❌ docs/"
[ -d "scripts" ] && echo "✅ scripts/" || echo "❌ scripts/"
[ -d ".git" ] && echo "✅ Git" || echo "❌ Git"

# Check skills
[ -d ".claude/skills" ] && echo "✅ Agent Skills" || echo "❌ Agent Skills"

echo "=== Done ==="
```

---

## بعد ما تخلص
قول للمستخدم: "Phase 0 خلصت ✅ — عايز نبدأ Phase 1 (Pre-Processing)؟"
