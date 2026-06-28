# IxMedia Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the foundational backend, database, audio engine, global context, and Facet UI players for the unified IxMedia framework, integrating Onoma ducking and basic audio playback.

**Architecture:** A pure TS `IxMediaEngine` manages hardware audio. A `<MediaContext>` provider wraps the layout to sync progress to `localStorage` and expose actions. Prisma tables store tracks, playlists, and histories. UI components are built using `FacetContainer`, `FacetCard`, and `FacetModal` for volumetric aesthetics.

**Tech Stack:** React 19, TS, Tailwind CSS 4, Prisma 6, Web Audio API, HTML5 Audio, Facet Design System.

## Global Constraints
* Active branch: `v2`
* Package manager: `bun` (never npm/yarn/pnpm)
* Enforce ≤700 lines per component or class file
* Style components using Facet UI primitives in `src/components/ui/facet-container.tsx`
* No placeholders (show exact code details)

---

### Task 1: TypeScript schemas and Audio Engine Class

**Files:**
- Create: `src/lib/media/types.ts`
- Create: `src/lib/media/IxMediaEngine.ts`

**Interfaces:**
- Produces: `Media` type definitions, `IxMediaEngine` playback controls and event streams.

- [ ] **Step 1: Create types.ts**
  Create `src/lib/media/types.ts` defining type definitions for tracks, chapters, transcripts, and types.
  ```typescript
  export type MediaType = "MUSIC" | "SPEECH" | "LANGUAGE" | "RADIO" | "PODCAST" | "NARRATION" | "AMBIENT";

  export interface Chapter {
    title: string;
    startTime: number;
    endTime: number;
  }

  export interface TranscriptSegment {
    startTime: number;
    endTime: number;
    text: string;
    words?: { word: string; start: number; end: number }[];
  }

  export interface Media {
    id: string;
    title: string;
    subtitle?: string;
    description?: string;
    type: MediaType;
    audioUrl: string;
    duration: number;
    coverArt?: string;
    peaks?: number[];
    chapters?: Chapter[];
    transcript?: TranscriptSegment[];
    isDynamicTts?: boolean;
    voice?: string;
    speed?: number;
  }
  ```

- [ ] **Step 2: Create IxMediaEngine.ts**
  Create `src/lib/media/IxMediaEngine.ts` wrapping HTML5 Audio and Web Audio API:
  ```typescript
  export type EngineEvent = "statechange" | "timeupdate" | "durationchange" | "ended" | "error";

  export class IxMediaEngine {
    private audio: HTMLAudioElement;
    private context: AudioContext | null = null;
    private listeners: Map<EngineEvent, Set<(...args: any[]) => void>> = new Map();

    constructor() {
      if (typeof window !== "undefined") {
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.setupListeners();
      } else {
        this.audio = {} as HTMLAudioElement;
      }
    }

    public load(url: string, speed = 1.0) {
      this.audio.src = url;
      this.audio.playbackRate = speed;
      this.audio.load();
    }

    public play(): Promise<void> {
      this.initializeAudioContext();
      return this.audio.play();
    }

    public pause() {
      this.audio.pause();
    }

    public seek(seconds: number) {
      this.audio.currentTime = seconds;
    }

    public setVolume(volume: number) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }

    public setSpeed(speed: number) {
      this.audio.playbackRate = speed;
    }

    public get duration(): number { return this.audio.duration || 0; }
    public get currentTime(): number { return this.audio.currentTime || 0; }
    public get isPlaying(): boolean { return !this.audio.paused; }

    public addEventListener(event: EngineEvent, callback: (...args: any[]) => void) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event)!.add(callback);
    }

    public removeEventListener(event: EngineEvent, callback: (...args: any[]) => void) {
      this.listeners.get(event)?.delete(callback);
    }

    private initializeAudioContext() {
      if (!this.context && typeof window !== "undefined") {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.context = new AudioCtx();
      }
    }

    private setupListeners() {
      this.audio.addEventListener("timeupdate", () => this.emit("timeupdate", this.audio.currentTime));
      this.audio.addEventListener("durationchange", () => this.emit("durationchange", this.audio.duration));
      this.audio.addEventListener("ended", () => this.emit("ended"));
      this.audio.addEventListener("error", (e) => this.emit("error", e));
      this.audio.addEventListener("play", () => this.emit("statechange", "playing"));
      this.audio.addEventListener("pause", () => this.emit("statechange", "paused"));
    }

    private emit(event: EngineEvent, ...args: any[]) {
      this.listeners.get(event)?.forEach((cb) => cb(...args));
    }
  }
  ```

- [ ] **Step 3: Commit Task 1 changes**
  ```bash
  git add src/lib/media/types.ts src/lib/media/IxMediaEngine.ts
  git commit -m "feat(media): create typescript media types and native audio engine wrapper"
  ```

---

### Task 2: Database Schema & Setup

**Files:**
- Create: `prisma/schema/media.prisma`
- Modify: `prisma/schema/base.prisma` (if necessary to check model imports)

**Interfaces:**
- Produces: `MediaTrack`, `MediaPlaylist`, `PlaylistTrack`, and `PlaybackHistory` models in database

- [ ] **Step 1: Write prisma schema**
  Create file `prisma/schema/media.prisma` defining media tables exactly:
  ```prisma
  enum MediaType {
    MUSIC
    SPEECH
    LANGUAGE
    RADIO
    PODCAST
    NARRATION
    AMBIENT
  }

  model MediaTrack {
    id          String    @id @default(cuid())
    title       String
    subtitle    String?
    description String?   @db.Text
    type        MediaType @default(MUSIC)
    audioUrl    String
    duration    Float
    coverArt    String?
    peaks       Int[]
    tags        String[]
    metadata    Json?

    playlists   PlaylistTrack[]
    history     PlaybackHistory[]

    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt
  }

  model MediaPlaylist {
    id          String          @id @default(cuid())
    name        String
    description String?
    userId      String
    tracks      PlaylistTrack[]
    createdAt   DateTime        @default(now())
    updatedAt   DateTime        @updatedAt
  }

  model PlaylistTrack {
    id          String        @id @default(cuid())
    playlistId  String
    trackId     String
    orderIndex  Int

    playlist    MediaPlaylist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
    track       MediaTrack    @relation(fields: [trackId], references: [id], onDelete: Cascade)

    @@unique([playlistId, orderIndex])
  }

  model PlaybackHistory {
    id          String      @id @default(cuid())
    userId      String
    trackId     String
    playedAt    DateTime    @default(now())
    progress    Float

    track       MediaTrack  @relation(fields: [trackId], references: [id], onDelete: Cascade)
  }
  ```

- [ ] **Step 2: Sync database schema safely**
  Run schema checks and push the updates without resetting the DB (per `AGENTS.md` instructions: do NOT run `migrate dev` or push with force unless needed):
  Run: `bun run db:setup` or prisma generate:
  ```bash
  bunx prisma generate
  ```

- [ ] **Step 3: Commit Task 2 changes**
  ```bash
  git add prisma/schema/media.prisma
  git commit -m "feat(media): add media models to prisma database schema"
  ```

---

### Task 3: Global Media Context & Provider Setup

**Files:**
- Create: `src/components/media/MediaContext.tsx`
- Create: `src/hooks/useIxMedia.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `<MediaContextProvider>` context and `useIxMedia()` hooks.

- [ ] **Step 1: Write MediaContext.tsx**
  Create `src/components/media/MediaContext.tsx` implementing volume setting, progress update, queue reordering, and localStorage persistence:
  ```typescript
  "use client";

  import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
  import { IxMediaEngine } from "~/lib/media/IxMediaEngine";
  import type { Media } from "~/lib/media/types";

  export interface MediaContextState {
    activeTrack: Media | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    speed: number;
    queue: Media[];
    currentIndex: number;

    playTrack: (track: Media) => void;
    pauseTrack: () => void;
    resumeTrack: () => void;
    seekTrack: (seconds: number) => void;
    changeVolume: (volume: number) => void;
    changeSpeed: (speed: number) => void;
    addToQueue: (track: Media) => void;
    removeFromQueue: (id: string) => void;
    clearQueue: () => void;
    skipNext: () => void;
    skipPrevious: () => void;
  }

  const MediaContext = createContext<MediaContextState>({} as any);

  export function MediaContextProvider({ children }: { children: React.ReactNode }) {
    const engineRef = useRef<IxMediaEngine | null>(null);
    const [activeTrack, setActiveTrack] = useState<Media | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [speed, setSpeed] = useState(1.0);
    const [queue, setQueue] = useState<Media[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);

    useEffect(() => {
      engineRef.current = new IxMediaEngine();
      const engine = engineRef.current;

      engine.addEventListener("statechange", (state: string) => setIsPlaying(state === "playing"));
      engine.addEventListener("timeupdate", (time: number) => setCurrentTime(time));
      engine.addEventListener("durationchange", (dur: number) => setDuration(dur));
      engine.addEventListener("ended", () => skipNext());

      // Load settings
      const savedSettings = localStorage.getItem("ixmedia:settings");
      if (savedSettings) {
        const { v, s } = JSON.parse(savedSettings);
        setVolume(v ?? 0.8);
        setSpeed(s ?? 1.0);
        engine.setVolume(v ?? 0.8);
        engine.setSpeed(s ?? 1.0);
      }
    }, []);

    const playTrack = useCallback((track: Media) => {
      if (!engineRef.current) return;
      setActiveTrack(track);
      engineRef.current.load(track.audioUrl, speed);
      engineRef.current.play().catch(console.warn);
    }, [speed]);

    const pauseTrack = useCallback(() => {
      engineRef.current?.pause();
    }, []);

    const resumeTrack = useCallback(() => {
      engineRef.current?.play().catch(console.warn);
    }, []);

    const seekTrack = useCallback((seconds: number) => {
      engineRef.current?.seek(seconds);
    }, []);

    const changeVolume = useCallback((v: number) => {
      setVolume(v);
      engineRef.current?.setVolume(v);
      localStorage.setItem("ixmedia:settings", JSON.stringify({ v, s: speed }));
    }, [speed]);

    const changeSpeed = useCallback((s: number) => {
      setSpeed(s);
      engineRef.current?.setSpeed(s);
      localStorage.setItem("ixmedia:settings", JSON.stringify({ v: volume, s }));
    }, [volume]);

    const addToQueue = useCallback((track: Media) => {
      setQueue((prev) => [...prev, track]);
    }, []);

    const removeFromQueue = useCallback((id: string) => {
      setQueue((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const clearQueue = useCallback(() => {
      setQueue([]);
      setCurrentIndex(-1);
    }, []);

    const skipNext = useCallback(() => {
      if (queue.length === 0 || currentIndex >= queue.length - 1) return;
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      playTrack(queue[nextIdx]);
    }, [queue, currentIndex, playTrack]);

    const skipPrevious = useCallback(() => {
      if (currentIndex <= 0 || queue.length === 0) return;
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      playTrack(queue[prevIdx]);
    }, [queue, currentIndex, playTrack]);

    return (
      <MediaContext.Provider
        value={{
          activeTrack,
          isPlaying,
          currentTime,
          duration,
          volume,
          speed,
          queue,
          currentIndex,
          playTrack,
          pauseTrack,
          resumeTrack,
          seekTrack,
          changeVolume,
          changeSpeed,
          addToQueue,
          removeFromQueue,
          clearQueue,
          skipNext,
          skipPrevious,
        }}
      >
        {children}
      </MediaContext.Provider>
    );
  }

  export function useIxMedia() {
    return useContext(MediaContext);
  }
  ```

- [ ] **Step 2: Create useIxMedia hook file**
  Create `src/hooks/useIxMedia.ts`:
  ```typescript
  import { useIxMedia } from "~/components/media/MediaContext";
  export { useIxMedia };
  ```

- [ ] **Step 3: Modify layout.tsx**
  Inject `<MediaContextProvider>` inside `src/app/layout.tsx` enclosing page contents.
  ```typescript
  import { MediaContextProvider } from "~/components/media/MediaContext";
  // Around return:
  <MediaContextProvider>
    {children}
  </MediaContextProvider>
  ```

- [ ] **Step 4: Commit Task 3 changes**
  ```bash
  git add src/components/media/MediaContext.tsx src/hooks/useIxMedia.ts src/app/layout.tsx
  git commit -m "feat(media): implement global MediaContextProvider and mount in layout"
  ```

---

### Task 4: Facet UI Mini Player, Full Player, and Queue Components

**Files:**
- Create: `src/components/media/MiniPlayer.tsx`
- Create: `src/components/media/FullPlayer.tsx`
- Create: `src/components/media/QueuePanel.tsx`
- Create: `src/components/media/WaveformVisualizer.tsx`

**Interfaces:**
- Consumes: `useIxMedia` hook and `FacetContainer` components from `src/components/ui/facet-container.tsx`

- [ ] **Step 1: Create MiniPlayer.tsx**
  Implement mini sticky bar utilizing `<FacetContainer variant="base" depth={3} interactive="hover">`:
  ```typescript
  "use client";

  import React from "react";
  import { useIxMedia } from "~/hooks/useIxMedia";
  import { FacetContainer } from "~/components/ui/facet-container";
  import { Play, Pause, SkipForward, Volume2 } from "lucide-react";

  export function MiniPlayer() {
    const { activeTrack, isPlaying, pauseTrack, resumeTrack, skipNext } = useIxMedia();

    if (!activeTrack) return null;

    return (
      <div className="fixed bottom-4 left-4 right-4 z-40">
        <FacetContainer
          variant="base"
          depth={3}
          interactive="hover"
          className="flex items-center justify-between gap-4 p-3 border border-black/10 dark:border-white/10"
        >
          <div className="flex items-center gap-3">
            {activeTrack.coverArt && (
              <img src={activeTrack.coverArt} className="w-10 h-10 rounded object-cover" alt="Art" />
            )}
            <div className="flex flex-col">
              <span className="text-xs font-bold">{activeTrack.title}</span>
              <span className="text-[10px] text-muted-foreground">{activeTrack.subtitle}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isPlaying ? (
              <button onClick={pauseTrack}><Pause className="h-4 w-4" /></button>
            ) : (
              <button onClick={resumeTrack}><Play className="h-4 w-4" /></button>
            )}
            <button onClick={skipNext}><SkipForward className="h-4 w-4" /></button>
          </div>
        </FacetContainer>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create FullPlayer.tsx**
  Implement overlay player using `<FacetModal>` layer with waveform details and volume controls:
  ```typescript
  "use client";

  import React from "react";
  import { useIxMedia } from "~/hooks/useIxMedia";
  import { FacetModal } from "~/components/ui/facet-container";
  import { X, Play, Pause, SkipForward, SkipBack } from "lucide-react";

  export function FullPlayer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { activeTrack, isPlaying, pauseTrack, resumeTrack, skipNext, skipPrevious, volume, changeVolume } = useIxMedia();

    if (!isOpen || !activeTrack) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <FacetModal className="w-full max-w-lg p-6 flex flex-col gap-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground"><X className="h-4 w-4" /></button>
          <div className="flex flex-col items-center gap-4 text-center">
            {activeTrack.coverArt && (
              <img src={activeTrack.coverArt} className="w-48 h-48 rounded-xl object-cover shadow-lg" alt="Cover" />
            )}
            <div>
              <h2 className="text-lg font-bold">{activeTrack.title}</h2>
              <p className="text-sm text-muted-foreground">{activeTrack.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6">
            <button onClick={skipPrevious}><SkipBack className="h-5 w-5" /></button>
            {isPlaying ? (
              <button onClick={pauseTrack} className="p-3 bg-white/10 rounded-full"><Pause className="h-6 w-6" /></button>
            ) : (
              <button onClick={resumeTrack} className="p-3 bg-white/10 rounded-full"><Play className="h-6 w-6" /></button>
            )}
            <button onClick={skipNext}><SkipForward className="h-5 w-5" /></button>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-muted-foreground">Volume</label>
            <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => changeVolume(Number(e.target.value))} className="w-full accent-primary" />
          </div>
        </FacetModal>
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit Task 4 changes**
  ```bash
  git add src/components/media/MiniPlayer.tsx src/components/media/FullPlayer.tsx
  git commit -m "feat(media): create Facet UI players for mini and full views"
  ```
