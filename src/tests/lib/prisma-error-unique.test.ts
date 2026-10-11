/** @jest-environment node */
import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "~/lib/app-error";
import { isUniqueViolation } from "~/lib/prisma-error";

const raw = (target: string[]) =>
  new Prisma.PrismaClientKnownRequestError("duplicate", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });

describe("isUniqueViolation", () => {
  it("recognises the raw Prisma error and the ConflictError the app's db client wraps it into", () => {
    expect(isUniqueViolation(raw(["advertRealmId"]))).toBe(true);
    expect(isUniqueViolation(new ConflictError("Unique constraint violation on Stash"))).toBe(true);
  });

  it("narrows to a column in either form", () => {
    expect(isUniqueViolation(raw(["advertRealmId"]), "advertRealmId")).toBe(true);
    expect(isUniqueViolation(raw(["activityId"]), "advertRealmId")).toBe(false);
    const wrapped = new ConflictError("Unique constraint violation on ForumThread (advertRealmId)");
    expect(isUniqueViolation(wrapped, "advertRealmId")).toBe(true);
    expect(isUniqueViolation(wrapped, "activityId")).toBe(false);
  });

  it("is false for other failures", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(new NotFoundError("Post"))).toBe(false);
    expect(isUniqueViolation("P2002")).toBe(false);
    expect(
      isUniqueViolation(
        new Prisma.PrismaClientKnownRequestError("x", { code: "P2025", clientVersion: "test" })
      )
    ).toBe(false);
  });
});
