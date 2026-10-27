/**
 * types.ts — the shapes shared by the MediaWiki export-0.11 writer, reader and importer.
 */

/** Who made a revision: a named account, an anonymous IP, or a contributor hidden in the source. */
export type Contributor =
  { username: string; id: number | null } | { ip: string } | { deleted: true };

/** One `<revision>`. The writer and the reader use the same shape, so a dump round-trips. */
export interface XmlRevision {
  /** MediaWiki `rev_id`; null when the source has none. */
  id: number | null;
  parentId: number | null;
  /** `YYYY-MM-DDTHH:MM:SSZ`, exactly as the dump spells it. */
  timestamp: string;
  contributor: Contributor;
  minor: boolean;
  /** The edit summary; null when absent, empty or hidden (`<comment deleted="deleted" />`). */
  comment: string | null;
  /** The summary was deleted by an administrator: `<comment deleted="deleted" />`. */
  commentDeleted: boolean;
  model: string;
  format: string;
  /**
   * The wikitext; null when it is not available: deleted (`textDeleted`), or never fetched (an
   * unfilled placeholder: an empty `<text bytes="N" />` with a size but no content).
   */
  text: string | null;
  /** The text was deleted by an administrator: `<text deleted="deleted" />`. */
  textDeleted: boolean;
  /**
   * `<text bytes>`. The writer computes it from `text` and only uses this value when `text` is
   * null (the size of a text that is not available); the reader reports the attribute as written.
   */
  bytes?: number | null;
  /** `<sha1>`, the writer only uses it when `text` is null; the reader reports the dump's value. */
  sha1?: string | null;
}

/** One `<namespace key case>name</namespace>` of `<siteinfo>`. */
export interface SiteInfoNamespace {
  key: number;
  case: string;
  /** Empty for the main namespace. */
  name: string;
}

/** `<siteinfo>`: what a dump says about the wiki it came from. */
export interface SiteInfo {
  sitename: string;
  dbname: string;
  base: string;
  generator: string;
  case: string;
  namespaces: SiteInfoNamespace[];
}
