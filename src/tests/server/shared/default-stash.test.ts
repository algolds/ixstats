/** @jest-environment node */
import { describe, it, expect } from "@jest/globals";
import { getOrCreateDefaultStash } from "~/server/shared/default-stash";

type StashDb = Parameters<typeof getOrCreateDefaultStash>[0];

function makeDb() {
  const stash = { findFirst: jest.fn(), create: jest.fn() };
  return { stash, db: { stash } as unknown as StashDb };
}

const uniqueViolation = () =>
  Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

describe("getOrCreateDefaultStash", () => {
  it("returns the existing default stash without creating one", async () => {
    const { stash, db } = makeDb();
    stash.findFirst.mockResolvedValue({ id: "s1", isDefault: true });

    const result = await getOrCreateDefaultStash(db, ["u1", "u2"], "u1");

    expect(result).toEqual({ id: "s1", isDefault: true });
    expect(stash.create).not.toHaveBeenCalled();
    expect(stash.findFirst.mock.calls[0]![0]).toMatchObject({
      where: { userId: { in: ["u1", "u2"] }, isDefault: true },
    });
  });

  it("creates 'My Stash' as the default when the user has none", async () => {
    const { stash, db } = makeDb();
    stash.findFirst.mockResolvedValue(null);
    stash.create.mockResolvedValue({ id: "new", name: "My Stash", isDefault: true });

    const result = await getOrCreateDefaultStash(db, ["u1"], "u1");

    expect(result.id).toBe("new");
    expect(stash.create).toHaveBeenCalledTimes(1);
    expect(stash.create.mock.calls[0]![0]).toMatchObject({
      data: { userId: "u1", name: "My Stash", isDefault: true },
    });
  });

  it("on a concurrent first stash (P2002) returns the row the other request created", async () => {
    const { stash, db } = makeDb();
    stash.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "winner", name: "My Stash", isDefault: true });
    stash.create.mockRejectedValue(uniqueViolation());

    const result = await getOrCreateDefaultStash(db, ["u1"], "u1");

    expect(result).toEqual({ id: "winner", name: "My Stash", isDefault: true });
    expect(stash.create).toHaveBeenCalledTimes(1);
  });

  it("when a non-default 'My Stash' holds the name, creates the default under 'My Stash (default)'", async () => {
    const { stash, db } = makeDb();
    stash.findFirst.mockResolvedValue(null);
    stash.create
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce({ id: "fallback", name: "My Stash (default)", isDefault: true });

    const result = await getOrCreateDefaultStash(db, ["u1"], "u1");

    expect(result.id).toBe("fallback");
    expect(stash.create).toHaveBeenCalledTimes(2);
    expect(stash.create.mock.calls[1]![0]).toMatchObject({
      data: { userId: "u1", name: "My Stash (default)", isDefault: true },
    });
  });

  it("rethrows an error that is not a unique violation", async () => {
    const { stash, db } = makeDb();
    stash.findFirst.mockResolvedValue(null);
    stash.create.mockRejectedValue(new Error("connection lost"));

    await expect(getOrCreateDefaultStash(db, ["u1"], "u1")).rejects.toThrow("connection lost");
    expect(stash.create).toHaveBeenCalledTimes(1);
  });
});
