/** @jest-environment node */
/**
 * Vault row locks for transactions that move credits between players: every party's row in user-id order, so two
 * such transactions never wait on each other in a cycle, and a lost deadlock is a CONFLICT the player can retry.
 */
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { InternalError } from "~/lib/app-error";
import { lockVaultsTx, vaultsBusyError, VAULTS_BUSY_MESSAGE } from "~/lib/vault/vault-locks";

const known = (code: string, message: string) =>
  new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: "6" });

describe("lockVaultsTx", () => {
  it("locks each party's vault row once, in user-id order, in one statement", async () => {
    const tx = { $queryRaw: jest.fn(async (_query: Prisma.Sql) => []) };
    await lockVaultsTx(tx as never, ["u_seller", "u_buyer", "u_seller", "u_owner"]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [query] = tx.$queryRaw.mock.calls[0]!;
    expect(query.values).toEqual(["u_buyer", "u_owner", "u_seller"]);
    expect(query.sql).toBe(
      'SELECT id FROM "my_vault" WHERE "userId" IN (?,?,?) ORDER BY "userId" FOR UPDATE'
    );
  });

  it("sorts by code point, as the database orders the ids", async () => {
    const tx = { $queryRaw: jest.fn(async (_query: Prisma.Sql) => []) };
    await lockVaultsTx(tx as never, ["b", "B", "a"]);
    expect(tx.$queryRaw.mock.calls[0]![0].values).toEqual(["B", "a", "b"]);
  });

  it("leaves out a null (no bidder), and asks nothing for no parties", async () => {
    const tx = { $queryRaw: jest.fn(async (_query: Prisma.Sql) => []) };
    await lockVaultsTx(tx as never, ["u_bidder", null]);
    expect(tx.$queryRaw.mock.calls[0]![0].values).toEqual(["u_bidder"]);
    tx.$queryRaw.mockClear();
    await lockVaultsTx(tx as never, [null]);
    await lockVaultsTx(tx as never, []);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("vaultsBusyError", () => {
  it("answers a lost deadlock or write conflict as a CONFLICT to retry", () => {
    for (const error of [
      known("P2034", "Transaction failed due to a write conflict or a deadlock. Please retry"),
      known("P2010", "Raw query failed. Code: `40P01`. Message: `deadlock detected`"),
      // ~/server/db wraps a failed model operation, keeping Prisma's text
      new InternalError("Transaction failed due to a write conflict or a deadlock. Please retry"),
    ]) {
      const busy = vaultsBusyError(error);
      expect(busy).toBeInstanceOf(TRPCError);
      expect(busy).toMatchObject({ code: "CONFLICT", message: VAULTS_BUSY_MESSAGE });
    }
    expect(VAULTS_BUSY_MESSAGE).toBe("Someone else was buying at the same moment. Try again.");
  });

  it("leaves every other failure alone", () => {
    for (const error of [
      known("P2002", "Unique constraint failed"),
      known("P2010", "Raw query failed. Code: `42601`. Message: `syntax error`"),
      new InternalError("Failed to access vault"),
      new Error("deadlock detected"),
      new TRPCError({ code: "CONFLICT", message: "This listing was just sold or withdrawn." }),
    ]) {
      expect(vaultsBusyError(error)).toBeNull();
    }
  });
});
