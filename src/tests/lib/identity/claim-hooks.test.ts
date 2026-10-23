/** @jest-environment node */
/** The plan B hook: run after an approval commits, each hook in turn, a failure logged and never fatal. */
import { runClaimApprovedHooks, type ClaimApprovedEvent } from "~/lib/identity/claim-hooks";

const event: ClaimApprovedEvent = {
  claimId: "c1",
  userId: "a",
  source: "ixwiki",
  name: "Foo",
  approvedAt: new Date(),
  origin: "PLAYER",
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
