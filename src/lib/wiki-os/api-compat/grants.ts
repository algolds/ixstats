/**
 * grants.ts — bot password grants (plan 410).
 *
 * A bot password carries MediaWiki grants; a login may use only the rights those grants give (and
 * only those its user holds): effective rights = the user's rights ∩ the grants' rights. `basic` is
 * always in force, as in MediaWiki. The table maps each grant to the WikiOS rights it allows
 * (`rights.ts`); a right WikiOS does not know is left out.
 */

import type { Right } from "~/lib/wiki-os/rights";

export const BOT_GRANTS = [
  "basic",
  "highvolume",
  "editpage",
  "editprotected",
  "createeditmovepage",
  "delete",
  "protect",
  "rollback",
  "blockusers",
  "import",
  "uploadfile",
  "uploadeditmovefile",
] as const;
export type BotGrant = (typeof BOT_GRANTS)[number];

export const GRANT_RIGHTS: Readonly<Record<BotGrant, readonly Right[]>> = {
  basic: ["read", "editsemiprotected", "autopatrol", "nominornewtalk", "unwatchedpages", "skipcaptcha"],
  highvolume: ["bot", "apihighlimits", "noratelimit", "markbotedits"],
  editpage: ["edit"],
  editprotected: ["editprotected"],
  createeditmovepage: [
    "createpage",
    "createtalk",
    "move",
    "move-rootuserpages",
    "move-subpages",
    "suppressredirect",
  ],
  delete: ["delete", "undelete", "deletedhistory", "deletedtext", "browsearchive"],
  // Setting a sysop-level protection needs `editprotected`, which MediaWiki's protect grant carries too.
  protect: ["protect", "editprotected"],
  // A rollback is also an edit (permissions.ts), so a bot needs `editpage` next to this grant.
  rollback: ["rollback"],
  blockusers: ["block"],
  import: ["import", "importupload"],
  // MediaWiki's two upload grants: a new file, and (with `editpage`) a new version of a file or its page moved
  uploadfile: ["upload"],
  uploadeditmovefile: ["upload", "reupload", "movefile"],
};

/** What each grant means, for the Special:BotPasswords form. */
export const GRANT_DESCRIPTIONS: Readonly<Record<BotGrant, string>> = {
  basic: "Basic rights (always granted): read pages",
  highvolume: "High-volume (bot) access: bot flag, higher API limits, no rate limit",
  editpage: "Edit existing pages",
  editprotected: "Edit protected pages",
  createeditmovepage: "Create, edit and move pages",
  delete: "Delete and undelete pages",
  protect: "Protect and unprotect pages",
  rollback: "Roll back edits (also needs the edit grant)",
  blockusers: "Block and unblock users",
  import: "Import pages",
  uploadfile: "Upload new files (also needs the edit and create grants: a new file gets its page)",
  uploadeditmovefile: "Upload, replace and move files",
};

export function isBotGrant(value: string): value is BotGrant {
  return (BOT_GRANTS as readonly string[]).includes(value);
}

/** The rights the grants allow (`basic` included whether or not it is listed). Unknown grants allow nothing. */
export function rightsForGrants(grants: readonly string[]): Set<Right> {
  const rights = new Set<Right>(GRANT_RIGHTS.basic);
  for (const grant of grants) {
    if (isBotGrant(grant)) for (const right of GRANT_RIGHTS[grant]) rights.add(right);
  }
  return rights;
}
