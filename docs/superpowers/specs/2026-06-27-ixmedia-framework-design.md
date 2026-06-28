# Design Spec — IxMedia Unified Media Framework

This document specifies the architecture, file layout, database schema, and component composition for **IxMedia**, the unified media subsystem of IxStates.

---

## 1. Overview & Vision
IxMedia provides a cohesive operating system for all audio experiences across IxStates—including music, national anthems, speeches, podcasts, audiobooks, radio, ambient soundscapes, and text-to-speech (TTS) narrations.
* **Coherence**: A single persistent playback environment that coordinates play state, queue order, and preferences across the entire platform.
* **Apple-Inspired Aesthetics**: Uses the physics-driven, depth-based **Facet** design language (frosted glass, pointer sheens, levels 1-4 Z-depth).

---

## 2. Technical Architecture

### A. Custom TypeScript Playback Engine (`IxMediaEngine.ts`)
* Built on top of native HTML5 `HTMLAudioElement` and browser `AudioContext`.
* Runs outside React's render loop to avoid node duplication, stuttering, and stale closure bugs.
* Exposes standard play, pause, seek, volume, speed adjustments, and custom playback event streams.

### B. Persistent State Synchronization
* Exposes a global `<IxMediaProvider />` context wrapped around the root layout.
* Synchronizes track queue, active track index, and playback progress to `localStorage` under `ixmedia:session` for session persistence.
* Syncs user settings (volume level, speed) under `ixmedia:settings`.

### C. Waveform Pre-Calculation & Rendering
* To avoid client-side audio decoding latency, uploads or first-time requests decode the audio on the server once, extracting a normalized 150-value peak array.
* Saved as a JSON integer array in the database and drawn dynamically via a lightweight `<WaveformVisualizer />` SVG element.

### D. Audio Overrides & Ducking (Onoma Pronunciations)
* Short pronunciation playbacks bypass the main queue.
* If main audio is playing, the engine temporarily ducks the active track's volume to `10%` over 200ms, plays the pronunciation using a secondary Audio node, and fades the main track back to 100% over 300ms.

---

## 3. Database Schema (`prisma/schema/media.prisma`)

We will store metadata for persistent music tracks, podcasts, and histories:

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
  peaks       Int[]     // 150-value peak array
  tags        String[]
  metadata    Json?     // Chapters, voices
  
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

---

## 4. UI Components & Facet Design Integration

All components are styled using the **Facet** design system wrappers to ensure light/dark/sepia theme compliance:

* **Mini Player (`MiniPlayer.tsx`)**:
  - Frosted glass bar sticky-positioned at the bottom viewport.
  - Formed using `<FacetContainer variant="base" depth={3} interactive="hover">` to lift slightly on user hover.
* **Full Player (`FullPlayer.tsx`)**:
  - Slides up as a fullscreen glass overlay sheet.
  - Constructed using `<FacetModal>` (depth level 4) to overlay all content.
* **Queue Panel (`QueuePanel.tsx`)**:
  - Displays inside a side-drawer or tab panel.
  - Composed using `<FacetCard>` (depth level 1) list items with spring-based drag transitions.
* **Waveform Visualizer (`WaveformVisualizer.tsx`)**:
  - Renders custom SVG paths matching the peak heights, coloring the played bars with the active theme primary color.

---

## 5. Directory Mapping

```text
src/
├── lib/
│   └── media/
│       ├── IxMediaEngine.ts
│       ├── peak-generator.ts
│       └── types.ts
├── hooks/
│   └── useIxMedia.ts
├── components/
│   ├── ui/
│   │   └── facet-container.tsx    # Already exists
│   └── media/
│       ├── MediaContext.tsx
│       ├── MiniPlayer.tsx
│       ├── FullPlayer.tsx
│       ├── QueuePanel.tsx
│       ├── WaveformVisualizer.tsx
│       └── TranscriptViewer.tsx
prisma/
└── schema/
    └── media.prisma
```
