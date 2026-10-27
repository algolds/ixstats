// src/app/labs/onoma/components/sections/batch/batch-constants.ts
// Result interface for the Onoma Batch Generation Workbench & Synthesis Table

export interface BatchNameResult {
  name: string;
  ipa: string;
  syllables: number;
  /** Null when the corpus model cannot score the name. */
  perplexity: number | null;
  length: number;
}
