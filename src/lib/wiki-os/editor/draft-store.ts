// src/lib/wiki-os/draft-store.ts
// Client-side autosave & draft persistence for WikiOS Canvas editor and Halo Wiki workspace.
//
// Drafts are kept per signed-in user (plan 416): the key is `wikios_draft:<userId>:<source>:<title>`, so
// two people sharing a browser never see each other's unpublished text. A signed-out editor has no draft:
// nothing is stored and nothing is read. Drafts written before that (`wikios_draft:<source>:<title>`, and
// the older `wikios-draft-*` keys) belong to nobody; the first signed-in user to read or clear one of
// them takes it over, once (`claimUnowned`).

import { WIKI_SOURCES } from "../config";

/** The signed-in user a draft belongs to; null or undefined while signed out. */
export type DraftOwner = string | null | undefined;

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

const normalizeTitle = (title: string): string => title.replace(/ /g, "_");

function ownerPrefix(owner: string): string {
  return `${STORAGE_PREFIX}${owner}:`;
}

function draftKey(owner: string, title: string, source = "ixwiki"): string {
  return `${ownerPrefix(owner)}${source}:${normalizeTitle(title)}`;
}

/** The key a draft had before drafts were kept per user. */
function unownedKey(title: string, source: string): string {
  return `${STORAGE_PREFIX}${source}:${normalizeTitle(title)}`;
}

/** A stored `wikios_draft:` key of the format before drafts were per user: its first segment is a wiki source, never a user id. */
function parseUnownedKey(key: string): { source: string; title: string } | null {
  if (!key.startsWith(STORAGE_PREFIX)) return null;
  const rest = key.slice(STORAGE_PREFIX.length);
  const source = Object.keys(WIKI_SOURCES).find((candidate) => rest.startsWith(`${candidate}:`));
  return source ? { source, title: rest.slice(source.length + 1) } : null;
}

/**
 * The revision each open editor was loaded from, by draft key. `saveDraft` stamps it on every draft
 * it writes, whichever editor component calls it, so a draft always knows what it was based on.
 */
const editorBases = new Map<string, string | null>();

/** Records that `owner`'s editor for `title` is editing the page as of `revisionRef` (null: a new page). */
export function setEditorBase(
  owner: DraftOwner,
  title: string,
  revisionRef: string | null,
  source = "ixwiki"
): void {
  if (owner) editorBases.set(draftKey(owner, title, source), revisionRef);
}

/** The editor for `title` was closed. */
export function clearEditorBase(owner: DraftOwner, title: string, source = "ixwiki"): void {
  if (owner) editorBases.delete(draftKey(owner, title, source));
}

/**
 * Reads a draft written by older code. The visual editor's "Save draft" used to store the page's
 * wikitext in the `html` field; a draft with no `version` (older code never wrote one), in visual
 * mode, with `html` and no `wikitext`, is returned with that text as `wikitext`. The decision is the
 * draft's version alone: wikitext that happens to start with `<div>` or `<blockquote>` is still wikitext.
 */
function migrateDraft(draft: WikiEditorDraft): WikiEditorDraft {
  const { html } = draft;
  if (draft.version !== undefined || draft.mode !== "visual" || draft.wikitext !== undefined) return draft;
  if (html === undefined) return draft;
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
 * Save an in-progress editor draft to client storage, under `owner`. Returns whether it was stored:
 * false for a signed-out editor (drafts are per account) or when the browser refused the write.
 */
export function saveDraft(owner: DraftOwner, draft: Omit<WikiEditorDraft, "savedAt">): boolean {
  if (!owner || typeof window === "undefined") return false;
  try {
    const key = draftKey(owner, draft.title, draft.source);
    const base = draft.baseRevisionRef === undefined ? editorBases.get(key) : draft.baseRevisionRef;
    const payload: WikiEditorDraft = {
      ...draft,
      ...(base === undefined ? {} : { baseRevisionRef: base }),
      version: DRAFT_VERSION,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn("[WikiDraftStore] Failed to save draft:", err);
    return false;
  }
}

/** A draft in the current format for `title`, as the legacy key `wikios-draft-*` held it. */
function legacyDraft(
  title: string,
  source: string,
  body: Pick<WikiEditorDraft, "mode" | "html" | "wikitext">
): WikiEditorDraft {
  return { title, source, ...body, version: DRAFT_VERSION, savedAt: Date.now() };
}

/**
 * Moves a draft that belongs to nobody (the key format before drafts were per user, then the older
 * `wikios-draft-*` keys) to `owner`, once. A draft `owner` already has wins: the old one is left alone.
 */
function claimUnowned(owner: string, title: string, source: string): void {
  const key = draftKey(owner, title, source);
  if (window.localStorage.getItem(key) !== null) return;

  const oldKey = unownedKey(title, source);
  const stored = window.localStorage.getItem(oldKey);
  if (stored !== null) {
    window.localStorage.setItem(key, stored);
    window.localStorage.removeItem(oldKey);
    return;
  }
  // The legacy mirrors were only ever written for IxWiki pages.
  if (source !== "ixwiki") return;
  const html = window.localStorage.getItem(`${LEGACY_HTML_PREFIX}${title}`);
  if (html) {
    window.localStorage.setItem(key, JSON.stringify(legacyDraft(title, source, { mode: "visual", html })));
    window.localStorage.removeItem(`${LEGACY_HTML_PREFIX}${title}`);
    return;
  }
  const wikitext = window.localStorage.getItem(`${LEGACY_SOURCE_PREFIX}${title}`);
  if (wikitext) {
    window.localStorage.setItem(
      key,
      JSON.stringify(legacyDraft(title, source, { mode: "source", wikitext }))
    );
    window.localStorage.removeItem(`${LEGACY_SOURCE_PREFIX}${title}`);
  }
}

/**
 * Retrieve `owner`'s existing draft for a page, if present. A signed-out reader has none.
 */
export function getDraft(owner: DraftOwner, title: string, source = "ixwiki"): WikiEditorDraft | null {
  if (!owner || typeof window === "undefined") return null;
  try {
    claimUnowned(owner, title, source);
    const raw = window.localStorage.getItem(draftKey(owner, title, source));
    return raw ? migrateDraft(JSON.parse(raw) as WikiEditorDraft) : null;
  } catch {
    return null;
  }
}

/**
 * Delete `owner`'s draft after successful publication or explicit discard (and any draft of the
 * page that belonged to nobody, which `owner` would otherwise inherit next time).
 */
export function clearDraft(owner: DraftOwner, title: string, source = "ixwiki"): void {
  if (!owner || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(owner, title, source));
    window.localStorage.removeItem(unownedKey(title, source));
    if (source === "ixwiki") {
      window.localStorage.removeItem(`${LEGACY_HTML_PREFIX}${title}`);
      window.localStorage.removeItem(`${LEGACY_SOURCE_PREFIX}${title}`);
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Check if `owner` has an active draft for a page.
 */
export function hasDraft(owner: DraftOwner, title: string, source = "ixwiki"): boolean {
  return getDraft(owner, title, source) !== null;
}

/** The (title, source) of every draft in storage that belongs to nobody. */
function unownedDrafts(): Array<{ title: string; source: string }> {
  const found: Array<{ title: string; source: string }> = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const parsed = parseUnownedKey(key);
    if (parsed) found.push(parsed);
    else if (key.startsWith(LEGACY_HTML_PREFIX)) {
      found.push({ title: key.slice(LEGACY_HTML_PREFIX.length), source: "ixwiki" });
    } else if (key.startsWith(LEGACY_SOURCE_PREFIX)) {
      found.push({ title: key.slice(LEGACY_SOURCE_PREFIX.length), source: "ixwiki" });
    }
  }
  return found;
}

/**
 * List `owner`'s saved drafts across all pages, newest first. A signed-out reader has none.
 */
export function listDrafts(owner: DraftOwner): WikiEditorDraft[] {
  if (!owner || typeof window === "undefined") return [];
  const drafts: WikiEditorDraft[] = [];

  try {
    for (const { title, source } of unownedDrafts()) claimUnowned(owner, title, source);

    const prefix = ownerPrefix(owner);
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      const raw = key?.startsWith(prefix) ? window.localStorage.getItem(key) : null;
      if (!raw) continue;
      try {
        drafts.push(migrateDraft(JSON.parse(raw) as WikiEditorDraft));
      } catch {
        /* invalid JSON */
      }
    }
  } catch {
    /* ignore */
  }

  return drafts.sort((a, b) => b.savedAt - a.savedAt);
}
