/**
 * C4b (plan 2026-10-25 sister wikis, Task 11): where a location hash lands on a sister reader page, whose ids are
 * prefixed `sister-` (sanitizeSisterHtml). The id is the hash decoded; the hash keeps the link's own spelling.
 */
import { SISTER_ID_PREFIX, sisterHashTarget } from "~/lib/wiki-os/sister-dom";
import { SISTER_ID_PREFIX as SANITIZER_PREFIX } from "~/lib/utils/sanitize-sister-html";

describe("sisterHashTarget", () => {
  it("names the prefixed id of a section", () => {
    expect(sisterHashTarget("#History")).toEqual({ id: "sister-History", hash: "#sister-History" });
    expect(sisterHashTarget("Early_years")).toEqual({
      id: "sister-Early_years",
      hash: "#sister-Early_years",
    });
  });

  it("decodes a percent-encoded hash for the id and keeps it encoded in the hash", () => {
    expect(sisterHashTarget("#Caf%C3%A9")).toEqual({
      id: "sister-Café",
      hash: "#sister-Caf%C3%A9",
    });
  });

  it("keeps a malformed escape as written", () => {
    expect(sisterHashTarget("#100%_done")).toEqual({
      id: "sister-100%_done",
      hash: "#sister-100%_done",
    });
  });

  it("is null for no hash", () => {
    expect(sisterHashTarget("")).toBeNull();
    expect(sisterHashTarget("#")).toBeNull();
  });

  it("is the prefix the sanitizer writes", () => {
    expect(SANITIZER_PREFIX).toBe(SISTER_ID_PREFIX);
    expect(SISTER_ID_PREFIX).toBe("sister-");
  });
});
