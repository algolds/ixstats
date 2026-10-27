/**
 * The admin's Loreward override form (`lorewards.overrideWinner`): what it sends, and what its success says about the
 * trophies and the bot. A field the admin leaves blank is left out, so the stored value stays; only "No winner" or "No runner-up"
 * empties a place. A new holder starts with no page or score: the server clears the blank ones when the name changes
 * (`overrideLorewardEntry`), since only it knows the stored holder. The form's description says so.
 */
import { z } from "zod";

/** The day an override names, in both override procedures: a real calendar date as YYYY-MM-DD (not 2026-02-30). */
export const overrideDateSchema = z.iso.date("Enter a real calendar date, as YYYY-MM-DD.");

/** One place as the form holds it: the four inputs, and whether the admin emptied the place. */
export interface OverridePlaceForm {
  user: string;
  page: string;
  score: string;
  bytes: string;
  cleared: boolean;
}

interface PlaceFields {
  user?: string | null;
  page?: string | null;
  score?: number | null;
  bytes?: number | null;
}

const typed = (value: string): string | undefined => value.trim() || undefined;
const counted = (value: string): number | undefined =>
  value.trim() === "" ? undefined : Number(value);

function placeFields(form: OverridePlaceForm): PlaceFields {
  if (form.cleared) return { user: null, page: null, score: null, bytes: null };
  return {
    user: typed(form.user),
    page: typed(form.page),
    score: counted(form.score),
    bytes: counted(form.bytes),
  };
}

/** The override's fields: a blank input is left out (undefined), and an emptied place sends null for all four. */
export function overrideFields(winner: OverridePlaceForm, runnerUp: OverridePlaceForm) {
  const w = placeFields(winner);
  const r = placeFields(runnerUp);
  return {
    winnerUser: w.user,
    winnerPage: w.page,
    winnerScore: w.score,
    winnerBytes: w.bytes,
    runnerUpUser: r.user,
    runnerUpPage: r.page,
    runnerUpScore: r.score,
    runnerUpBytes: r.bytes,
  };
}

const trophies = (count: number) => `${count} ${count === 1 ? "trophy" : "trophies"}`;

/**
 * What the override did to the trophies, for its success message: "1 trophy moved, 2 trophies voided", and a note
 * when new trophies wait for the next sync. Empty when nothing changed.
 */
interface TrophyChanges {
  reassigned: number;
  voided: number;
  mintDeferred: boolean;
}

export function trophyChangeNote(result: TrophyChanges): string {
  const parts: string[] = [];
  if (result.reassigned > 0) parts.push(`${trophies(result.reassigned)} moved`);
  if (result.voided > 0) parts.push(`${trophies(result.voided)} voided`);
  const changes = parts.join(", ");
  if (!result.mintDeferred) return changes;
  const later = "New trophies are minted on the next sync.";
  return changes ? `${changes}. ${later}` : later;
}

/**
 * An override's success toast, for both override procedures: saved and announced when the bot was told, else a
 * warning that the override is saved but nothing was announced, and the bot picks it up on its next sync. The trophy
 * note follows either.
 */
export function overrideToast(
  botSynced: boolean,
  changes: TrophyChanges
): { tone: "success" | "warning"; title: string; message: string } {
  const told = botSynced
    ? { title: "Winner overridden", message: "The override is saved and announced." }
    : {
        title: "Saved",
        message:
          "The Discord bot was not told, so nothing was announced. It picks the change up on its next sync.",
      };
  const note = trophyChangeNote(changes);
  return {
    tone: botSynced ? "success" : "warning",
    title: told.title,
    message: note ? `${told.message} ${note}` : told.message,
  };
}
