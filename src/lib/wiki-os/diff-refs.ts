/**
 * diff-refs.ts — MediaWiki's `?oldid=` / `?diff=` pair as the two revisions the diff view compares.
 *
 * `?diff=<ref>&oldid=<ref>` compares the two; `?diff=prev&oldid=N` is what revision N changed,
 * `?diff=next&oldid=N` the change after N and `?diff=cur&oldid=N` N against the current text.
 * `?diff=<ref>` alone is what that revision changed. `next` and `cur` need the page's history.
 */

export interface DiffSpec {
  oldid: string | null;
  /** A revision reference, or "prev", "next" or "cur". */
  diff: string;
}

export interface DiffRevisions {
  /** The older revision; undefined means "the revision before `torev`". */
  fromrev: string | undefined;
  torev: string;
}

/** Whether resolving `spec` needs the page's revision list (`next` and `cur`). */
export function diffNeedsHistory(spec: DiffSpec): boolean {
  return spec.diff === "next" || spec.diff === "cur";
}

/**
 * The revisions `spec` compares, or null when it names none (`?diff=prev` with no `oldid`, `next`
 * after the newest revision, a history with no revision). `history` lists the page's revision
 * references newest first; it is only read for `next` and `cur`.
 */
export function resolveDiffRefs(spec: DiffSpec, history: readonly string[]): DiffRevisions | null {
  const { oldid, diff } = spec;
  switch (diff) {
    case "prev":
      return oldid === null ? null : { fromrev: undefined, torev: oldid };
    case "next": {
      const index = oldid === null ? -1 : history.indexOf(oldid);
      const next = index > 0 ? history[index - 1] : undefined;
      return oldid !== null && next !== undefined ? { fromrev: oldid, torev: next } : null;
    }
    case "cur": {
      const current = history[0];
      return current === undefined ? null : { fromrev: oldid ?? undefined, torev: current };
    }
    default:
      return { fromrev: oldid ?? undefined, torev: diff };
  }
}
