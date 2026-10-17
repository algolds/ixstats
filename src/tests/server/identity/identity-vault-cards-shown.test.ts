/** @jest-environment node */
/** `loadVaultCardsShown`: the Passport's Vault cards switch for many players in one read, for naming them. */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { passportPreference: { findMany: jest.fn() } },
}));

import { db } from "~/server/db";
import { loadVaultCardsShown } from "~/server/modules/identity/identity.privacy";

const findMany = jest.mocked(db.passportPreference.findMany);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("loadVaultCardsShown", () => {
  it("reads every player's switch at once; a player with no stored settings shows them", async () => {
    findMany.mockResolvedValue([
      { userId: "shows", showVault: true },
      { userId: "hides", showVault: false },
    ] as never);
    const shown = await loadVaultCardsShown(["shows", "hides", "default", "shows"]);
    expect([...shown].sort()).toEqual(["default", "shows"]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: { in: ["shows", "hides", "default"] } },
      select: { userId: true, showVault: true },
    });
  });

  it("reads nothing for nobody", async () => {
    await expect(loadVaultCardsShown([])).resolves.toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("shows nobody's when the read fails, so a hidden player is never named on a guess", async () => {
    findMany.mockRejectedValue(new Error("database down"));
    await expect(loadVaultCardsShown(["a", "b"])).resolves.toEqual(new Set());
  });
});
