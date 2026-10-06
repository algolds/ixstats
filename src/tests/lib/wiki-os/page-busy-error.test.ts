/** @jest-environment node */
import { Prisma } from "@prisma/client";
import { ConflictError, InternalError } from "~/lib/app-error";
import { isTransactionBusy, PageBusyError } from "~/lib/wiki-os/core/page-busy-error";

const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "test" });

describe("isTransactionBusy", () => {
  it("is true for a transaction that timed out or could not start, and for a deadlock or write conflict", () => {
    expect(isTransactionBusy(known("P2028"))).toBe(true);
    expect(isTransactionBusy(known("P2034"))).toBe(true);
  });

  it("is true for a raw query PostgreSQL cancelled for the lock timeout or a deadlock (P2010), and false for another raw failure", () => {
    const raw = (message: string) =>
      new Prisma.PrismaClientKnownRequestError(message, { code: "P2010", clientVersion: "test" });
    expect(isTransactionBusy(raw("Raw query failed. Code: `55P03`. Message: `canceling statement due to lock timeout`"))).toBe(true);
    expect(isTransactionBusy(raw("Raw query failed. Code: `40P01`. Message: `deadlock detected`"))).toBe(true);
    expect(isTransactionBusy(raw("Raw query failed. Code: `42703`. Message: `column does not exist`"))).toBe(false);
  });

  it("is true for the InternalError the database client makes of those errors inside a transaction", () => {
    for (const text of [
      "Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction.",
      "Transaction API error: Unable to start a transaction in the given time.",
      "deadlock detected",
    ]) {
      expect(isTransactionBusy(new InternalError(text))).toBe(true);
    }
  });

  it("is false for everything else", () => {
    expect(isTransactionBusy(known("P2002"))).toBe(false);
    expect(isTransactionBusy(new InternalError("Something else broke"))).toBe(false);
    expect(isTransactionBusy(new ConflictError("Transaction API error"))).toBe(false); // not an internal error
    expect(isTransactionBusy(new Error("Transaction API error"))).toBe(false);
    expect(isTransactionBusy(undefined)).toBe(false);
  });

  it("makes a conflict for tRPC: a PageBusyError is an AppError of code CONFLICT", () => {
    const error = new PageBusyError();

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: "CONFLICT", statusCode: 409, trpcCode: "CONFLICT", name: "PageBusyError" });
  });
});
