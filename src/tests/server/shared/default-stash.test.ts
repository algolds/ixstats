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

  it("when the fallback create also collides, returns the default that appeared, else the stash with that name", async () => {
    const { stash, db } = makeDb();
    // No default at first, no default after the first collision, then one (a concurrent request won).
    stash.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "raced", name: "My Stash (default)", isDefault: true });
    stash.create.mockRejectedValue(uniqueViolation());

    const raced = await getOrCreateDefaultStash(db, ["u1"], "u1");
    expect(raced.id).toBe("raced");
    expect(stash.create).toHaveBeenCalledTimes(2);

    // The name is held by a non-default stash: find it by name.
    const second = makeDb();
    second.stash.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "named", name: "My Stash (default)", isDefault: false });
    second.stash.create.mockRejectedValue(uniqueViolation());

    const named = await getOrCreateDefaultStash(second.db, ["u1"], "u1");
    expect(named.id).toBe("named");
    expect(second.stash.findFirst.mock.calls[3]![0]).toMatchObject({
      where: { userId: { in: ["u1"] }, name: "My Stash (default)" },
    });
  });

  it("rethrows the collision when nothing can be re-read, and a non-unique error from the fallback", async () => {
    const lost = makeDb();
    lost.stash.findFirst.mockResolvedValue(null);
    lost.stash.create.mockRejectedValue(uniqueViolation());
    await expect(getOrCreateDefaultStash(lost.db, ["u1"], "u1")).rejects.toMatchObject({
      code: "P2002",
    });

    const broken = makeDb();
    broken.stash.findFirst.mockResolvedValue(null);
    broken.stash.create
      .mockRejectedValueOnce(uniqueViolation())
      .mockRejectedValueOnce(new Error("connection lost"));
    await expect(getOrCreateDefaultStash(broken.db, ["u1"], "u1")).rejects.toThrow(
      "connection lost"
    );
  });

  it("rethrows an error that is not a unique violation", async () => {
    const { stash, db } = makeDb();
    stash.findFirst.mockResolvedValue(null);
    stash.create.mockRejectedValue(new Error("connection lost"));

    await expect(getOrCreateDefaultStash(db, ["u1"], "u1")).rejects.toThrow("connection lost");
    expect(stash.create).toHaveBeenCalledTimes(1);
  });
});
