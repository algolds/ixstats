// src/components/halo/plugins/wiki/types.ts
// Shared types, constants, and utilities for the Halo Wiki plugin.

import { timeAgo } from "~/lib/format/compact";

export const NARRATOR_ACCENT = "#3b82f6";

export const NARRATOR_SPEEDS = [0.8, 1.0, 1.25, 1.5, 2.0];

export const NARRATOR_VOICE_LABELS: Record<string, string> = {
  af_heart: "Female US - Soft",
  af_bella: "Female US - Bright",
  af_nicole: "Female US - Whisper",
  af_sarah: "Female US - Warm",
  am_adam: "Male US - Clear",
  am_michael: "Male US - Deep",
  bf_emma: "Female UK - Noble",
  bf_isabella: "Female UK - Expressive",
  bm_george: "Male UK - Gravel",
  bm_lewis: "Male UK - Mellow",
};

export interface LocalDraft {
  title: string;
  type: "source" | "visual";
}

export interface PausedSession {
  title: string;
  scrollPercent: number;
  updatedAt: number;
}

export const formatTimeAgo = (timestamp: number): string => timeAgo(timestamp);
