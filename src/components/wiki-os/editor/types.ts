// src/components/wiki-os/editor/types.ts
// Shared TypeScript types for WikiOS Visual and Source editors.

export type WikiEditorMode = "visual" | "source";
export type SaveActionType = "publish" | "session";

export interface StashEntity {
  id: string;
  name: string;
  isDefault?: boolean;
  itemCount?: number;
}

export interface StashItemEntity {
  id: string;
  pageTitle: string;
  addedAt?: string | Date;
  notes?: string | null;
}

export interface WikimediaImageMeta {
  title: string;
  url?: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  size?: number;
}

export interface EditorCursorPos {
  line: number;
  col: number;
}

export interface EditorDocStats {
  wordCount: number;
  lineCount: number;
  charCount?: number;
}
