# Implementation Plan — WikiOS Natural Voice Narrator

This document details the architectural plan to add Onoma Voice (Kokoro TTS) narration to WikiOS article reader pages.

---

## 1. User Experience & UI Design

### A. The Floating Player Bar (`<WikiOSNarratorPlayer />`)
* A sticky, frosted glassmorphic player widget anchored at the top of the article or integrated directly into the article toolbar.
* **Controls**:
  - **Play / Pause / Stop**: Central playback control button.
  - **Skip Prev / Next**: Quickly skip back or forward by block (headings, paragraphs).
  - **Speed Selector**: Slider or dropdown to adjust narration speed ($0.8x$ to $2.0x$).
  - **Voice Selector Dropdown**: Manual override of the speaking voice (loaded from the active Kokoro server voice list).
  - **Auto-Scroll Toggle**: Smoothly centers the currently spoken block in the viewport as reading progresses.
  - **Progress Bar**: Shows reading completion status (e.g. "Paragraph 4 of 12").

### B. Synced Highlighting
* When a paragraph or heading is currently being spoken:
  - Add a temporary highlight class (e.g. `bg-emerald-500/10 border-l-2 border-emerald-500 rounded-r pl-2 transition-all duration-300`) to the corresponding element in the DOM.
  - Dim other blocks slightly to focus the reader's attention.

---

## 2. Technical Architecture

### A. Client-Side Text Segmenter
On click of the Play button, the client-side controller will scan the article container:
1. Extract elements: headings (`<h2>`, `<h3>`, `<h4>`), paragraphs (`<p>`), and list items (`<li>`).
2. Clean the text:
   - Strip citation brackets (e.g., `\[\d+\]` or `\[citation needed\]`).
   - Ignore infoboxes, tables, coordinates, math markup, and navigation templates.
3. Build a structured playback queue:
   ```ts
   interface PlaybackBlock {
     id: string; // DOM element ID or data-attribute selector
     text: string; // Cleaned plain text to speak
     type: "heading" | "prose";
   }
   ```

### B. Smart Voice Mapping
Before playback starts, detect the most appropriate voice:
1. Parse the page's categories (e.g. `Category:Caphirian_Empire` $\rightarrow$ Latin culture, `Category:Celtia` $\rightarrow$ Celtic culture).
2. Look up the naming culture in the per-culture voice map configured by the administrator.
3. If no specific culture is found, fall back to the user's personal default voice override (`onoma-personal-voice` in `localStorage`), or the system-wide default.

### C. Sequential Streaming Queue
To ensure immediate playback start without buffering latencies:
1. Playback starts as soon as the first text block is synthesized.
2. While Block $N$ is playing, the browser pre-fetches the audio blob for Block $N+1$ from `/api/onoma/tts` and buffers it locally.
3. A small pause is introduced between headings and paragraphs for natural phrasing.

---

## 3. Implementation Steps

### Step 1: Add the Narrator Controller Hook (`useWikiNarrator.ts`)
Create a custom hook `src/hooks/useWikiNarrator.ts` that:
- Reads the DOM article element ref.
- Builds the playback queue of blocks.
- Manages playback index, active state, buffering, auto-scroll, and speed settings.
- Requests TTS chunks sequentially from `/api/onoma/tts?text=...&voice=...&speed=...`.

### Step 2: Build the Narrator Player Component (`WikiOSNarratorPlayer.tsx`)
Create a UI component at `src/components/wiki-os/reader/WikiOSNarratorPlayer.tsx`:
- Render play/pause, skip, speed slider, voice dropdown, and auto-scroll checkbox.
- Display reading progress indicators.

### Step 3: Integrate with `ArticleRenderer.tsx`
- Mount the `<WikiOSNarratorPlayer />` at the top of the article layout.
- Bind the article DOM reference to the narrator hook.
- Render highlight borders on the active DOM block dynamically.
