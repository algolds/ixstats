/** @jest-environment node */
/** What the admin's "Pay now" and "Run full sync" say about the places they paid and the trophy cards they gave. */
import { describe, expect, it } from "@jest/globals";
import { fullSyncToast, payNowToast } from "~/lib/lorewards/admin-toasts";
import type { SettleResult } from "~/lib/lorewards/settle";

const settled = (overrides: Partial<SettleResult> = {}): SettleResult => ({
  minted: 1,
  granted: 0,
  paid: 1,
  refused: 0,
  payoutsEnabled: true,
  ...overrides,
});

describe("payNowToast", () => {
  it("counts one place paid and one trophy card minted in the singular", () => {
    expect(payNowToast(settled())).toEqual({
      tone: "success",
      title: "Loreward places paid",
      message: "1 place paid. 1 trophy card minted, 0 given.",
    });
  });

  it("counts several places and trophy cards in the plural", () => {
    expect(payNowToast(settled({ paid: 3, minted: 2, granted: 4 })).message).toBe(
      "3 places paid. 2 trophy cards minted, 4 given."
    );
  });

  it("says how many places the ledger refused, and that the next sync pays them", () => {
    expect(payNowToast(settled({ refused: 2 })).message).toBe(
      "1 place paid. 1 trophy card minted, 0 given. The ledger refused 2; they are paid on the next sync."
    );
  });

  it("warns that nothing was paid while bonuses are off, and still counts the trophy cards", () => {
    expect(payNowToast(settled({ paid: 0, minted: 2, granted: 1, payoutsEnabled: false }))).toEqual(
      {
        tone: "warning",
        title: "Loreward bonuses are off",
        message:
          "Nothing was paid. Turn bonuses on in Economy, then pay again. 2 trophy cards minted, 1 given.",
      }
    );
  });
});

describe("fullSyncToast", () => {
  it("counts the OOL entries read, the places paid and the trophy cards minted", () => {
    expect(fullSyncToast({ oolEntries: 12, settled: settled({ paid: 2, minted: 3 }) })).toEqual({
      tone: "success",
      title: "Lorewards synced",
      message: "12 entries read from the OOL pages. 2 places paid, 3 trophy cards minted.",
    });
  });

  it("reads one entry in the singular", () => {
    expect(fullSyncToast({ oolEntries: 1, settled: settled() }).message).toBe(
      "1 entry read from the OOL pages. 1 place paid, 1 trophy card minted."
    );
  });

  it("says nothing was paid while bonuses are off, in place of the places paid", () => {
    expect(
      fullSyncToast({ oolEntries: 5, settled: settled({ paid: 0, payoutsEnabled: false }) })
    ).toEqual({
      tone: "warning",
      title: "Lorewards synced",
      message:
        "5 entries read from the OOL pages. Nothing was paid. Turn bonuses on in Economy, then pay again. 1 trophy card minted.",
    });
  });

  it("says how many places the ledger refused", () => {
    expect(fullSyncToast({ oolEntries: 0, settled: settled({ refused: 1 }) }).message).toBe(
      "0 entries read from the OOL pages. 1 place paid, 1 trophy card minted. The ledger refused 1; they are paid on the next sync."
    );
  });
});
