/**
 * The two sides of a collision, as the conflict machinery names and reaches them: which wiki a side is, the author
 * WikiOS's own conflict writes go under, and the classic user talk page an overwritten author is told on.
 *
 * Pure for now (no database): the article repository imports it.
 */
import type { NoticeRecipient, WikiSide } from "./conflict-rule";

/** The author of WikiOS's own conflict writes (talk notes, trail edits); MediaWiki shows it as `wikios>WikiOS`. */
export const CONFLICT_NOTICE_AUTHOR = "WikiOS";

/** The wiki a side's save was made on, as the notices name it. */
export function wikiName(side: WikiSide): string {
  return side === "wikios" ? "WikiOS" : "classic MediaWiki";
}

/** The classic user talk page a recipient is told on: their classic name's, else their address's; null for neither. */
export function talkPageTitle(
  recipient: Pick<NoticeRecipient, "classicName" | "ip">
): string | null {
  const name = recipient.classicName ?? recipient.ip;
  return name ? `User talk:${name}` : null;
}
