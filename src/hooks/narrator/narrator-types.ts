// src/hooks/narrator/narrator-types.ts
// Shared types for WikiOS Kokoro TTS article narration

export interface PlaybackBlock {
  id: string; // DOM element ID or data-index key
  text: string; // Cleaned plain text to speak
  type: "heading" | "prose";
  sectionId?: string; // Nearest parent heading section ID
  element: HTMLElement;
}

export interface NarratorState {
  isPlaying: boolean;
  activeBlockIndex: number;
  totalBlocks: number;
  activeText: string;
  activeSectionTitle: string;
  speed: number;
  voice: string;
}
