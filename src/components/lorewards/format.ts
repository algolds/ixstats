import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { articleHref } from "~/lib/wiki-os/wiki-path";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";

export const CONTEST_LABEL: Record<LorewardType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const PLACE_LABEL: Record<LorewardPlace, string> = {
  winner: "winner",
  "runner-up": "runner-up",
};

/** The WikiOS article path for a title; a title MediaWiki would refuse falls back to its plain encoding. */
function articlePath(title: string): string {
  const canon = canonicalizeTitle(title);
  return canon ? articleHref(canon) : `/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** The wiki page of an IxWiki user. */
export const wikiUserHref = (name: string) => articlePath(`User:${name}`);

/** The wiki article with this title. */
export const wikiPageHref = (title: string) => articlePath(title);

/** Where the Vault keeps a player's trophies (`ixstatesLinkHref` makes it a link in either build). */
export const VAULT_TROPHIES_PATH = "/vault/achievements?tab=lorewards";

/** The Lorewards contest page of WikiOS. */
export const CONTEST_PATH = "/util/lorewards";

/** The badge tone of a contest type; anything else (annual) is neutral. */
export function contestTone(type: string): "warning" | "info" | "secondary" | "default" {
  if (type === "daily") return "warning";
  if (type === "weekly") return "info";
  if (type === "monthly") return "secondary";
  return "default";
}

export const isContest = (type: string): type is LorewardType =>
  type === "daily" || type === "weekly" || type === "monthly";
