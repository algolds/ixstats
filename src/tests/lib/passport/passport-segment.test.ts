/** @jest-environment node */
/**
 * Passport URL segments: percent-decoded with one leading `@` dropped, never throwing on a malformed
 * encoding, and the `@`-prefixed form the legacy realm path must not redirect again.
 */
import { describe, expect, it } from "@jest/globals";
import {
  passportSegmentHandle,
  passportSegmentHandleOrRaw,
  segmentHasAt,
} from "~/lib/passport/passport-segment";

describe("passportSegmentHandle", () => {
  it("decodes and drops one leading @", () => {
    expect(passportSegmentHandle("%40Kir%20Forum")).toBe("Kir Forum");
    expect(passportSegmentHandle("@kir")).toBe("kir");
    expect(passportSegmentHandle("kir")).toBe("kir");
  });

  it("is null for a malformed encoding", () => {
    expect(passportSegmentHandle("%E0%A4%A")).toBeNull();
  });
});

describe("passportSegmentHandleOrRaw", () => {
  it("falls back to the raw segment without its @", () => {
    expect(passportSegmentHandleOrRaw("@%E0%A4%A")).toBe("%E0%A4%A");
    expect(passportSegmentHandleOrRaw("%40kir")).toBe("kir");
  });
});

describe("segmentHasAt", () => {
  it("spots a literal or encoded @", () => {
    expect(segmentHasAt("@kir")).toBe(true);
    expect(segmentHasAt("%40kir")).toBe(true);
    expect(segmentHasAt("kir")).toBe(false);
  });
});
