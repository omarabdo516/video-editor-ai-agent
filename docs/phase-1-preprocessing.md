# Phase 1: Pre-Processing

> **ملاحظة:** الـ default workflow من دلوقتي عبر الـ Dashboard UI — شوف [`docs/dashboard-workflow.md`](dashboard-workflow.md). الملف ده بيوصف الـ CLI اللي بيشتغل خلف الـ Phase 1 button في الـ Dashboard (ونفسه لسه متاح كـ `node rs-reels.mjs phase1 <video>` للـ debugging).

## Input
- `input/video.mp4` — فيديو MP4 (متشال منه الفراغات)

## Output
- `data/audio.wav` — أوديو 16kHz mono
- `data/video_metadata.json` — أبعاد + مدة + fps
- `src/data/face_map.json` — إحداثيات وش المحاضر كل 5 فريمات
- `src/data/audio_energy.json` — لحظات الحماس والتأكيد

## Success Criteria
- [ ] `data/audio.wav` موجود وحجمه > 0
- [ ] `data/video_metadata.json` فيه duration و width و height و fps
- [ ] `src/data/face_map.json` فيه array من الإحداثيات + face_center_x/y لكل sample
- [ ] `src/data/audio_energy.json` فيه emphasis_moments array
- [ ] كل الملفات valid JSON (مش فاضية أو مكسورة)

---

## الخطوات

### Step 1.1: استخراج الأوديو + معلومات الفيديو

```bash
# أوديو
ffmpeg -i input/video.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 data/audio.wav

# معلومات الفيديو
ffprobe -v quiet -print_format json -show_format -show_streams input/video.mp4 > data/video_metadata.json
```

**Verify:**
```bash
[ -f "data/audio.wav" ] && echo "✅ audio.wav" || echo "❌ audio.wav"
python3 -c "import json; d=json.load(open('data/video_metadata.json')); print(f'✅ Duration: {d[\"format\"][\"duration\"]}s')"
```

### Step 1.2: Face Detection (MediaPipe)

أنشئ ملف `scripts/face_detect.py`:

```python
import cv2
import mediapipe as mp
import json
import sys

input_video = sys.argv[1] if len(sys.argv) > 1 else "input/video.mp4"
output_file = sys.argv[2] if len(sys.argv) > 2 else "src/data/face_map.json"

mp_face = mp.solutions.face_detection
video = cv2.VideoCapture(input_video)
fps = video.get(cv2.CAP_PROP_FPS)
width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))
total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))

SAMPLE_INTERVAL = 5  # كل 5 فريمات
face_data = []
no_face_count = 0

print(f"🔍 Face Detection: {total_frames} frames, sampling every {SAMPLE_INTERVAL}")

with mp_face.FaceDetection(model_selection=1, min_detection_confidence=0.7) as detector:
    frame_num = 0
    while True:
        ret, frame = video.read()
        if not ret:
            break
        
        if frame_num % SAMPLE_INTERVAL == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = detector.process(rgb)
            
            if results.detections:
                # لو فيه أكتر من وش → ناخد الأكبر (الأقرب)
                face = max(results.detections, 
                          key=lambda d: d.location_data.relative_bounding_box.width * 
                                       d.location_data.relative_bounding_box.height)
                bbox = face.location_data.relative_bounding_box
                nose = face.location_data.relative_keypoints[2]  # NOSE_TIP
                
                face_data.append({
                    "frame": frame_num,
                    "time": round(frame_num / fps, 3),
                    "face_center_x": round(nose.x, 4),
                    "face_center_y": round(nose.y, 4),
                    "face_width": round(bbox.width, 4),
                    "face_height": round(bbox.height, 4),
                    "confidence": round(face.score[0], 3)
                })
            else:
                no_face_count += 1
                face_data.append({
                    "frame": frame_num,
                    "time": round(frame_num / fps, 3),
                    "face_center_x": 0.5,
                    "face_center_y": 0.4,
                    "face_width": 0,
                    "face_height": 0,
                    "confidence": 0
                })
            
            # Progress
            if frame_num % (SAMPLE_INTERVAL * 100) == 0:
                pct = round(frame_num / total_frames * 100)
                print(f"  {pct}% ({frame_num}/{total_frames})")
        
        frame_num += 1

video.release()

output = {
    "video_fps": fps,
    "video_width": width,
    "video_height": height,
    "total_frames": frame_num,
    "sample_interval": SAMPLE_INTERVAL,
    "total_samples": len(face_data),
    "no_face_samples": no_face_count,
    "no_face_percentage": round(no_face_count / len(face_data) * 100, 1) if face_data else 0,
    "faces": face_data
}

with open(output_file, "w") as f:
    json.dump(output, f, indent=2)

print(f"✅ Face detection done: {len(face_data)} samples, {no_face_count} without face ({output['no_face_percentage']}%)")

# ⚠️ تحذير لو نسبة عدم اكتشاف الوش عالية
if output['no_face_percentage'] > 30:
    print(f"⚠️ Warning: {output['no_face_percentage']}% of frames have no detected face!")
    print("   Smart Zoom ممكن ميشتغلش كويس. تأكد إن المحاضر ظاهر في الفيديو.")
```

**شغّله:**
```bash
python3 scripts/face_detect.py
```

**Verify:**
```bash
python3 -c "
import json
d = json.load(open('src/data/face_map.json'))
print(f'✅ Samples: {d[\"total_samples\"]}')
print(f'   No-face: {d[\"no_face_percentage\"]}%')
print(f'   FPS: {d[\"video_fps\"]}')
print(f'   Resolution: {d[\"video_width\"]}x{d[\"video_height\"]}')
"
```

### Step 1.3: Audio Energy Detection (librosa)

أنشئ ملف `scripts/audio_energy.py`:

```python
import librosa
import numpy as np
import json
import sys

input_audio = sys.argv[1] if len(sys.argv) > 1 else "data/audio.wav"
output_file = sys.argv[2] if len(sys.argv) > 2 else "src/data/audio_energy.json"

print("🎵 Audio Energy Analysis...")

# تحميل الأوديو
y, sr = librosa.load(input_audio, sr=16000)
duration = librosa.get_duration(y=y, sr=sr)
print(f"  Duration: {duration:.1f}s")

# حساب طاقة الصوت (RMS)
hop_length = 512
rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
times = librosa.times_like(rms, sr=sr, hop_length=hop_length)

# حساب الحدود
mean_energy = float(np.mean(rms))
std_energy = float(np.std(rms))
high_threshold = mean_energy + (1.5 * std_energy)
low_threshold = mean_energy * 0.3

# تحديد لحظات الحماس
emphasis_moments = []

for i in range(1, len(rms)):
    t = float(times[i])
    energy = float(rms[i])
    
    # طاقة عالية
    if energy > high_threshold:
        emphasis_moments.append({
            "time": round(t, 3),
            "energy": round(energy, 4),
            "type": "high_energy"
        })
    
    # Dramatic pause: سكوت مفاجئ يتبعه طاقة عالية
    if i < len(rms) - 10:
        if rms[i] < low_threshold and any(rms[i+j] > high_threshold for j in range(3, 10)):
            emphasis_moments.append({
                "time": round(t, 3),
                "energy": round(float(max(rms[i+3:i+10])), 4),
                "type": "dramatic_pause"
            })

# تنظيف: إزالة النقاط القريبة جداً من بعض (أقل من 2 ثانية)
cleaned = []
for m in emphasis_moments:
    if not cleaned or m["time"] - cleaned[-1]["time"] > 2.0:
        cleaned.append(m)

output = {
    "duration": round(duration, 2),
    "mean_energy": round(mean_energy, 6),
    "std_energy": round(std_energy, 6),
    "high_threshold": round(high_threshold, 6),
    "total_emphasis_points": len(cleaned),
    "emphasis_moments": cleaned
}

with open(output_file, "w") as f:
    json.dump(output, f, indent=2)

print(f"✅ Audio analysis done: {len(cleaned)} emphasis moments found")
print(f"   Mean energy: {mean_energy:.4f}")
print(f"   High threshold: {high_threshold:.4f}")

if len(cleaned) == 0:
    print("⚠️ Warning: لا توجد لحظات emphasis — المحاضر ممكن يكون هادي")
    print("   هنعتمد على النص فقط لتحديد لحظات الزووم")
```

**شغّله:**
```bash
python3 scripts/audio_energy.py
```

**Verify:**
```bash
python3 -c "
import json
d = json.load(open('src/data/audio_energy.json'))
print(f'✅ Emphasis moments: {d[\"total_emphasis_points\"]}')
print(f'   Duration: {d[\"duration\"]}s')
"
```

### Step 1.4: Health Check

```bash
echo "=== Phase 1 Health Check ==="
[ -f "data/audio.wav" ] && echo "✅ audio.wav" || echo "❌ audio.wav"
[ -f "data/video_metadata.json" ] && echo "✅ video_metadata.json" || echo "❌ video_metadata.json"
[ -f "src/data/face_map.json" ] && echo "✅ face_map.json" || echo "❌ face_map.json"
[ -f "src/data/audio_energy.json" ] && echo "✅ audio_energy.json" || echo "❌ audio_energy.json"

python3 -c "
import json, os
errors = []
for f in ['data/video_metadata.json', 'src/data/face_map.json', 'src/data/audio_energy.json']:
    try:
        d = json.load(open(f))
        if not d: errors.append(f'{f} is empty')
    except: errors.append(f'{f} is invalid JSON')
if errors:
    for e in errors: print(f'❌ {e}')
else:
    print('✅ All JSON files valid')
"
echo "=== Done ==="
```

### Step 1.5: Git Commit

```bash
git add .
git commit -m "v1: pre-processing done (audio + face_map + energy)"
```

---

## ⚠️ Error Recovery

| المشكلة | الحل |
|---------|------|
| FFmpeg مش لاقي الفيديو | تأكد إن المسار صح: `input/video.mp4` |
| MediaPipe مش لاقي وش في >50% | الفيديو ممكن يكون screen recording — Smart Zoom هيتعطل وده عادي |
| librosa error | تأكد إن audio.wav موجود وصحيح. جرّب: `ffmpeg -i data/audio.wav -f null -` |
| JSON file فاضي | أعد تشغيل الـ script المعني |

---

## بعد ما تخلص
```
Claude Code:
  ✅ Phase 1 done:
  - audio.wav: [size] MB
  - face_map: [X] samples, [Y]% no-face
  - audio_energy: [Z] emphasis moments
  
  نبدأ Phase 2 (Transcription)؟
```
