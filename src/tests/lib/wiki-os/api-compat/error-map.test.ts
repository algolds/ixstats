/** @jest-environment node */
/**
 * m2: a save that waited too long for the page's lock is a retryable busy, which a bot reads as `ratelimited`.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { PageBusyError } from "~/lib/wiki-os/core/page-busy-error";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";
import { toApiError } from "~/lib/wiki-os/api-compat/error-map";

describe("toApiError", () => {
  it("answers a page that was busy with ratelimited and the reason, so a bot waits and retries", () => {
    const error = toApiError(new PageBusyError());

    expect(error).toMatchObject({ code: "ratelimited" });
    expect(error?.info).toContain("The page is busy");
  });

  it("answers a refused move of a file with immobilenamespace, not selfmove (which is BAD_REQUEST)", () => {
    expect(toApiError(new PageOperationError("IMMOBILE", "no files"))).toMatchObject({ code: "immobilenamespace", info: "no files" });
    expect(toApiError(new PageOperationError("BAD_REQUEST", "identical"))).toMatchObject({ code: "invalidparam" });
  });
});
