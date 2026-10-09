/**
 * U10: the account files are typed from the router (no `any`). A stored row's strings become the settings dialog's
 * values: unknown trait values read as the defaults, and a type the dialog cannot set (a personal persona) is left
 * out, so saving never changes it. tRPC error codes are read off a thrown Error.
 */
import { describe, expect, it } from "@jest/globals";
import { accountSettingsOf, trpcErrorCode } from "~/components/dashboard/accounts/account-types";

describe("accountSettingsOf", () => {
  it("keeps known values", () => {
    expect(
      accountSettingsOf({
        postingFrequency: "active",
        politicalLean: "right",
        personality: "satirical",
        accountType: "media",
      })
    ).toEqual({
      postingFrequency: "active",
      politicalLean: "right",
      personality: "satirical",
      accountType: "media",
    });
  });

  it("reads unknown traits as the defaults and leaves a personal persona's type out", () => {
    expect(
      accountSettingsOf({
        postingFrequency: "hourly",
        politicalLean: "",
        personality: "odd",
        accountType: "personal",
      })
    ).toEqual({
      postingFrequency: "moderate",
      politicalLean: "center",
      personality: "casual",
      accountType: undefined,
    });
  });
});

describe("trpcErrorCode", () => {
  it("reads the code a tRPC client error carries, and nothing from a plain error", () => {
    const conflict = Object.assign(new Error("taken"), { data: { code: "CONFLICT" } });
    expect(trpcErrorCode(conflict)).toBe("CONFLICT");
    expect(trpcErrorCode(new Error("plain"))).toBeUndefined();
    expect(trpcErrorCode(Object.assign(new Error("x"), { data: null }))).toBeUndefined();
  });
});
