# Phase B: Batch Processing (Semi-Auto)

## متى تستخدم هذه المرحلة
لما المستخدم يقول "عندي X فيديوهات" أو "batch" أو "مجموعة فيديوهات"

## الفكرة
Phase 1+2 (Pre-Processing + Whisper) تشتغل على كل الفيديوهات دفعة واحدة.
بعدها المستخدم بيراجع وبيريندر واحد واحد.

---

## بنية المجلدات

```
batch-project/
├── CLAUDE.md
├── brand/
├── input/
│   ├── 01-video-name.mp4
│   ├── 02-video-name.mp4
│   └── ...
├── projects/
│   ├── 01/
│   │   ├── data/         (audio, face_map, energy, subtitles)
│   │   ├── src/          (components)
│   │   └── output/       (preview, final)
│   ├── 02/
│   └── ...
├── shared/               (design_system, components مشتركة)
├── feedback/
├── templates/
└── batch_status.json
```

## Workflow

### Phase B.1: Batch Pre-Processing (أوتوماتيك)

لكل فيديو في `input/`:
```bash
for video in input/*.mp4; do
  name=$(basename "$video" .mp4)
  mkdir -p "projects/$name/data"
  
  ffmpeg -i "$video" -vn -ar 16000 -ac 1 "projects/$name/data/audio.wav"
  python3 scripts/face_detect.py "$video" "projects/$name/data/face_map.json"
  python3 scripts/audio_energy.py "projects/$name/data/audio.wav" "projects/$name/data/audio_energy.json"
  python3 scripts/transcribe.py "projects/$name/data/audio.wav"
  # Claude Code يصحح الكابشنز
done
```

حدّث `batch_status.json` بعد كل فيديو.

### Phase B.2: واحد واحد

لكل فيديو بالترتيب → نفّذ Phase 4-9:
1. مراجعة كابشنز → approve
2. تحليل محتوى
3. خطة أنيميشنز → approve
4. Preview → approve
5. Full render
6. Feedback

**ملاحظات:**
- الـ `shared/` components مشتركة — تعديل في فيديو 1 بيأثر على الباقي
- `style_evolution` بيتحدث بعد كل فيديو
- لو المستخدم وقف → `batch_status.json` بيعرف فين وقف
- لما يرجع يقول "كمّل الـ batch" → اقرأ الـ status وكمّل

### batch_status.json

```json
{
  "total": 10,
  "template": "rs-accounting",
  "videos": [
    {"id": "01", "file": "01-name.mp4", "stage": "completed", "rating": 4.5},
    {"id": "02", "file": "02-name.mp4", "stage": "pre_processed", "rating": null},
    {"id": "03", "file": "03-name.mp4", "stage": "pending", "rating": null}
  ]
}
```

Stages: `pending → pre_processed → captions_approved → planned → rendered → completed`
