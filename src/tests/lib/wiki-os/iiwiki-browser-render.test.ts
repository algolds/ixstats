/** @jest-environment node */
// An IIWiki page the server could not render is rendered from the reader's browser: an anonymous CORS GET to
// IIWiki's own parser, whose answer is transformed and sanitized like the server's.
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderIiwikiInBrowser } from "~/lib/wiki-os/iiwiki-browser-render";

const PARSED =
  '<div class="mw-parser-output"><table class="infobox"><tr><td><a href="/wiki/Eurth">Eurth</a></td></tr></table>' +
  '<p>Body <a href="/wiki/Gallambria" title="Gallambria">Gallambria</a> <a href="/wiki/File:Flag.png">flag</a>' +
  "<script>alert(1)</script></p></div>";

let fetchSpy: jest.SpiedFunction<typeof fetch>;
const requested = () => new URL(String(fetchSpy.mock.calls[0]![0]));

beforeEach(() => {
  fetchSpy = jest
    .spyOn(global, "fetch")
    .mockImplementation(async () => Response.json({ parse: { title: "Gylias", text: PARSED } }));
});
afterEach(() => fetchSpy.mockRestore());

describe("renderIiwikiInBrowser", () => {
  it("asks IIWiki's own parser for the page, anonymously, following redirects", async () => {
    await renderIiwikiInBrowser("Gylias");
    const url = requested();
    expect(url.origin).toBe("https://iiwiki.com");
    expect(url.searchParams.get("action")).toBe("parse");
    expect(url.searchParams.get("page")).toBe("Gylias");
    expect(url.searchParams.get("origin")).toBe("*");
    expect(url.searchParams.get("redirects")).toBe("1");
    expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ credentials: "omit" });
  });

  it("keeps article links in WikiOS, sends files to IIWiki and strips scripts", async () => {
    const page = await renderIiwikiInBrowser("Gylias");
    expect(page?.title).toBe("Gylias");
    expect(page?.infoboxHtml).toContain('href="/wiki/Eurth?source=iiwiki"');
    expect(page?.contentHtml).toContain('href="/wiki/Gallambria?source=iiwiki"');
    expect(page?.contentHtml).toContain('href="https://iiwiki.com/wiki/File:Flag.png"');
    expect(page?.contentHtml).not.toContain("<script");
  });

  it("is null for a page IIWiki does not have", async () => {
    fetchSpy.mockResolvedValueOnce(
      Response.json({
        error: { code: "missingtitle", info: "The page you specified doesn't exist." },
      })
    );
    await expect(renderIiwikiInBrowser("Nowhere")).resolves.toBeNull();
  });

  it("throws when Cloudflare refuses the browser", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("Just a moment...", { status: 403 }));
    await expect(renderIiwikiInBrowser("Gylias")).rejects.toThrow("IIWiki answered 403");
  });

  it("throws when the request never gets an answer (a challenge without CORS headers)", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(renderIiwikiInBrowser("Gylias")).rejects.toThrow("Failed to fetch");
  });

  it("throws on any other API error", async () => {
    fetchSpy.mockResolvedValueOnce(
      Response.json({ error: { code: "invalidtitle", info: "Bad title" } })
    );
    await expect(renderIiwikiInBrowser("<>")).rejects.toThrow("Bad title");
  });
});
