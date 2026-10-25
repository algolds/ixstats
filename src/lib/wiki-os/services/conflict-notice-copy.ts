/**
 * The words of a conflict notice. They depend on what the recipient lost (the kind of their newest overwritten change:
 * an edit, a deletion, a move or a restore) and on what replaced it, and say what became of their change and what they
 * can do about it. Pure: conflict-notices.ts sends them.
 */
import type { ChangeAction, NoticeRecipient, PageChange } from "./conflict-rule";

/** What one kind of lost change is called, and what is left of it. */
interface Loss {
  noun: string;
  preposition: string;
  /** What became of the change, for the in-app notice and the DM. */
  kept: string;
  /** What became of it and what to do, for the talk note. */
  remedy: string;
}

const LOSSES: Readonly<Record<ChangeAction, Loss>> = {
  edit: {
    noun: "edit",
    preposition: "to",
    kept: "Your text is kept in the page history.",
    remedy: "Your text is still in the page history; edit the page again to bring it back.",
  },
  delete: {
    noun: "deletion",
    preposition: "of",
    kept: "The page was kept.",
    remedy: "The page was kept; delete it again if it should still go.",
  },
  move: {
    noun: "move",
    preposition: "of",
    kept: "The page does not have the name you gave it.",
    remedy: "The page does not have the name you gave it; move it again if it should.",
  },
  undelete: {
    noun: "restore",
    preposition: "of",
    kept: "The page stays deleted.",
    remedy: "The page stays deleted; restore it again if it should come back.",
  },
};

/** An edit a deletion replaced: its text went with the page, and comes back only with a restore. */
const EDIT_DELETED: Loss = {
  ...LOSSES.edit,
  kept: "The page was deleted; your text is kept in its history.",
  remedy:
    "Your text is still in the deleted page's history; restore the page and edit it again to bring it back.",
};

/** A move a deletion replaced: the page is gone, under whichever name. */
const MOVE_DELETED: Loss = {
  ...LOSSES.move,
  kept: "The page was deleted.",
  remedy:
    "The page was deleted; restore it and move it again if it should have the name you gave it.",
};

/** What is left of a lost change of each kind when a deletion replaced it (only an edit or a move fares differently). */
const DELETED: Readonly<Partial<Record<ChangeAction, Loss>>> = {
  edit: EDIT_DELETED,
  move: MOVE_DELETED,
};

const WINNERS: Readonly<Record<ChangeAction, string>> = {
  edit: "a later edit",
  delete: "a later deletion",
  move: "a later move",
  undelete: "a later restore",
};

/** What the recipient lost: the kind of their newest overwritten change. */
export function lossOf(
  overwritten: readonly PageChange[],
  recipient: Pick<NoticeRecipient, "refs">
): ChangeAction {
  const newest = recipient.refs.at(-1);
  return overwritten.find((change) => change.ref === newest)?.action ?? "edit";
}

export interface CopyInput {
  title: string;
  /** The page as a wikilink, for the talk note. */
  pageLink: string;
  /** The wiki the winner was saved on. */
  wiki: string;
  winner: ChangeAction;
  loss: ChangeAction;
}

export interface NoticeCopy {
  /** The in-app notice's title. */
  title: string;
  /** The in-app notice and the DM. */
  message: string;
  /** The talk note's section heading. */
  heading: string;
  /** The talk note's text, `links` (" (a, b)" or "") after the change it names. */
  body: (links: string) => string;
  /** The talk note's edit summary. */
  summary: string;
}

export function noticeCopy(input: CopyInput): NoticeCopy {
  const loss = (input.winner === "delete" && DELETED[input.loss]) || LOSSES[input.loss];
  const yours = `Your ${loss.noun} ${loss.preposition}`;
  const by = WINNERS[input.winner];
  const opening = by.charAt(0).toUpperCase() + by.slice(1);
  return {
    title: `Your ${loss.noun} was overwritten`,
    message: `${yours} "${input.title}" was replaced by ${by} on ${input.wiki}. ${loss.kept}`,
    heading: `== ${yours} ${input.pageLink} was replaced ==`,
    body: (links) =>
      `${opening} on ${input.wiki} replaced your ${loss.noun}${links}. ${loss.remedy}`,
    summary: `${yours} ${input.title} was replaced`,
  };
}
