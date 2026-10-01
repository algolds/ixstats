// src/lib/wiki-os/namespace-policy.ts
// Which MediaWiki namespaces a WikiOS user may write to.
//
// Every WikiOS write is mirrored to MediaWiki by one dedicated bot account (see services/mirror-worker.ts),
// so MediaWiki's own per-user rights never apply to it. This server-side policy, which `permissions.ts`
// runs before every action, is what stops a signed-in user from saving `MediaWiki:Common.js`,
// `Module:*` or `Template:*` through that account. It asks for MediaWiki rights (see `rights.ts`):
//
// Ordinary signed-in users may edit:
//   - main / article namespace (0)
//   - talk namespaces: Talk, User talk, Project talk, File talk, Template talk, Help talk,
//     Category talk (odd ids 1-15) and Campaign talk (461); plain discussion text, never executed
//   - their OWN User: page and its subpages, when they have a verified linked wiki account,
//     except script/style/data subpages (.js, .css, .json, .less), which are interface pages
// Interface pages need the matching interface-admin right: MediaWiki:*.css/.js/.json need
// editsitecss/editsitejs/editsitejson, User:*/*.css/.js/.json need editusercss/edituserjs/edituserjson,
// and the other MediaWiki: pages need editinterface.
// Everything else needs `editprotected` (the sysop group): Project/IxWiki:, File:, Template:, Help:,
// Category:, Module:, Campaign:, Gadget*, Widget*, MediaWiki/Module/Gadget talk, other users' pages.
// Special: and Media: are never editable, by anyone.

import { wikiosConfig } from "~/lib/wiki-os/config";
import type { Right } from "~/lib/wiki-os/rights";

/** Canonical (lower-cased, space-separated) namespace names and aliases -> namespace id. */
const NAMESPACE_IDS: ReadonlyMap<string, number> = new Map(
  Object.entries({
    media: -2,
    special: -1,
    talk: 1,
    user: 2,
    "user talk": 3,
    project: 4,
    [wikiosConfig.projectNamespace.toLowerCase()]: 4,
    "project talk": 5,
    [`${wikiosConfig.projectNamespace.toLowerCase()} talk`]: 5,
    file: 6,
    image: 6,
    "file talk": 7,
    "image talk": 7,
    mediawiki: 8,
    "mediawiki talk": 9,
    template: 10,
    "template talk": 11,
    help: 12,
    "help talk": 13,
    category: 14,
    "category talk": 15,
    campaign: 460,
    "campaign talk": 461,
    module: 828,
    "module talk": 829,
    gadget: 2300,
    "gadget talk": 2301,
    "gadget definition": 2302,
    "gadget definition talk": 2303,
    widget: 274,
    "widget talk": 275,
    topic: 2600,
  })
);

/** Talk namespaces ordinary users may edit (MediaWiki/Module/Gadget talk are left to admins). */
const USER_EDITABLE_TALK_IDS: ReadonlySet<number> = new Set([1, 3, 5, 7, 11, 13, 15, 461]);

/** Subpage suffixes that MediaWiki treats as script/style/data (interface) content. */
const INTERFACE_SUFFIX = /\.(js|css|json|less)$/i;

/** The right that edits a script (.js), style (.css, .less) or data (.json) page, site-wide or in user space. */
const INTERFACE_RIGHTS: Readonly<Record<"site" | "user", Readonly<Record<string, Right>>>> = {
  site: { js: "editsitejs", css: "editsitecss", less: "editsitecss", json: "editsitejson" },
  user: { js: "edituserjs", css: "editusercss", less: "editusercss", json: "edituserjson" },
};

/** The right a script/style/data page under `base` needs, or null when `base` is ordinary text. */
function interfaceRight(base: string, area: "site" | "user"): Right | null {
  const suffix = INTERFACE_SUFFIX.exec(base)?.[1]?.toLowerCase();
  return (suffix && INTERFACE_RIGHTS[area][suffix]) || null;
}

/** Unicode spaces MediaWiki folds into a plain space when normalising titles. */
const TITLE_SPACES = /[\u00A0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000_]+/g;
/** Bidirectional and zero-width marks MediaWiki strips from titles. */
const TITLE_INVISIBLES = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
/** MediaWiki decodes HTML character references in titles (`Template&#58;Foo` is `Template:Foo`). */
const CHARACTER_REFERENCE = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i;

export interface ParseWikiTitleOptions {
  /**
   * Whether to recognise a namespace prefix (default true). A wiki other than IxWiki has its own
   * namespaces, so its titles are only normalised and keep any prefix as plain text.
   */
  namespaces?: boolean;
}

export interface ParsedWikiTitle {
  /** Namespace id (0 = main). */
  namespaceId: number;
  /** Title without its namespace prefix, spaces not underscores. */
  base: string;
}

/**
 * Split a page title the way MediaWiki does. Returns null for a title that cannot be judged
 * (empty, or hiding a namespace prefix behind HTML character references).
 */
export function parseWikiTitle(
  rawTitle: string,
  { namespaces = true }: ParseWikiTitleOptions = {}
): ParsedWikiTitle | null {
  if (CHARACTER_REFERENCE.test(rawTitle)) return null;

  let title = rawTitle
    .replace(TITLE_INVISIBLES, "")
    .replace(TITLE_SPACES, " ")
    .replace(/\s+/g, " ")
    .trim();
  // A leading colon is the "main namespace / no interwiki" escape; MediaWiki drops it.
  title = title.replace(/^(?:\s*:)+\s*/, "");
  if (!title) return null;

  const colon = namespaces ? title.indexOf(":") : -1;
  if (colon > 0) {
    const prefix = title.slice(0, colon).trim().toLowerCase().replace(/\s+/g, " ");
    const namespaceId = NAMESPACE_IDS.get(prefix);
    if (namespaceId !== undefined) {
      return { namespaceId, base: title.slice(colon + 1).trim() };
    }
  }
  return { namespaceId: 0, base: title };
}

/** MediaWiki user-name rules: underscores are spaces, first letter upper-case. */
function normalizeUserName(name: string): string {
  const spaced = name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Whether the page name `base` (no namespace) is `owner`'s own page or one of its subpages. */
export function isOwnUserSpace(base: string, owner: string | null): boolean {
  const rootName = base.split("/")[0] ?? "";
  return Boolean(owner) && normalizeUserName(rootName) === normalizeUserName(owner ?? "");
}

export interface EditPolicyIdentity {
  /** The caller's rights (see `rightsForGroups`). */
  rights: ReadonlySet<Right>;
  /** Verified linked MediaWiki account name, or null when the user has no linked account. */
  linkedWikiUsername: string | null;
}

export type EditPolicyResult = { allowed: true } | { allowed: false; reason: string };

const ALLOWED: EditPolicyResult = { allowed: true };
const deny = (reason: string): EditPolicyResult => ({ allowed: false, reason });

/** A user-space page: the owner's own text, an interface page (its right), or an admin's. */
function checkUserPage(base: string, identity: EditPolicyIdentity): EditPolicyResult {
  const scriptRight = interfaceRight(base, "user");
  if (scriptRight) {
    return identity.rights.has(scriptRight)
      ? ALLOWED
      : deny("Only interface administrators can edit user script, style and data pages.");
  }
  if (isOwnUserSpace(base, identity.linkedWikiUsername)) return ALLOWED;
  return identity.rights.has("editprotected")
    ? ALLOWED
    : deny("You can only edit your own user page (this needs a linked wiki account).");
}

/** Whether `identity` may write to `rawTitle` through WikiOS. */
export function checkEditPolicy(rawTitle: string, identity: EditPolicyIdentity): EditPolicyResult {
  const isAdmin = identity.rights.has("editprotected");
  const parsed = parseWikiTitle(rawTitle);
  if (!parsed) {
    // Admins may hit a title the parser declines (e.g. one with a character reference); MediaWiki
    // itself still validates it. Everyone else is refused.
    return isAdmin && rawTitle.trim() ? ALLOWED : deny("That page title is not valid.");
  }
  const { namespaceId, base } = parsed;

  if (namespaceId < 0) return deny("Special and media pages cannot be edited.");
  if (namespaceId === 0 || USER_EDITABLE_TALK_IDS.has(namespaceId)) return ALLOWED;
  if (namespaceId === 2) return checkUserPage(base, identity);

  if (namespaceId === 8) {
    const right = interfaceRight(base, "site") ?? "editinterface";
    return identity.rights.has(right)
      ? ALLOWED
      : deny(`Editing this MediaWiki page needs the ${right} right.`);
  }

  return isAdmin ? ALLOWED : deny("Only wiki administrators can edit pages in this namespace.");
}
