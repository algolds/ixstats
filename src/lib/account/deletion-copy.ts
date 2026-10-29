/**
 * What Settings shows around the account export and deletion (Privacy 5.1, 5.2). Pure, so the
 * wording and the name the dialog asks for are tested beside `confirmationMatches`.
 */
import type { ConfirmationNames } from "~/lib/account/deletion";

/** The name the delete dialog asks the user to type: one `confirmationMatches` accepts. */
export function confirmationName(names: ConfirmationNames): string | null {
  return names.handle ?? names.username ?? names.email?.split("@")[0] ?? null;
}

/** The pending-deletion notice, in real (not IxTime) calendar days. */
export function deletionNotice(erasesAt: Date, locale?: string): string {
  const day = erasesAt.toLocaleDateString(locale, { dateStyle: "long" });
  return `Your account will be deleted on ${day}.`;
}

export function exportFileName(now: Date): string {
  return `ixstates-data-${now.toISOString().slice(0, 10)}.json`;
}
