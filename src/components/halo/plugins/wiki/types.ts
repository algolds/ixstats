// src/components/halo/plugins/wiki/types.ts
// Shared types, constants, and utilities for the Halo Wiki plugin.

import type { WikiPageRef } from "~/lib/wiki-os/page-ref";

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

/** Who reads the article aloud: Kokoro's natural voice (owners, admins and beta testers) or the browser's own voice. */
export type NarratorEngine = "kokoro" | "browser";

/** What the narrator player says about the voice that is reading (or will read), so it never claims the wrong one. */
export function narratorEngineLabel(engine: NarratorEngine, voiceLabel?: string): string {
  if (engine === "browser") return "Read aloud (browser voice)";
  return voiceLabel ? `Natural voice (Kokoro) · ${voiceLabel}` : "Natural voice (Kokoro)";
}

export interface LocalDraft {
  title: string;
  type: "source" | "visual";
}

/** Reading progress for a page, with its wiki (entries saved before sources were recorded have none: IxWiki). */
export interface PausedSession extends WikiPageRef {
  scrollPercent: number;
  updatedAt: number;
}
