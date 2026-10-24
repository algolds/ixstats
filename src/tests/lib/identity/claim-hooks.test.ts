/** @jest-environment node */
/**
 * The plan B hooks: run after an approval or a revoke commits, each hook in turn, a failure logged and never fatal;
 * the defaults are the Lorewards hooks.
 */
jest.mock("~/lib/lorewards/claim-hook", () => ({
  lorewardsClaimHook: jest.fn(),
  lorewardsRevokeHook: jest.fn(),
}));

import {
  runClaimApprovedHooks,
  runClaimRevokedHooks,
  type ClaimApprovedEvent,
  type ClaimRevokedEvent,
} from "~/lib/identity/claim-hooks";
import { lorewardsClaimHook, lorewardsRevokeHook } from "~/lib/lorewards/claim-hook";

const event: ClaimApprovedEvent = {
  claimId: "c1",
  userId: "a",
  source: "ixwiki",
  name: "Foo",
  approvedAt: new Date(),
  origin: "PLAYER",
};
const revoked: ClaimRevokedEvent = {
  claimId: "c1",
  userId: "a",
  source: "ixwiki",
  name: "Foo",
  revokedAt: new Date(),
};

it("runs every hook in order, and a failing hook does not stop the next", async () => {
  const seen: string[] = [];
  const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  await runClaimApprovedHooks(event, [
    async () => {
      seen.push("first");
      throw new Error("boom");
    },
    async (e) => {
      seen.push(e.name);
    },
  ]);
  expect(seen).toEqual(["first", "Foo"]);
  expect(error).toHaveBeenCalledWith("[identity] claim hook failed", expect.any(Error));
  error.mockRestore();
});

it("runs every revoke hook in order, and a failing one does not stop the next", async () => {
  const seen: string[] = [];
  const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  await runClaimRevokedHooks(revoked, [
    async () => {
      seen.push("first");
      throw new Error("boom");
    },
    async (e) => {
      seen.push(e.name);
    },
  ]);
  expect(seen).toEqual(["first", "Foo"]);
  expect(error).toHaveBeenCalledWith("[identity] claim revoke hook failed", expect.any(Error));
  error.mockRestore();
});

it("the default hooks run the Lorewards hooks", async () => {
  await runClaimApprovedHooks(event);
  expect(lorewardsClaimHook).toHaveBeenCalledWith(event);
  await runClaimRevokedHooks(revoked);
  expect(lorewardsRevokeHook).toHaveBeenCalledWith(revoked);
});
