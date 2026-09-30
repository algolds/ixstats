// src/lib/wiki-os/draft-store.ts
// Client-side autosave & draft persistence for WikiOS Canvas editor and Halo Wiki workspace.
// Supports canonical structured storage with full fallback for legacy storage keys.

export interface WikiEditorDraft {
  readonly title: string;
  readonly source: string;
  readonly wikitext?: string;
  readonly html?: string;
  readonly mode: "visual" | "source";
  /**
   * The revision (`revisionRef`) the draft was started from; null for a page that did not exist.
   * Absent on drafts saved before this field existed, which are treated as based on an unknown revision.
   */
  readonly baseRevisionRef?: string | null;
  /** Draft format: 2 is written by this code; drafts without it were written by older code (see `migrateDraft`). */
  readonly version?: number;
  readonly savedAt: number;
}

const STORAGE_PREFIX = "wikios_draft:";
const DRAFT_VERSION = 2;
const LEGACY_HTML_PREFIX = "wikios-draft-html-";
const LEGACY_SOURCE_PREFIX = "wikios-draft-";

function draftKey(title: string, source = "ixwiki"): string {
  return `${STORAGE_PREFIX}${source}:${title.replace(/ /g, "_")}`;
}

/**
 * The revision each open editor was loaded from, by draft key. `saveDraft` stamps it on every draft
 * it writes, whichever editor component calls it, so a draft always knows what it was based on.
 */
const editorBases = new Map<string, string | null>();

/** Records that the editor for `title` is editing the page as of `revisionRef` (null: a new page). */
export function setEditorBase(title: string, revisionRef: string | null, source = "ixwiki"): void {
  editorBases.set(draftKey(title, source), revisionRef);
}

/** The editor for `title` was closed. */
export function clearEditorBase(title: string, source = "ixwiki"): void {
  editorBases.delete(draftKey(title, source));
}

/** Rendered article HTML starts with a block element; wikitext hardly ever does. */
const RENDERED_HTML = /^\s*<(?:p|h[1-6]|div|table|ul|ol|blockquote|figure|section|span)\b/i;

/**
 * Reads a draft written by older code. The visual editor's "Save draft" used to store the page's
 * wikitext in the `html` field; such a draft (no `version`, visual mode, `html` that is not rendered
 * HTML, no `wikitext`) is returned with that text as `wikitext`.
 */
function migrateDraft(draft: WikiEditorDraft): WikiEditorDraft {
  const { html } = draft;
  if (draft.version !== undefined || draft.mode !== "visual" || draft.wikitext !== undefined) return draft;
  if (html === undefined || RENDERED_HTML.test(html)) return draft;
  const { html: _html, ...rest } = draft;
  return { ...rest, wikitext: html };
}

/**
 * Whether `draft` was started from a different revision than the current one, i.e. the page changed
 * after the draft was written and restoring it silently would replace fresher text.
 * `currentRevisionRefs` is every reference that names the current revision (its row id and its
 * MediaWiki rev_id once stamped: a draft written before the stamp is still based on it); empty for
 * a page with no revision.
 */
export function isDraftStale(draft: WikiEditorDraft, currentRevisionRefs: readonly string[]): boolean {
  const base = draft.baseRevisionRef ?? null;
  return base === null ? currentRevisionRefs.length > 0 : !currentRevisionRefs.includes(base);
}

/**
 * Save an in-progress editor draft to client storage.
 */
export function saveDraft(draft: Omit<WikiEditorDraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const key = draftKey(draft.title, draft.source);
    const base = draft.baseRevisionRef === undefined ? editorBases.get(key) : draft.baseRevisionRef;
    const payload: WikiEditorDraft = {
      ...draft,
      ...(base === undefined ? {} : { baseRevisionRef: base }),
      version: DRAFT_VERSION,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));

    // Mirror to legacy keys for compatibility
    if (draft.mode === "visual" && draft.html) {
      window.localStorage.setItem(`${LEGACY_HTML_PREFIX}${draft.title}`, draft.html);
    } else if (draft.mode === "source" && draft.wikitext) {
      window.localStorage.setItem(`${LEGACY_SOURCE_PREFIX}${draft.title}`, draft.wikitext);
    }
  } catch (err) {
    console.warn("[WikiDraftStore] Failed to save draft:", err);
  }
}

/**
 * Retrieve an existing draft for a page, if present.
 */
export function getDraft(title: string, source = "ixwiki"): WikiEditorDraft | null {
  if (typeof window === "undefined") return null;
  try {
    // 1. Try canonical structured draft
    const key = draftKey(title, source);
    const raw = window.localStorage.getItem(key);
    if (raw) {
      return migrateDraft(JSON.parse(raw) as WikiEditorDraft);
    }

    // 2. Fallback to legacy visual draft
    const legacyHtml = window.localStorage.getItem(`${LEGACY_HTML_PREFIX}${title}`);
    if (legacyHtml) {
      return {
        title,
        source,
        html: legacyHtml,
        mode: "visual",
        savedAt: Date.now(),
      };
    }

    // 3. Fallback to legacy source draft
    const legacyWikitext = window.localStorage.getItem(`${LEGACY_SOURCE_PREFIX}${title}`);
    if (legacyWikitext) {
      return {
        title,
        source,
        wikitext: legacyWikitext,
        mode: "source",
        savedAt: Date.now(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Delete a draft after successful publication or explicit discard.
 */
export function clearDraft(title: string, source = "ixwiki"): void {
  if (typeof window === "undefined") return;
  try {
    const key = draftKey(title, source);
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(`${LEGACY_HTML_PREFIX}${title}`);
    window.localStorage.removeItem(`${LEGACY_SOURCE_PREFIX}${title}`);
  } catch {
    /* best-effort */
  }
}

/**
 * Check if an active draft exists for a page.
 */
export function hasDraft(title: string, source = "ixwiki"): boolean {
  return getDraft(title, source) !== null;
}

/**
 * List all saved drafts across all pages, deduplicated by normalized title.
 */
export function listDrafts(): WikiEditorDraft[] {
  if (typeof window === "undefined") return [];
  const draftsMap = new Map<string, WikiEditorDraft>();

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;

      // 1. Canonical structured drafts
      if (key.startsWith(STORAGE_PREFIX)) {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = migrateDraft(JSON.parse(raw) as WikiEditorDraft);
            const norm = parsed.title.replace(/ /g, "_");
            draftsMap.set(norm, parsed);
          } catch {
            /* invalid JSON */
          }
        }
      }
      // 2. Legacy visual drafts
      else if (key.startsWith(LEGACY_HTML_PREFIX)) {
        const title = key.substring(LEGACY_HTML_PREFIX.length);
        const norm = title.replace(/ /g, "_");
        if (!draftsMap.has(norm)) {
          const html = window.localStorage.getItem(key);
          if (html) {
            draftsMap.set(norm, {
              title,
              source: "ixwiki",
              html,
              mode: "visual",
              savedAt: Date.now(),
            });
          }
        }
      }
      // 3. Legacy source drafts
      else if (key.startsWith(LEGACY_SOURCE_PREFIX) && !key.startsWith(LEGACY_HTML_PREFIX)) {
        const title = key.substring(LEGACY_SOURCE_PREFIX.length);
        const norm = title.replace(/ /g, "_");
        if (!draftsMap.has(norm)) {
          const wikitext = window.localStorage.getItem(key);
          if (wikitext) {
            draftsMap.set(norm, {
              title,
              source: "ixwiki",
              wikitext,
              mode: "source",
              savedAt: Date.now(),
            });
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  return Array.from(draftsMap.values()).sort((a, b) => b.savedAt - a.savedAt);
}
