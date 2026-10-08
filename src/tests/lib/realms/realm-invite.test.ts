import { describe, expect, it } from "@jest/globals";
import { inviteVia, MAX_VIA_LENGTH, withVia } from "~/lib/realms/realm-invite";

describe("inviteVia", () => {
  it("trims the handle", () => {
    expect(inviteVia("  alex ")).toBe("alex");
  });

  it("is null when absent, blank or too long", () => {
    expect(inviteVia(null)).toBeNull();
    expect(inviteVia(undefined)).toBeNull();
    expect(inviteVia("   ")).toBeNull();
    expect(inviteVia("x".repeat(MAX_VIA_LENGTH + 1))).toBeNull();
    expect(inviteVia("x".repeat(MAX_VIA_LENGTH))).toHaveLength(MAX_VIA_LENGTH);
  });
});

describe("withVia", () => {
  it("adds the encoded via as the first or a further query parameter", () => {
    expect(withVia("/r/eurth", "Kir Forum")).toBe("/r/eurth?via=Kir%20Forum");
    expect(withVia("/r/eurth?tab=1", "kir")).toBe("/r/eurth?tab=1&via=kir");
  });

  it("leaves the path alone without a via", () => {
    expect(withVia("/r/eurth", null)).toBe("/r/eurth");
    expect(withVia("/r/eurth", "")).toBe("/r/eurth");
  });
});
