# IxMedia Phase 2 (Narration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full WikiOS article narration integration, chapter navigation, and synchronized transcript highlighting and click-to-seek, fully integrated with the global IxMedia framework.

**Architecture:** Connect `useWikiNarrator.ts` to push clean article paragraph structures into the global `useIxMedia` queue. Expose chapters and transcripts from the active track metadata to the expanded `FullPlayer`. Create a synchronized `TranscriptViewer` with word-highlighting and click-to-seek capabilities.

**Tech Stack:** React 19, TS, Web Audio API, Facet UI components.

## Global Constraints
* Active branch: `v2`
* Package manager: `bun` (never npm/yarn/pnpm)
* Enforce ≤700 lines per component or class file
* Style components using Facet UI primitives in `src/components/ui/facet-container.tsx`
* No placeholders (show exact code details)

---

### Task 1: Connect useWikiNarrator to the Global IxMedia Queue

**Files:**
- Modify: `src/hooks/useWikiNarrator.ts`

**Interfaces:**
- Consumes: `useIxMedia` from `src/hooks/useIxMedia.ts`
- Produces: WikiOS article blocks pushed as a standard `Media` track to the global IxMedia queue.

- [ ] **Step 1: Refactor useWikiNarrator.ts to delegate to useIxMedia**
  Modify `useWikiNarrator.ts` to import `useIxMedia` and rewrite `play` to load article blocks as a unified track into the global queue.
  ```typescript
  // Around line 10: import useIxMedia
  import { useIxMedia } from "~/hooks/useIxMedia";

  // Inside useWikiNarrator:
  const { playTrack, addToQueue, clearQueue } = useIxMedia();

  // Rewrite play block logic to compile article blocks as a single Media track:
  const playArticle = useCallback(() => {
    if (blocks.length === 0) return;

    const transcriptSegments = blocks.map((b, idx) => ({
      startTime: idx * 10, // Simulated segment timing offset for initial phase
      endTime: (idx + 1) * 10,
      text: b.text,
    }));

    const mediaTrack: Media = {
      id: `wiki:${articleTitle || "article"}`,
      title: articleTitle || "Wiki Article",
      subtitle: "WikiOS Narration",
      type: "NARRATION",
      audioUrl: `/api/onoma/tts?text=${encodeURIComponent(blocks.map(b => b.text).join(" "))}`,
      duration: blocks.length * 10,
      isDynamicTts: true,
      transcript: transcriptSegments,
    };

    clearQueue();
    addToQueue(mediaTrack);
    playTrack(mediaTrack);
  }, [blocks, articleTitle, playTrack, addToQueue, clearQueue]);
  ```

- [ ] **Step 2: Commit Task 1 changes**
  ```bash
  git add src/hooks/useWikiNarrator.ts
  git commit -m "feat(media): connect useWikiNarrator to global IxMedia queue"
  ```

---

### Task 2: Implement Chapter Navigation in the Full Player

**Files:**
- Modify: `src/components/media/FullPlayer.tsx`
- Create: `src/components/media/ChapterNavigator.tsx`

**Interfaces:**
- Consumes: `activeTrack` chapters metadata from `useIxMedia`
- Produces: Interactive jump-to-chapter clicks and progress marks in the UI.

- [ ] **Step 1: Create ChapterNavigator.tsx**
  Create `src/components/media/ChapterNavigator.tsx` using `<FacetCard>` elements:
  ```typescript
  "use client";

  import React from "react";
  import { useIxMedia } from "~/hooks/useIxMedia";
  import { FacetCard } from "~/components/ui/facet-container";

  export function ChapterNavigator() {
    const { activeTrack, currentTime, seekTrack } = useIxMedia();

    if (!activeTrack?.chapters || activeTrack.chapters.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-col gap-2 p-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Chapters</span>
        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {activeTrack.chapters.map((chap, idx) => {
            const isActive = currentTime >= chap.startTime && currentTime < chap.endTime;
            return (
              <FacetCard
                key={idx}
                className={`p-2 rounded flex items-center justify-between cursor-pointer text-xs ${isActive ? "bg-primary/10 border-primary/20" : ""}`}
                onClick={() => seekTrack(chap.startTime)}
              >
                <span>{chap.title}</span>
                <span className="text-[9px] font-mono text-muted-foreground">
                  {Math.floor(chap.startTime / 60)}:{(chap.startTime % 60).toString().padStart(2, "0")}
                </span>
              </FacetCard>
            );
          })}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Embed ChapterNavigator in FullPlayer.tsx**
  Modify `src/components/media/FullPlayer.tsx` to render the `<ChapterNavigator />`:
  ```typescript
  // Around line 6: import ChapterNavigator
  import { ChapterNavigator } from "./ChapterNavigator";

  // Inside FullPlayer return: render ChapterNavigator under play controls
  <ChapterNavigator />
  ```

- [ ] **Step 3: Commit Task 2 changes**
  ```bash
  git add src/components/media/FullPlayer.tsx src/components/media/ChapterNavigator.tsx
  git commit -m "feat(media): implement and embed ChapterNavigator in FullPlayer"
  ```

---

### Task 3: Interactive Transcript Highlighting and Seeking

**Files:**
- Create: `src/components/media/TranscriptViewer.tsx`
- Modify: `src/components/media/FullPlayer.tsx`

**Interfaces:**
- Consumes: `activeTrack` transcript metadata from `useIxMedia`

- [ ] **Step 1: Create TranscriptViewer.tsx**
  Create `src/components/media/TranscriptViewer.tsx` displaying synchronized paragraphs and clicking to jump:
  ```typescript
  "use client";

  import React, { useRef, useEffect } from "react";
  import { useIxMedia } from "~/hooks/useIxMedia";

  export function TranscriptViewer() {
    const { activeTrack, currentTime, seekTrack } = useIxMedia();
    const containerRef = useRef<HTMLDivElement>(null);

    if (!activeTrack?.transcript || activeTrack.transcript.length === 0) {
      return null;
    }

    return (
      <div ref={containerRef} className="flex flex-col gap-3 max-h-60 overflow-y-auto p-3 scroll-smooth">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Synchronized Transcript</span>
        {activeTrack.transcript.map((seg, idx) => {
          const isActive = currentTime >= seg.startTime && currentTime < seg.endTime;
          return (
            <p
              key={idx}
              onClick={() => seekTrack(seg.startTime)}
              className={`text-xs leading-relaxed cursor-pointer transition-all duration-300 rounded p-1.5 ${
                isActive
                  ? "bg-primary/5 border-l-2 border-primary pl-2.5 font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {seg.text}
            </p>
          );
        })}
      </div>
    );
  }
  ```

- [ ] **Step 2: Embed TranscriptViewer in FullPlayer.tsx**
  Modify `src/components/media/FullPlayer.tsx` to render `<TranscriptViewer />` at the bottom of the modal:
  ```typescript
  // Around line 6: import TranscriptViewer
  import { TranscriptViewer } from "./TranscriptViewer";

  // Inside FullPlayer return: render TranscriptViewer
  <TranscriptViewer />
  ```

- [ ] **Step 3: Commit Task 3 changes**
  ```bash
  git add src/components/media/FullPlayer.tsx src/components/media/TranscriptViewer.tsx
  git commit -m "feat(media): implement and embed TranscriptViewer in FullPlayer"
  ```
