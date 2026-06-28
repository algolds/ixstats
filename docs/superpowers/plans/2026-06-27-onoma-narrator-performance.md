# Onoma Narrator Caching and Pre-fetching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve performance and speed of the WikiOS Onoma natural voice narrator by caching voice audio persistently client-side and pre-fetching future blocks.

**Architecture:** Use the Web Cache Storage API (`caches`) to persistently cache voice requests. Use a React ref promise-deduplication map to prevent duplicate network requests and implement a 2-block moving pre-fetch window.

**Tech Stack:** React 19, TypeScript, Next.js 16, browser Cache Storage API.

## Global Constraints
* Active branch: `v2`
* Package manager: `bun` (never npm/yarn/pnpm)
* Enforce ≤700 lines per router and design components of high quality
* No placeholders (all code details must be exact and complete)

---

### Task 1: Update WikiContext interface and provider
Extend the narrator actions interface to register the cache clearing method.

**Files:**
- Modify: `src/components/wiki-os/shared/WikiContext.tsx`

**Interfaces:**
- Produces: `WikiNarratorActions` updated with `clearCache?: () => Promise<void>`

- [ ] **Step 1: Modify interface in WikiContext.tsx**
  Add the optional `clearCache` function to the `WikiNarratorActions` interface around line 38:
  ```typescript
  export interface WikiNarratorActions {
    play: () => void;
    pause: () => void;
    stop: () => void;
    skipNext: () => void;
    skipPrev: () => void;
    setSpeed: (speed: number) => void;
    setVoice: (voice: string) => void;
    jumpToSection: (id: string) => void;
    jumpToBlock: (index: number) => void;
    clearCache?: () => Promise<void>;
  }
  ```

- [ ] **Step 2: Commit Task 1 changes**
  ```bash
  git add src/components/wiki-os/shared/WikiContext.tsx
  git commit -m "feat: add clearCache action to WikiNarratorActions interface"
  ```

---

### Task 2: Implement persistent cache, deduplication, and pre-fetching in useWikiNarrator.ts

**Files:**
- Modify: `src/hooks/useWikiNarrator.ts`

**Interfaces:**
- Consumes: `WikiNarratorActions` from `src/components/wiki-os/shared/WikiContext.tsx`
- Produces: `clearCache` action registered to the narrator context

- [ ] **Step 1: Add ref registry and fetchAudioBlob helper**
  Add `activeFetchesRef` and the `fetchAudioBlob` helper inside the `useWikiNarrator` hook.
  ```typescript
  // Inside useWikiNarrator, below blocksRef definitions:
  const activeFetchesRef = useRef<Map<string, Promise<Blob>>>(new Map());

  const fetchAudioBlob = useCallback(async (requestUrl: string): Promise<Blob> => {
    if (activeFetchesRef.current.has(requestUrl)) {
      return activeFetchesRef.current.get(requestUrl)!;
    }

    const fetchPromise = (async () => {
      try {
        const cache = await caches.open("onoma-voice-cache");
        const cachedResponse = await cache.match(requestUrl);
        if (cachedResponse) {
          return await cachedResponse.blob();
        }

        const res = await fetch(requestUrl);
        if (!res.ok) {
          throw new Error("TTS API returned non-2xx");
        }

        // Store cloned response in Cache API
        await cache.put(requestUrl, res.clone());
        return await res.blob();
      } finally {
        activeFetchesRef.current.delete(requestUrl);
      }
    })();

    activeFetchesRef.current.set(requestUrl, fetchPromise);
    return fetchPromise;
  }, []);
  ```

- [ ] **Step 2: Implement preFetchBlocks helper**
  Implement the pre-fetch logic to fetch and cache the next 2 blocks in the background:
  ```typescript
  const preFetchBlocks = useCallback(async (index: number) => {
    const isKokoroEnabled = Boolean(config?.kokoro?.enabled);
    if (!isKokoroEnabled) return;

    const activeVoice = voice || undefined;
    const chosenVoice = activeVoice || config?.kokoro?.voice;

    for (let i = 1; i <= 2; i++) {
      const nextIdx = index + i;
      if (nextIdx < blocksRef.current.length) {
        const block = blocksRef.current[nextIdx];
        const params = new URLSearchParams({
          text: block.text,
          ipa: "",
        });
        const finalVoice = chosenVoice;
        if (finalVoice) params.set("voice", finalVoice);
        params.set("speed", String(speed));

        const requestUrl = `/api/onoma/tts?${params.toString()}`;
        // Trigger fetch in background and ignore failures
        fetchAudioBlob(requestUrl).catch(() => {});
      }
    }
  }, [config, speed, voice, fetchAudioBlob]);
  ```

- [ ] **Step 3: Update playBlock to utilize caching and pre-fetching**
  Rewrite the Kokoro branch of `playBlock` to use the cached/deduplicated fetch:
  ```typescript
  // Replace the res = await fetch(...) block with:
  if (isKokoroEnabled) {
    const params = new URLSearchParams({
      text: block.text,
      ipa: "",
    });
    const chosenVoice = activeVoice || config?.kokoro?.voice;
    if (chosenVoice) params.set("voice", chosenVoice);
    params.set("speed", String(speed));

    const requestUrl = `/api/onoma/tts?${params.toString()}`;

    // Pre-fetch N+1 and N+2
    preFetchBlocks(index);

    const blob = await fetchAudioBlob(requestUrl);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (isPlayingRef.current) {
        setTimeout(
          () => {
            if (isPlayingRef.current) {
              playBlock(activeIdxRef.current + 1);
            }
          },
          block.type === "heading" ? 600 : 350
        );
      }
    };

    await audio.play();
  }
  ```

- [ ] **Step 4: Implement and register clearVoiceCache**
  Implement the cache eviction method and map it to `clearCache` action in the register useEffect:
  ```typescript
  const clearVoiceCache = useCallback(async () => {
    try {
      const deleted = await caches.delete("onoma-voice-cache");
      if (deleted) {
        notify.success("Voice narrator cache cleared.");
      } else {
        notify.info("Voice narrator cache is already empty.");
      }
    } catch (err) {
      console.warn("Failed to clear voice cache:", err);
      notify.error("Failed to clear voice narrator cache.");
    }
  }, [notify]);

  // Inside registration useEffect around line 420:
  useEffect(() => {
    registerNarratorActions({
      play,
      pause,
      stop: stopPlayback,
      skipNext,
      skipPrev,
      setSpeed: changeSpeed,
      setVoice: changeVoice,
      jumpToSection,
      jumpToBlock: (idx: number) => {
        setIsPlaying(true);
        playBlock(idx);
      },
      clearCache: clearVoiceCache, // Register the action
    });
    return () => registerNarratorActions(null);
  }, [
    registerNarratorActions,
    play,
    pause,
    stopPlayback,
    skipNext,
    skipPrev,
    changeSpeed,
    changeVoice,
    jumpToSection,
    playBlock,
    clearVoiceCache,
  ]);
  ```

- [ ] **Step 5: Commit Task 2 changes**
  ```bash
  git add src/hooks/useWikiNarrator.ts
  git commit -m "feat: implement persistent client-side Cache Storage and pre-fetching in useWikiNarrator"
  ```

---

### Task 3: Integrate Clear Cache Action with WikiOSNarratorPlayer UI

**Files:**
- Modify: `src/components/wiki-os/reader/WikiOSNarratorPlayer.tsx`

**Interfaces:**
- Consumes: `clearCache` from `useWikiContext` narratorActions

- [ ] **Step 1: Add Clear Cache button to UI**
  Extract `clearCache` from `narratorActions` and add the button to the options bar.
  ```typescript
  // Around line 23: import Trash2 from lucide-react
  import {
    Volume2,
    VolumeX,
    Play,
    Pause,
    Square,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Gauge,
    User,
    Scroll,
    Trash2, // Add Trash2
  } from "lucide-react";

  // Around line 66: extract clearCache
  const { play, pause, stop, skipNext, skipPrev, setSpeed, setVoice, clearCache } = narratorActions;

  // Around line 237: render the button next to Follow Scroll button
  {clearCache && (
    <button
      onClick={clearCache}
      className={cn(
        "flex items-center gap-1 rounded border px-2 py-1 transition-all active:scale-95",
        "bg-background/80 text-muted-foreground border-black/10 hover:text-red-500 hover:border-red-500/20 hover:bg-red-500/10 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-red-500/15"
      )}
      title="Clear saved voice audio cache"
    >
      <Trash2 className="h-3 w-3" />
      <span>Clear Cache</span>
    </button>
  )}
  ```

- [ ] **Step 2: Commit Task 3 changes**
  ```bash
  git add src/components/wiki-os/reader/WikiOSNarratorPlayer.tsx
  git commit -m "feat: render Clear Cache button in WikiOSNarratorPlayer UI"
  ```
