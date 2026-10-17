/**
 * The admin's Loreward override form (`lorewards.overrideWinner`): what it sends, and what its success says about the
 * trophies. A field the admin leaves blank is left out, so the stored value stays; only "No winner" or "No runner-up"
 * empties a place. A new holder starts with no page or score: the server clears the blank ones when the name changes
 * (`overrideLorewardEntry`), since only it knows the stored holder. The form's description says so.
 */

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
export function trophyChangeNote(result: {
  reassigned: number;
  voided: number;
  mintDeferred: boolean;
}): string {
  const parts: string[] = [];
  if (result.reassigned > 0) parts.push(`${trophies(result.reassigned)} moved`);
  if (result.voided > 0) parts.push(`${trophies(result.voided)} voided`);
  const changes = parts.join(", ");
  if (!result.mintDeferred) return changes;
  const later = "New trophies are minted on the next sync.";
  return changes ? `${changes}. ${later}` : later;
}
