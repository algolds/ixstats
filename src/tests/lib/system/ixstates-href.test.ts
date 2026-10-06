/** @jest-environment node */
// Plan 415 step 5b: a link from the wiki to an IxStates-only route. Inside IxStates it is the app's own route
// (with its base path); in the standalone WikiOS build, which serves none of those routes, it is the absolute
// IxStates URL. (Node environment: `withBasePath` in a browser also checks the page's own path.)
import {
  WIKIOS_ALLOWED_PREFIXES,
  WikiStandaloneConfigError,
  ixstatesHref,
  wikiStandaloneRedirect,
} from "~/lib/system/wikios-standalone";

const IXSTATES = "https://ixwiki.com/projects/ixstates";

describe("ixstatesHref", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it("is the app's own route, with its base path, inside IxStates", () => {
    delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
    process.env.NEXT_PUBLIC_IXSTATES_URL = IXSTATES;
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";

    expect(ixstatesHref("/blurbs")).toBe("/projects/ixstates/blurbs");
    expect(ixstatesHref("/countries/aurelia?tab=x")).toBe("/projects/ixstates/countries/aurelia?tab=x");
  });

  it("is the route itself where the app has no base path", () => {
    delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    delete process.env.BASE_PATH;

    expect(ixstatesHref("/blurbs")).toBe("/blurbs");
  });

  it("is the absolute IxStates URL in the standalone WikiOS build", () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    process.env.NEXT_PUBLIC_IXSTATES_URL = `${IXSTATES}/`;

    expect(ixstatesHref("/blurbs")).toBe(`${IXSTATES}/blurbs`);
    expect(ixstatesHref("/blurbs/some-prompt")).toBe(`${IXSTATES}/blurbs/some-prompt`);
    expect(ixstatesHref("mycountry/diplomacy")).toBe(`${IXSTATES}/mycountry/diplomacy`);
    expect(ixstatesHref("/achievements?tab=wiki-lore")).toBe(`${IXSTATES}/achievements?tab=wiki-lore`);
  });

  it("leaves an absolute URL alone, and does not repeat the IxStates URL's own path", () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    process.env.NEXT_PUBLIC_IXSTATES_URL = IXSTATES;

    expect(ixstatesHref("https://ixwiki.com/projects/ixstates/myleague/1")).toBe(
      "https://ixwiki.com/projects/ixstates/myleague/1"
    );
    expect(ixstatesHref("//example.org/x")).toBe("//example.org/x");
    expect(ixstatesHref("/projects/ixstates/myleague/1")).toBe(`${IXSTATES}/myleague/1`);
    expect(ixstatesHref("/projects/ixstatesx/y")).toBe(`${IXSTATES}/projects/ixstatesx/y`);
  });

  it.each(["/blurbs", "/mycountry", "/dashboard", "/countries", "/achievements", "/settings", "/messages", "/maps"])(
    "sends %s to IxStates in standalone mode: the wiki does not serve it",
    (path) => {
      process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
      process.env.NEXT_PUBLIC_IXSTATES_URL = IXSTATES;

      expect(WIKIOS_ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))).toBe(false);
      expect(ixstatesHref(path)).toBe(`${IXSTATES}${path}`);
    }
  );

  it("keeps the relative link when the standalone build has no IxStates URL, so a page still renders", () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    delete process.env.NEXT_PUBLIC_IXSTATES_URL;
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    delete process.env.BASE_PATH;

    expect(() => ixstatesHref("/blurbs")).not.toThrow();
    expect(ixstatesHref("/blurbs")).toBe("/blurbs");
    expect(() => wikiStandaloneRedirect("/blurbs", "")).toThrow(WikiStandaloneConfigError);
  });
});
