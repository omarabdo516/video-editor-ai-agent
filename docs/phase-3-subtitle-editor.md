# Phase 3: Subtitle Editor UI

## Input
- لا شيء (بناء الأداة من الصفر)

## Output
- تطبيق Vite + React شغال على `localhost:5173`
- بيقرأ SRT file + video file
- بيسمح بتعديل النص والتوقيتات
- بيعمل export لـ JSON و SRT
- زر Approve بيحفظ الملف النهائي

## Success Criteria
- [ ] `npm run dev` بيفتح بدون أخطاء
- [ ] الفيديو بيشتغل مع كابشنز متزامنة
- [ ] الـ waveform ظاهر مع regions لكل subtitle
- [ ] سحب حواف الـ region بيغير التوقيت
- [ ] تعديل النص بيتحدث مباشرة
- [ ] Split / Merge / Delete شغالين
- [ ] نقل كلمة للكابشن السابق/التالي شغال مع تعديل التوقيت أوتوماتيك
- [ ] Undo / Redo شغال
- [ ] Keyboard shortcuts شغالة
- [ ] RTL والخط العربي ظاهر صح
- [ ] Export SRT + Export JSON شغالين
- [ ] Approve بيحفظ `subtitles_approved.json`

---

## التقنيات

```
Vite + React 19 + TypeScript
@wavesurfer/react (official React component)
wavesurfer.js v7+ (Regions Plugin + Timeline Plugin)
Tailwind CSS v4
shadcn/ui (Button, Input, Dialog, ScrollArea, Tooltip)
Zustand (state management)
```

## إعداد المشروع

```bash
cd subtitle-editor
npm create vite@latest . -- --template react-ts
npm install
npm install @wavesurfer/react wavesurfer.js
npm install tailwindcss @tailwindcss/vite
npm install zustand
npx shadcn@latest init
npx shadcn@latest add button input dialog scroll-area tooltip separator
```

---

## بنية الملفات

```
subtitle-editor/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── src/
│   ├── App.tsx                         ← Layout رئيسي (4 panels)
│   ├── main.tsx
│   │
│   ├── store/
│   │   └── useSubtitleStore.ts         ← كل الـ state + actions
│   │
│   ├── components/
│   │   ├── VideoPlayer.tsx             ← فيديو + كابشنز overlay
│   │   ├── WaveformTimeline.tsx        ← wavesurfer + regions
│   │   ├── SubtitleList.tsx            ← قائمة الكابشنز
│   │   ├── SubtitleEditPanel.tsx       ← تعديل الكابشن المختار
│   │   ├── Toolbar.tsx                 ← Import/Export/Save/Approve
│   │   └── KeyboardHandler.tsx         ← Keyboard shortcuts
│   │
│   ├── utils/
│   │   ├── srt-parser.ts              ← parseSRT() + exportSRT()
│   │   ├── time-utils.ts              ← secondsToSRT(), srtToSeconds()
│   │   └── constants.ts               ← ألوان + ثوابت
│   │
│   └── types/
│       └── subtitle.ts                 ← Subtitle type
│
└── public/
    └── (الفيديو والأوديو بيتحطوا هنا أو بيتحملوا)
```

---

## Types

```typescript
// types/subtitle.ts

export interface Subtitle {
  id: string;
  index: number;
  startTime: number;     // بالثواني (e.g., 1.234)
  endTime: number;       // بالثواني
  text: string;
  words?: Word[];        // word-level timestamps (لو متاح)
}

export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface SubtitleProject {
  videoSrc: string;
  audioSrc: string;
  subtitles: Subtitle[];
  captionStyle: 'hormozi' | 'ali_abdaal' | 'tiktok' | 'classic' | 'karaoke';
}
```

---

## Zustand Store

```typescript
// store/useSubtitleStore.ts

import { create } from 'zustand';
import { Subtitle } from '../types/subtitle';

interface SubtitleState {
  // Data
  subtitles: Subtitle[];
  selectedId: string | null;
  
  // Playback
  currentTime: number;
  isPlaying: boolean;
  
  // History (Undo/Redo)
  history: Subtitle[][];
  historyIndex: number;
  maxHistory: number;
  
  // Actions
  setSubtitles: (subs: Subtitle[]) => void;
  selectSubtitle: (id: string | null) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  
  // Edit actions (all push to history)
  updateText: (id: string, text: string) => void;
  updateTiming: (id: string, start: number, end: number) => void;
  splitSubtitle: (id: string, splitAtTime: number) => void;
  mergeWithNext: (id: string) => void;
  deleteSubtitle: (id: string) => void;
  
  // Word-moving actions (all push to history)
  moveLastWordToNext: (id: string) => void;   // نقل آخر كلمة للكابشن التالي
  moveFirstWordToPrev: (id: string) => void;  // نقل أول كلمة للكابشن السابق
  
  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  
  // Import/Export
  importSRT: (content: string) => void;
  exportSRT: () => string;
  exportApprovedJSON: () => string;
  
  // Helpers
  getCurrentSubtitle: () => Subtitle | null;
  getWordCount: (id: string) => number;
}
```

**مهم:**
- كل edit action لازم يعمل `pushHistory()` قبل التعديل
- `undo()` بيرجع `historyIndex` خطوة
- `redo()` بيقدم `historyIndex` خطوة
- `maxHistory` = 50 (عشان الذاكرة)

---

## Components بالتفصيل

### App.tsx — Layout

```
┌──────────────────────────────────────────────────────────┐
│ [Toolbar]                                                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [VideoPlayer]                                           │
│  (فيديو + كابشنز)                                       │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [WaveformTimeline]                                      │
│  (waveform + regions + zoom)                             │
│                                                          │
├──────────────────────┬───────────────────────────────────┤
│                      │                                   │
│  [SubtitleList]      │  [SubtitleEditPanel]              │
│  (قائمة scrollable)  │  (تعديل المختار)                  │
│                      │                                   │
└──────────────────────┴───────────────────────────────────┘
```

**CSS Grid Layout:**
```tsx
<div className="h-screen grid grid-rows-[auto_300px_200px_1fr] bg-gray-950 text-white" dir="rtl">
  <Toolbar />
  <VideoPlayer />
  <WaveformTimeline />
  <div className="grid grid-cols-[1fr_350px] border-t border-gray-800">
    <SubtitleList />
    <SubtitleEditPanel />
  </div>
</div>
```

### VideoPlayer.tsx

**المسؤوليات:**
- عرض الفيديو بـ HTML5 `<video>`
- عرض الكابشن الحالي فوق الفيديو (overlay)
- تزامن `currentTime` مع الـ store
- Play/Pause controls

**التزامن:**
```typescript
// لما الفيديو يتحرك → الـ store يتحدث
videoRef.current.ontimeupdate = () => {
  setCurrentTime(videoRef.current.currentTime);
};

// لما الـ store يتحدث (من waveform أو من subtitle click) → الفيديو يتحرك
useEffect(() => {
  if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.1) {
    videoRef.current.currentTime = currentTime;
  }
}, [currentTime]);
```

**الكابشن overlay:**
```tsx
// جيب الكابشن الحالي
const currentSub = subtitles.find(s => 
  currentTime >= s.startTime && currentTime <= s.endTime
);

// اعرضه فوق الفيديو
{currentSub && (
  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 
    bg-black/70 px-6 py-3 rounded-lg text-2xl font-cairo text-white text-center"
    dir="rtl"
  >
    {currentSub.text}
  </div>
)}
```

### WaveformTimeline.tsx

**المسؤوليات:**
- عرض الـ waveform بـ `@wavesurfer/react`
- كل subtitle = Region (قابل للسحب)
- Timeline plugin (علامات الوقت)
- Zoom in/out
- تزامن مع VideoPlayer

**التنفيذ:**
```tsx
import WavesurferPlayer from '@wavesurfer/react';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';

// إنشاء الـ plugins
const plugins = useMemo(() => [
  RegionsPlugin.create(),
  TimelinePlugin.create({ container: '#timeline' }),
], []);

// بعد ما wavesurfer يكون جاهز
const onReady = (ws) => {
  setWavesurfer(ws);
  const regions = ws.getActivePlugins()[0]; // RegionsPlugin
  
  // إضافة region لكل subtitle
  subtitles.forEach(sub => {
    regions.addRegion({
      id: sub.id,
      start: sub.startTime,
      end: sub.endTime,
      content: sub.text,
      color: sub.id === selectedId 
        ? 'rgba(37, 99, 235, 0.4)'   // selected
        : 'rgba(37, 99, 235, 0.15)', // normal
      drag: true,
      resize: true,
    });
  });
  
  // لما region يتحرك → حدّث الـ timing
  regions.on('region-updated', (region) => {
    updateTiming(region.id, region.start, region.end);
  });
  
  // لما المستخدم يضغط على region → اختاره
  regions.on('region-clicked', (region) => {
    selectSubtitle(region.id);
  });
};

// تزامن مع الفيديو
const onAudioprocess = (time) => {
  setCurrentTime(time);
};
```

**Zoom:**
```tsx
const [zoom, setZoom] = useState(50);

<input type="range" min={10} max={500} value={zoom}
  onChange={(e) => {
    setZoom(Number(e.target.value));
    wavesurfer?.zoom(Number(e.target.value));
  }}
/>
```

### SubtitleList.tsx

**المسؤوليات:**
- عرض كل الكابشنز كقائمة scrollable
- highlight الكابشن الحالي
- عداد كلمات (أخضر 5-7 / أصفر غيره)
- الضغط على كابشن → اختاره + الفيديو يروحله
- بحث في النص

**كل عنصر في القائمة:**
```tsx
<div 
  className={cn(
    "p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-900",
    isActive && "bg-blue-950 border-r-2 border-r-blue-500",
    isSelected && "bg-gray-800"
  )}
  onClick={() => {
    selectSubtitle(sub.id);
    setCurrentTime(sub.startTime);
  }}
>
  <div className="flex justify-between text-xs text-gray-400 mb-1">
    <span>#{sub.index}</span>
    <span>{formatTime(sub.startTime)}</span>
    <span className={wordCount >= 5 && wordCount <= 7 ? 'text-green-400' : 'text-yellow-400'}>
      {wordCount} كلمة
    </span>
  </div>
  <p className="text-sm font-cairo" dir="rtl">{sub.text}</p>
</div>
```

### SubtitleEditPanel.tsx

**المسؤوليات:**
- تعديل النص
- تعديل start/end time (inputs رقمية)
- أزرار: Split / Merge / Delete / Play Region
- **نقل كلمات بين الكابشنز**
- عداد كلمات

```
┌─────────────────────────────────┐
│ ✏️ تعديل كابشن #3              │
│                                 │
│ Start: [00:00:07.200] 🕐        │
│ End:   [00:00:10.500] 🕐        │
│ Duration: 3.3s                  │
│                                 │
│ النص:                           │
│ ┌─────────────────────────────┐ │
│ │ النهارده هنتكلم عن الميزانية│ │
│ └─────────────────────────────┘ │
│ كلمات: 5/7 ✅                   │
│                                 │
│ ┌─────────┐  ┌─────────────┐   │
│ │◀ كلمة   │  │ كلمة ▶      │   │
│ │للسابق   │  │ للتالي      │   │
│ └─────────┘  └─────────────┘   │
│                                 │
│ [Split ✂️] [Merge 🔗] [Delete 🗑️]│
│                                 │
│ [▶️ Play Region]                │
└─────────────────────────────────┘
```

```tsx
// Split: يقسّم عند موضع الـ cursor الحالي
const handleSplit = () => {
  if (selectedId) {
    splitSubtitle(selectedId, currentTime);
  }
};

// Merge: يدمج مع اللي بعده
const handleMerge = () => {
  if (selectedId) {
    mergeWithNext(selectedId);
  }
};

// نقل آخر كلمة للكابشن التالي
const handleMoveWordToNext = () => {
  if (selectedId) {
    moveLastWordToNext(selectedId);
  }
};

// نقل أول كلمة للكابشن السابق
const handleMoveWordToPrev = () => {
  if (selectedId) {
    moveFirstWordToPrev(selectedId);
  }
};
```

**الـ Logic بتاعة نقل الكلمات:**

```typescript
// في الـ Zustand store

moveLastWordToNext: (id) => {
  pushHistory();
  
  const subIndex = subtitles.findIndex(s => s.id === id);
  const sub = subtitles[subIndex];
  const nextSub = subtitles[subIndex + 1];
  
  if (!nextSub) return;                    // مفيش كابشن بعده
  
  const words = sub.text.trim().split(/\s+/);
  if (words.length <= 1) return;           // مش هنسيبه فاضي
  
  const movedWord = words.pop();           // آخر كلمة
  
  // تحديث النصوص
  sub.text = words.join(' ');
  nextSub.text = movedWord + ' ' + nextSub.text;
  
  // تحديث التوقيتات
  if (sub.words && sub.words.length > 1) {
    // لو فيه word-level timestamps → ننقل الـ word data كمان
    const movedWordData = sub.words.pop();
    nextSub.words = [movedWordData, ...(nextSub.words || [])];
    
    // endTime الكابشن الحالي = نهاية آخر كلمة متبقية
    sub.endTime = sub.words[sub.words.length - 1].end;
    
    // startTime الكابشن التالي = بداية الكلمة المنقولة
    nextSub.startTime = movedWordData.start;
  } else {
    // لو مفيش word timestamps → تقدير بالتقسيم المتساوي
    const wordDuration = (sub.endTime - sub.startTime) / (words.length + 1);
    sub.endTime = sub.endTime - wordDuration;
    nextSub.startTime = sub.endTime;
  }
},

moveFirstWordToPrev: (id) => {
  pushHistory();
  
  const subIndex = subtitles.findIndex(s => s.id === id);
  const sub = subtitles[subIndex];
  const prevSub = subtitles[subIndex - 1];
  
  if (!prevSub) return;                    // مفيش كابشن قبله
  
  const words = sub.text.trim().split(/\s+/);
  if (words.length <= 1) return;           // مش هنسيبه فاضي
  
  const movedWord = words.shift();         // أول كلمة
  
  // تحديث النصوص
  sub.text = words.join(' ');
  prevSub.text = prevSub.text + ' ' + movedWord;
  
  // تحديث التوقيتات
  if (sub.words && sub.words.length > 1) {
    const movedWordData = sub.words.shift();
    prevSub.words = [...(prevSub.words || []), movedWordData];
    
    sub.startTime = sub.words[0].start;
    prevSub.endTime = movedWordData.end;
  } else {
    const wordDuration = (sub.endTime - sub.startTime) / (words.length + 1);
    sub.startTime = sub.startTime + wordDuration;
    prevSub.endTime = sub.startTime;
  }
},
```

### Toolbar.tsx

```tsx
<div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-800">
  <div className="flex gap-2">
    <Button onClick={handleImportSRT}>📥 Import SRT</Button>
    <Button onClick={handleExportSRT}>📤 Export SRT</Button>
    <Button onClick={handleSaveDraft}>💾 Save Draft</Button>
    <Button onClick={undo} disabled={historyIndex <= 0}>↩️ Undo</Button>
    <Button onClick={redo} disabled={historyIndex >= history.length - 1}>↪️ Redo</Button>
  </div>
  <Button onClick={handleApprove} variant="default" className="bg-green-600 hover:bg-green-700">
    ✅ Approve & Continue
  </Button>
</div>
```

**handleApprove:**
```typescript
const handleApprove = () => {
  const json = exportApprovedJSON();
  // حفظ في ../src/data/subtitles_approved.json
  // (عبر fetch لـ local API أو عبر download)
  
  // أو الأسهل: download الملف
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'subtitles_approved.json';
  a.click();
};
```

### KeyboardHandler.tsx

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // لو الـ focus في input → ما تعملش حاجة
    if ((e.target as HTMLElement).tagName === 'INPUT' || 
        (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    
    switch(true) {
      case e.code === 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case e.code === 'ArrowLeft' && !e.shiftKey && !e.ctrlKey:
        seekBy(-1);
        break;
      case e.code === 'ArrowRight' && !e.shiftKey && !e.ctrlKey:
        seekBy(1);
        break;
      case e.code === 'ArrowLeft' && e.shiftKey:
        seekBy(-0.1);
        break;
      case e.code === 'ArrowRight' && e.shiftKey:
        seekBy(0.1);
        break;
      case e.code === 'ArrowLeft' && e.ctrlKey:
        selectPrev();
        break;
      case e.code === 'ArrowRight' && e.ctrlKey:
        selectNext();
        break;
      case e.code === 'Enter':
        selectNext();
        break;
      case e.key === 'z' && e.ctrlKey && !e.shiftKey:
        undo();
        break;
      case e.key === 'z' && e.ctrlKey && e.shiftKey:
        redo();
        break;
      case e.key === 's' && e.ctrlKey:
        e.preventDefault();
        saveDraft();
        break;
      case e.key === 'Delete':
        deleteSelected();
        break;
      case e.key === 's' && !e.ctrlKey:
        splitAtCursor();
        break;
      case e.key === 'm':
        mergeSelected();
        break;
      case e.code === 'ArrowRight' && e.ctrlKey && e.shiftKey:
        e.preventDefault();
        moveLastWordToNext(selectedId);    // نقل آخر كلمة للتالي
        break;
      case e.code === 'ArrowLeft' && e.ctrlKey && e.shiftKey:
        e.preventDefault();
        moveFirstWordToPrev(selectedId);   // نقل أول كلمة للسابق
        break;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [/* deps */]);
```

---

## SRT Parser

```typescript
// utils/srt-parser.ts

export function parseSRT(content: string): Subtitle[] {
  const blocks = content.trim().split(/\n\n+/);
  return blocks.map((block, i) => {
    const lines = block.split('\n');
    const [start, end] = lines[1].split(' --> ').map(srtToSeconds);
    const text = lines.slice(2).join(' ').trim();
    return {
      id: `sub-${i}`,
      index: i + 1,
      startTime: start,
      endTime: end,
      text,
    };
  });
}

export function exportSRT(subtitles: Subtitle[]): string {
  return subtitles.map((sub, i) => {
    return `${i + 1}\n${secondsToSRT(sub.startTime)} --> ${secondsToSRT(sub.endTime)}\n${sub.text}`;
  }).join('\n\n');
}

export function srtToSeconds(time: string): number {
  const [h, m, rest] = time.split(':');
  const [s, ms] = rest.split(',');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

export function secondsToSRT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')},${ms.toString().padStart(3,'0')}`;
}
```

---

## RTL Support

```css
/* في global.css */
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');

/* كل الـ text inputs */
.font-cairo {
  font-family: 'Cairo', sans-serif;
}

/* الـ text areas والـ inputs */
textarea[dir="rtl"], input[dir="rtl"] {
  direction: rtl;
  text-align: right;
  font-family: 'Cairo', sans-serif;
}

/* الـ waveform يفضل LTR */
.waveform-container {
  direction: ltr;
}
```

---

## ⚠️ مشاكل شائعة وحلولها

| المشكلة | الحل |
|---------|------|
| الـ waveform مش ظاهر | تأكد إن الـ audio file محمّل صح. wavesurfer محتاج URL مباشر |
| Regions مش بتسحب | تأكد إن `drag: true, resize: true` في الـ region options |
| الفيديو والـ waveform مش متزامنين | استخدم `ontimeupdate` + `seekTo()` في الاتجاهين |
| الكابشنز بتظهر LTR | أضف `dir="rtl"` على كل element فيه نص عربي |
| خط Cairo مش ظاهر | تأكد من import في CSS + `font-family: 'Cairo'` |
| shadcn/ui مش شغال | `npx shadcn@latest init` + اختر الإعدادات الصح |
| الـ regions بتتلخبط لما تتحدث | استخدم `region.id` مش index. وحدّث الـ region بـ `setOptions()` مش إنشاء جديد |

---

## Verification

```bash
cd subtitle-editor
npm run dev
# لازم يفتح على http://localhost:5173
# لازم يعرض الفيديو + waveform + قائمة كابشنز
# جرّب: سحب حافة region + تعديل نص + split + merge + undo
```

---

## Git Commit

```bash
git add .
git commit -m "v3: subtitle editor UI complete"
```

---

## بعد ما تخلص
```
Claude Code:
  ✅ Subtitle Editor UI جاهز على http://localhost:5173
  
  الميزات:
  - فيديو + كابشنز متزامنة ✅
  - Waveform + Regions (سحب) ✅
  - تعديل نص + توقيتات ✅
  - Split / Merge / Delete ✅
  - نقل كلمات بين الكابشنز (مع تعديل التوقيت أوتوماتيك) ✅
  - Undo / Redo ✅
  - Keyboard shortcuts ✅
  - RTL + Cairo font ✅
  - Import/Export SRT ✅
  - Approve button ✅
  
  افتح http://localhost:5173 وراجع الكابشنز.
  لما تخلص اضغط "Approve & Continue" وقولي.
```
