# Phase 2: Transcription (كابشنز)

> **ملاحظة:** الـ default workflow من دلوقتي عبر الـ Dashboard UI — شوف [`docs/dashboard-workflow.md`](dashboard-workflow.md). الملف ده بيوصف الـ CLI اللي بيشتغل خلف الـ Transcribe button في الـ Dashboard.

## Input
- `data/audio.wav` — أوديو 16kHz mono

## Output
- `data/subtitles_raw.srt` — الكابشنز الخام من Whisper
- `data/subtitles_processed.srt` — الكابشنز بعد تصحيح Claude Code
- `data/whisper_raw.json` — النتيجة الكاملة من Whisper (مع word-level timestamps)

## Success Criteria
- [ ] SRT file فيه subtitles بتوقيتات صحيحة
- [ ] كل سطر 5-7 كلمات
- [ ] الأرقام بالأرقام العربية (١٢٣) أو الإنجليزية حسب السياق
- [ ] مفيش أخطاء إملائية واضحة
- [ ] كل subtitle ليه start و end time
- [ ] مفيش subtitles متداخلة في التوقيت

---

## الخطوات

### Step 2.1: تشغيل WhisperX

أنشئ `scripts/transcribe.py`:

```python
import sys
import json

input_audio = sys.argv[1] if len(sys.argv) > 1 else "data/audio.wav"

print("🎤 Transcribing with WhisperX...")

try:
    import whisperx
    
    device = "cuda"  # RTX 5060 Ti
    compute_type = "float16"
    
    # تحميل الموديل
    model = whisperx.load_model("large-v3", device, compute_type=compute_type)
    
    # تحميل الأوديو
    audio = whisperx.load_audio(input_audio)
    
    # Transcription
    result = model.transcribe(audio, batch_size=16, language="ar")
    
    # Word-level alignment
    model_a, metadata = whisperx.load_align_model(language_code="ar", device=device)
    result = whisperx.align(result["segments"], model_a, metadata, audio, device=device)
    
    print(f"✅ WhisperX: {len(result['segments'])} segments")
    
except ImportError:
    import whisper
    
    print("⚠️ WhisperX not available, using Whisper...")
    model = whisper.load_model("large-v3")
    result = model.transcribe(
        input_audio,
        language="ar",
        word_timestamps=True,
        task="transcribe",
        initial_prompt="ده فيديو تعليمي باللهجة المصرية عن المحاسبة والمالية"
    )
    print(f"✅ Whisper: {len(result['segments'])} segments")

# حفظ JSON الكامل
with open("data/whisper_raw.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# حفظ SRT
def format_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

with open("data/subtitles_raw.srt", "w", encoding="utf-8") as f:
    for i, seg in enumerate(result["segments"], 1):
        start = format_time(seg["start"])
        end = format_time(seg["end"])
        text = seg["text"].strip()
        f.write(f"{i}\n{start} --> {end}\n{text}\n\n")

print(f"✅ Saved: data/subtitles_raw.srt ({len(result['segments'])} subtitles)")
```

**شغّله:**
```bash
python3 scripts/transcribe.py
```

### Step 2.2: تصحيح الكابشنز (أنت Claude Code)

**اقرأ `data/subtitles_raw.srt` وصححه بنفسك:**

1. **تصحيح إملائي:** "المحاسبه" → "المحاسبة"، "الماليه" → "المالية"
2. **تقسيم الأسطر:** كل سطر 5-7 كلمات. لو أكتر → قسّمه. لو أقل → دمجه مع اللي بعده.
3. **الأرقام:** اكتبها بالشكل المناسب للسياق
4. **الكلمات المش واضحة:** لو Whisper كتب كلام غريب ومش عارف الصح → اكتب `[unclear]`
5. **التوقيتات:** ما تغيرش التوقيتات — بس النص
6. **code-switching:** لو فيه كلمات إنجليزية (accounting terms مثلاً) → سيبها زي ما هي

**احفظ النتيجة في:** `data/subtitles_processed.srt`

### Step 2.3: عرض ملخص للمستخدم

```
Claude Code:
  🎤 Transcription Results:
  ─────────────────────────────
  Whisper output:    [X] subtitles
  After correction:  [Y] subtitles
  Corrections made:  [Z] (list the main ones)
  Unclear segments:  [N] (if any)
  ─────────────────────────────
  
  ⚠️ Segments marked [unclear]:
  #12  00:01:45  "[unclear]"
  #31  00:04:50  "[unclear]"
  
  الكابشنز جاهزة للمراجعة في الـ Subtitle Editor.
  نبدأ Phase 3 (بناء الـ Editor) ولا Phase 4 (مراجعة) لو الـ Editor جاهز؟
```

### Step 2.4: Git Commit

```bash
git add .
git commit -m "v2: transcription done - [X] subtitles"
```

---

## ⚠️ Error Recovery

| المشكلة | الحل |
|---------|------|
| WhisperX CUDA error | جرّب `device = "cpu"` (أبطأ بس بيشتغل) |
| WhisperX مش مثبت | بيعمل fallback لـ Whisper العادي أوتوماتيك |
| النتيجة فاضية | تأكد إن الأوديو فيه كلام: `ffplay data/audio.wav` |
| دقة منخفضة جداً | جرّب: `initial_prompt="محاسبة مالية ميزانية أصول خصوم"` |
| Alignment error (WhisperX) | شغّل بدون alignment — هيفضل شغال بس word timestamps أقل دقة |

---

## Whisper Models Reference

| الموديل | الأمر | متى تستخدمه |
|---------|-------|-------------|
| WhisperX large-v3 | `whisperx.load_model("large-v3")` | **الأول دايماً** |
| Whisper large-v3 عادي | `whisper.load_model("large-v3")` | لو WhisperX فشل |
| Fine-tuned مصري | `from transformers import ...` | لو الدقة مش كافية |

---

## بعد ما تخلص
الخطوة الجاية تعتمد على حالة الـ Subtitle Editor:
- **لو الـ Editor مش مبني بعد** → Phase 3 (بناء الـ Editor)
- **لو الـ Editor جاهز** → Phase 4 (مراجعة الكابشنز)
