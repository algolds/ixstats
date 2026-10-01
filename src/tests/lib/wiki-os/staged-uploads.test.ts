/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factory relies on the ambient global.
//
// Plan 411, review: the staged-file lock's transaction writes a file of up to 10 MB, so it is given 30 seconds, not Prisma's 5.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
}));

import { withStagedFileLock } from "~/lib/wiki-os/services/staged-uploads";
import { fakeWikiDb, transactionOptions } from "~/tests/helpers/fake-wiki-db";

beforeEach(() => fakeWikiDb.reset());

describe("withStagedFileLock", () => {
  it("gives its transaction a 30 second timeout (the default 5 s would cut a slow disk off mid-write)", async () => {
    await withStagedFileLock("a".repeat(31), async () => undefined);

    expect(transactionOptions).toEqual([{ timeout: 30_000 }]);
  });
});
