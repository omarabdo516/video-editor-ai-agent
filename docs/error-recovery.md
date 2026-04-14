# Error Recovery

## Phase 1: Pre-Processing

| المشكلة | الحل |
|---------|------|
| FFmpeg مش لاقي الفيديو | تأكد: `ls input/video.mp4` |
| FFmpeg format error | جرّب: `ffmpeg -i input/video.mp4 -vn -ar 16000 -ac 1 -f wav data/audio.wav` |
| MediaPipe import error | `pip install mediapipe --break-system-packages --force-reinstall` |
| MediaPipe لا وش في >50% | الفيديو screen recording — Smart Zoom هيتعطل (عادي) |
| librosa error | تأكد: `pip install librosa numpy` + الأوديو سليم |

## Phase 2: Transcription

| المشكلة | الحل |
|---------|------|
| WhisperX CUDA error | `device = "cpu"` (أبطأ بس بيشتغل) |
| WhisperX مش مثبت | بيعمل fallback لـ Whisper العادي |
| نتيجة فاضية | تأكد إن الأوديو فيه كلام: `ffplay data/audio.wav` |
| دقة منخفضة جداً | أضف initial_prompt بمصطلحات الفيديو |
| Alignment error | شغّل بدون alignment (word timestamps أقل دقة) |
| Hallucination (نص متكرر) | استخدم WhisperX بدل Whisper (VAD بيمنع ده) |

## Phase 3: Subtitle Editor

| المشكلة | الحل |
|---------|------|
| npm run dev فشل | `rm -rf node_modules && npm install` |
| Waveform مش ظاهر | تأكد إن audio URL صح + الملف محمّل |
| Regions مش بتسحب | `drag: true, resize: true` في region options |
| الفيديو والـ waveform مش متزامنين | `ontimeupdate` + `seekTo()` في الاتجاهين |
| RTL مش شغال | `dir="rtl"` + `font-family: 'Cairo'` |
| shadcn/ui error | `npx shadcn@latest init` من جديد |

## Phase 7: Remotion Components

| المشكلة | الحل |
|---------|------|
| Composition not found | تأكد إن `<Composition id="MainVideo">` في `Root.tsx` |
| Video file not found | استخدم `staticFile('video.mp4')` + الملف في `public/` |
| Font not loading | `@import url('https://fonts.googleapis.com/css2?family=Cairo')` |
| Animation timing غلط | FPS في الـ composition لازم = FPS الفيديو الأصلي |
| RTL text reversed | `direction: 'rtl'` + `textAlign: 'right'` |

## Phase 8: Render

| المشكلة | الحل |
|---------|------|
| Out of memory | `--concurrency=2` أو `--scale=0.5` |
| Render crashed | اقرأ الـ error → صلّح → أعد |
| Audio out of sync | تأكد إن `durationInFrames` = مدة الفيديو × fps |
| Output too large | ارفع CRF: `--crf=23` (أصغر بس أقل جودة) |
| Black frames | تأكد إن `<OffthreadVideo>` src صح |

## عام

| المشكلة | الحل |
|---------|------|
| Claude Code lost context | ارجع للـ CLAUDE.md — فيه كل القواعد |
| مش عارف أبدأ منين | اقرأ الـ phase file المطلوب |
| النتيجة مش زي المتوقع | Preview أولاً (30 ثانية) قبل full render |
| عايز أرجع لنسخة قديمة | `git log` → `git checkout vX` |
