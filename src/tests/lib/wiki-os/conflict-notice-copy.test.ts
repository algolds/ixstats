/** @jest-environment node */
/**
 * conflict-notice-copy.ts: a notice says what the recipient lost (an edit, a deletion, a move or a restore), what
 * replaced it, and what is left and what to do, for every pair of kinds the conflict rule can set against each other.
 */
import { lossOf, noticeCopy } from "~/lib/wiki-os/services/conflict-notice-copy";
import type { ChangeAction, PageChange } from "~/lib/wiki-os/services/conflict-rule";

const copy = (winner: ChangeAction, loss: ChangeAction) =>
  noticeCopy({ title: "Caphiria", pageLink: "[[Caphiria]]", wiki: "WikiOS", winner, loss });

describe("noticeCopy", () => {
  it.each<[ChangeAction, ChangeAction, string, string]>([
    [
      "edit",
      "edit",
      'Your edit to "Caphiria" was replaced by a later edit on WikiOS. Your text is kept in the page history.',
      "A later edit on WikiOS replaced your edit (links). Your text is still in the page history; edit the page again to bring it back.",
    ],
    [
      "delete",
      "edit",
      'Your edit to "Caphiria" was replaced by a later deletion on WikiOS. The page was deleted; your text is kept in its history.',
      "A later deletion on WikiOS replaced your edit (links). Your text is still in the deleted page's history; restore the page and edit it again to bring it back.",
    ],
    [
      "edit",
      "delete",
      'Your deletion of "Caphiria" was replaced by a later edit on WikiOS. The page was kept.',
      "A later edit on WikiOS replaced your deletion (links). The page was kept; delete it again if it should still go.",
    ],
    [
      "move",
      "delete",
      'Your deletion of "Caphiria" was replaced by a later move on WikiOS. The page was kept.',
      "A later move on WikiOS replaced your deletion (links). The page was kept; delete it again if it should still go.",
    ],
    [
      "undelete",
      "delete",
      'Your deletion of "Caphiria" was replaced by a later restore on WikiOS. The page was kept.',
      "A later restore on WikiOS replaced your deletion (links). The page was kept; delete it again if it should still go.",
    ],
    [
      "move",
      "move",
      'Your move of "Caphiria" was replaced by a later move on WikiOS. The page does not have the name you gave it.',
      "A later move on WikiOS replaced your move (links). The page does not have the name you gave it; move it again if it should.",
    ],
    [
      "delete",
      "move",
      'Your move of "Caphiria" was replaced by a later deletion on WikiOS. The page was deleted.',
      "A later deletion on WikiOS replaced your move (links). The page was deleted; restore it and move it again if it should have the name you gave it.",
    ],
    [
      "delete",
      "undelete",
      'Your restore of "Caphiria" was replaced by a later deletion on WikiOS. The page stays deleted.',
      "A later deletion on WikiOS replaced your restore (links). The page stays deleted; restore it again if it should come back.",
    ],
  ])("a %s over a %s", (winner, loss, message, body) => {
    const words = copy(winner, loss);
    expect(words.message).toBe(message);
    expect(words.body(" (links)")).toBe(body);
    const noun = { edit: "edit", delete: "deletion", move: "move", undelete: "restore" }[loss];
    const preposition = loss === "edit" ? "to" : "of";
    expect(words.title).toBe(`Your ${noun} was overwritten`);
    expect(words.heading).toBe(`== Your ${noun} ${preposition} [[Caphiria]] was replaced ==`);
    expect(words.summary).toBe(`Your ${noun} ${preposition} Caphiria was replaced`);
    // the Facet copy rules
    expect(`${words.message} ${words.body("")}`).not.toMatch(/—/);
  });
});

describe("lossOf", () => {
  const change = (ref: string, action: ChangeAction): PageChange => ({
    side: "classic",
    action,
    ref,
    at: new Date("2026-10-24T12:00:00Z"),
    author: { userId: null, classicName: "Foo", ip: null, label: null },
  });

  it("is the kind of the recipient's newest overwritten change", () => {
    const overwritten = [change("41", "edit"), change("mwlog:7", "delete")];
    expect(lossOf(overwritten, { refs: ["41", "mwlog:7"] })).toBe("delete");
    expect(lossOf(overwritten, { refs: ["mwlog:7", "41"] })).toBe("edit");
  });
});
