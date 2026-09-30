/** @jest-environment node */
// Plan 409: the page-admin screens' pure helpers.
import {
  chooseExpiry,
  chooseLevel,
  describeExpiry,
  describeLogEntry,
  expiryFromPreset,
  pageAdminActions,
} from "~/lib/wiki-os/page-admin-ui";

const NOW = new Date("2026-09-30T12:00:00Z");

describe("pageAdminActions", () => {
  it("offers an action only for a right the caller holds", () => {
    expect(pageAdminActions("Caphiria", ["read", "edit"])).toEqual([]);
    expect(pageAdminActions("Caphiria", ["move"]).map((a) => a.id)).toEqual(["move"]);
    expect(pageAdminActions("Caphiria", ["delete", "protect", "move"]).map((a) => a.id)).toEqual([
      "move",
      "protect",
      "delete",
    ]);
  });

  it("links to the screen with the title encoded", () => {
    const [move] = pageAdminActions("Talk:Foo & bar/baz", ["move"]);
    expect(move?.href).toBe("/util/move?title=Talk%3AFoo%20%26%20bar%2Fbaz");
    expect(pageAdminActions("Foo", ["protect"])[0]?.href).toBe("/util/protect?title=Foo");
    expect(pageAdminActions("Foo", ["delete"])[0]?.href).toBe("/util/delete?title=Foo");
  });

  it("does not leak the right or path fields", () => {
    expect(Object.keys(pageAdminActions("Foo", ["move"])[0] ?? {}).sort()).toEqual([
      "description",
      "href",
      "id",
      "label",
    ]);
  });
});

describe("expiryFromPreset", () => {
  it("is null for indefinitely and counts the others from now", () => {
    expect(expiryFromPreset("infinite", NOW)).toBeNull();
    expect(expiryFromPreset("1d", NOW)).toEqual(new Date("2026-10-01T12:00:00Z"));
    expect(expiryFromPreset("1w", NOW)).toEqual(new Date("2026-10-07T12:00:00Z"));
    expect(expiryFromPreset("1y", NOW)).toEqual(new Date("2027-09-30T12:00:00Z"));
  });

  it("describes an expiry", () => {
    expect(describeExpiry(null)).toBe("indefinitely");
    expect(describeExpiry(new Date(NOW))).toMatch(/^until /);
  });
});

describe("describeLogEntry", () => {
  const line = (type: string, action: string, title: string, params: object | null = null) =>
    describeLogEntry({ type, action, title, params: params as never });

  it("describes a move with both titles, and a bare one without", () => {
    expect(line("move", "move", "New", { oldTitle: "Old", newTitle: "New" })).toBe(
      'moved page "Old" to "New"'
    );
    expect(line("move", "move", "New")).toBe('moved page "New"');
  });

  it("describes deleting and restoring", () => {
    expect(line("delete", "delete", "Foo")).toBe('deleted page "Foo"');
    expect(line("delete", "restore", "Foo")).toBe('restored page "Foo"');
  });

  it("describes protecting, with the levels that are set", () => {
    expect(
      line("protect", "protect", "Foo", {
        restrictions: [
          { action: "edit", level: "sysop" },
          { action: "move", level: null },
        ],
      })
    ).toBe('protected "Foo" (edit: sysop)');
    expect(line("protect", "unprotect", "Foo")).toBe('removed the protection of "Foo"');
    expect(line("protect", "protect", "Foo")).toBe('protected "Foo"');
  });

  it("describes blocks, unblocks and changed blocks", () => {
    expect(line("block", "block", "User:Bob", { expiry: "infinity" })).toBe(
      "blocked Bob indefinitely"
    );
    expect(line("block", "block", "User:Bob", { expiry: "2027-01-01T00:00:00.000Z" })).toMatch(
      /^blocked Bob until /
    );
    expect(line("block", "reblock", "User:Bob", { expiry: "infinity" })).toBe(
      "changed the block of Bob indefinitely"
    );
    expect(line("block", "unblock", "User:Bob")).toBe("unblocked Bob");
  });

  it("describes group changes", () => {
    expect(line("rights", "rights", "User:Bob", { added: ["sysop"], removed: ["bot"] })).toBe(
      "changed the groups of Bob: added sysop; removed bot"
    );
    expect(line("rights", "rights", "User:Bob")).toBe("changed the groups of Bob");
  });

  it("falls back to the action and title for a type it does not know", () => {
    expect(line("upload", "upload", "File:X.png")).toBe('upload "File:X.png"');
  });
});

describe("the protect screen's edit-to-move chain", () => {
  type Level = "none" | "autoconfirmed" | "sysop";
  const fresh = () => ({
    levels: { edit: "none", move: "none", upload: "none", create: "none" } as Record<string, Level>,
    expiries: {
      edit: "infinite",
      move: "infinite",
      upload: "infinite",
      create: "infinite",
    } as Record<string, string>,
    moveChosen: false,
  });

  it("sets Move to the level chosen for Edit until Move has been chosen on its own", () => {
    const edit = chooseLevel(fresh(), "edit", "sysop");
    expect(edit.levels).toEqual({ edit: "sysop", move: "sysop", upload: "none", create: "none" });

    const relaxed = chooseLevel(edit, "move", "autoconfirmed");
    expect(relaxed.levels.move).toBe("autoconfirmed");
    expect(relaxed.moveChosen).toBe(true);

    // once Move was chosen, changing Edit leaves it alone
    expect(chooseLevel(relaxed, "edit", "none").levels).toMatchObject({
      edit: "none",
      move: "autoconfirmed",
    });
  });

  it("chains the expiry the same way, and never touches Upload or Create", () => {
    const edit = chooseExpiry(fresh(), "edit", "1w");
    expect(edit.expiries).toEqual({
      edit: "1w",
      move: "1w",
      upload: "infinite",
      create: "infinite",
    });
    expect(chooseLevel(fresh(), "upload", "sysop").levels.move).toBe("none");
    expect(chooseLevel(fresh(), "create", "sysop").moveChosen).toBe(false);
  });

  it("does not change the draft it was given", () => {
    const draft = fresh();
    chooseLevel(draft, "edit", "sysop");
    expect(draft.levels.move).toBe("none");
  });
});
