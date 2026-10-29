import { describe, expect, it } from "@jest/globals";
import { classifyProbeAnswer, PROBE_CHECKS } from "~/lib/wiki-os/iiwiki-probe";

const answer = (
  status: number,
  body: string,
  headers: Record<string, string> = {},
  expect: "json" | "text" | "binary" = "json"
) => ({
  status,
  body,
  headers: new Headers(headers),
  expect,
});

describe("classifyProbeAnswer", () => {
  it("tells a Cloudflare firewall block from a challenge (the two answers iiwiki gave on 2026-10-28)", () => {
    const block = "<title>Attention Required! | Cloudflare</title> Sorry, you have been blocked";
    expect(classifyProbeAnswer(answer(403, block)).verdict).toBe("cloudflare-block");
    expect(
      classifyProbeAnswer(answer(403, "<html>", { "cf-mitigated": "challenge" })).verdict
    ).toBe("cloudflare-challenge");
    expect(classifyProbeAnswer(answer(503, "Just a moment...")).verdict).toBe(
      "cloudflare-challenge"
    );
  });

  it("reads 429, other statuses, API errors and JSON answers", () => {
    expect(classifyProbeAnswer(answer(429, "")).verdict).toBe("rate-limited");
    expect(classifyProbeAnswer(answer(502, "bad gateway")).verdict).toBe("http-error");
    expect(classifyProbeAnswer(answer(200, "<html>not json")).verdict).toBe("http-error");
    const apiError = classifyProbeAnswer(
      answer(200, JSON.stringify({ error: { code: "missingtitle", info: "No page" } }))
    );
    expect(apiError).toEqual({ verdict: "api-error", detail: "missingtitle: No page" });
    expect(classifyProbeAnswer(answer(200, JSON.stringify({ query: {} }))).verdict).toBe("ok");
  });

  it("takes a wikitext or file answer as ok without parsing it", () => {
    expect(
      classifyProbeAnswer(answer(200, "'''Bold''' text", { "content-type": "text/x-wiki" }, "text"))
        .verdict
    ).toBe("ok");
    expect(
      classifyProbeAnswer(answer(206, "\u0089PNG", { "content-type": "image/png" }, "binary"))
        .verdict
    ).toBe("ok");
  });
});

describe("PROBE_CHECKS", () => {
  it("covers every IIWiki switch feature and only builds IIWiki URLs from the api.php it is given", () => {
    const covered = new Set(PROBE_CHECKS.flatMap((c) => c.features));
    for (const feature of [
      "reader",
      "embeds",
      "country",
      "media",
      "search",
      "proxy",
      "cards",
      "realms",
      "identity",
    ]) {
      expect(covered).toContain(feature);
    }
    const api = "https://iiwiki.com/api.php";
    for (const check of PROBE_CHECKS) {
      const url = check.url(api, { fileUrl: "https://iiwiki.com/images/a/ab/Flag.png" });
      expect(url?.startsWith("https://iiwiki.com/")).toBe(true);
    }
    expect(PROBE_CHECKS.find((c) => c.id === "filebytes")?.url(api, {})).toBeNull();
  });
});
