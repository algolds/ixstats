/** @jest-environment node */
/** The ThinkTank group page's tab title names a readable group, never its id or a private group's name. */
import {
  loadThinktankGroupTitle,
  thinktankGroupTitle,
  THINKTANKS_TITLE,
} from "~/server/modules/thinktanks/metadata";

describe("thinktankGroupTitle", () => {
  it("names an active public group", () => {
    expect(thinktankGroupTitle({ name: "Trade Desk", isActive: true, type: "public" })).toBe(
      "Trade Desk - ThinkTanks - IxStates"
    );
  });

  it("falls back for a missing, inactive or members-only group", () => {
    expect(thinktankGroupTitle(null)).toBe(THINKTANKS_TITLE);
    expect(thinktankGroupTitle({ name: "Gone", isActive: false, type: "public" })).toBe(
      THINKTANKS_TITLE
    );
    expect(thinktankGroupTitle({ name: "Secret", isActive: true, type: "private" })).toBe(
      THINKTANKS_TITLE
    );
    expect(thinktankGroupTitle({ name: "Invites", isActive: true, type: "invite_only" })).toBe(
      THINKTANKS_TITLE
    );
  });
});

describe("loadThinktankGroupTitle", () => {
  it("reads only the fields it needs and never puts the id in the title", async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ name: "Trade Desk", isActive: true, type: "public" });
    const db = { thinktankGroup: { findUnique } } as unknown as Parameters<
      typeof loadThinktankGroupTitle
    >[0];

    const title = await loadThinktankGroupTitle(db, "cm0abc123");

    expect(title).toBe("Trade Desk - ThinkTanks - IxStates");
    expect(title).not.toContain("cm0abc123");
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "cm0abc123" },
      select: { name: true, isActive: true, type: true },
    });
  });
});
