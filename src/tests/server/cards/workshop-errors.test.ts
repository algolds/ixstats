/** @jest-environment node */
/** The workshop's expected refusals reach the player as tRPC errors; anything else passes through untouched. */
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { CapacityError } from "~/lib/cards/capacity";
import { LedgerError } from "~/lib/vault/vault-ledger";
import { DustError, workshopCall } from "~/server/modules/cards/workshop/errors";

const failWith = (error: Error) => workshopCall(() => Promise.reject(error));

describe("workshopCall", () => {
  it("returns the work's result", async () => {
    expect(await workshopCall(async () => 7)).toBe(7);
  });

  it.each<[string, Error, string, string]>([
    [
      "too little dust",
      new DustError("You need 40 dust from this card's realm."),
      "PRECONDITION_FAILED",
      "You need 40 dust from this card's realm.",
    ],
    [
      "a full collection",
      new CapacityError(0),
      "PRECONDITION_FAILED",
      "Your collection is full. Break down cards, or buy a capacity upgrade in the Store.",
    ],
    [
      "too few credits",
      new LedgerError("INSUFFICIENT_CREDITS", "You need 10 IxC."),
      "BAD_REQUEST",
      "You need 10 IxC.",
    ],
    [
      "a lost deadlock",
      new Prisma.PrismaClientKnownRequestError("Transaction failed due to a deadlock", {
        code: "P2034",
        clientVersion: "test",
      }),
      "CONFLICT",
      "Something else changed these cards at the same moment. Try again.",
    ],
  ])("turns %s into a client-safe refusal", async (_label, error, code, message) => {
    const refused = failWith(error);
    await expect(refused).rejects.toBeInstanceOf(TRPCError);
    await expect(refused).rejects.toMatchObject({ code, message });
  });

  it("passes any other failure through as it was", async () => {
    const own = new TRPCError({ code: "CONFLICT", message: "These copies changed." });
    await expect(failWith(own)).rejects.toBe(own);
    const crash = new Error("connection reset: host db-1");
    await expect(failWith(crash)).rejects.toBe(crash);
  });
});
