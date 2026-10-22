/** @jest-environment node */
/**
 * The base path in every deployment: IxStates under /projects/ixstates, a root deployment (dev), the IxWorld
 * standalone maps build and the standalone WikiOS build. A doubled or missing base path broke production links
 * before, so each helper is pinned as one table: `withBasePath`/`assetUrl` and `ixstatesHref` (plain <a href>)
 * carry the base path, `toRouterPath`/`ixstatesLinkHref` (<Link> and the router add it) take it off exactly once,
 * and nothing becomes a protocol-relative path that leaves the site. `siteMetadataBase` is an origin only.
 */
import { resolveUrl } from "next/dist/lib/metadata/resolvers/resolve-url";
import { assetUrl, navigateWithBasePath, toRouterPath, withBasePath } from "~/lib/base-path";
import { siteMetadataBase } from "~/lib/site-metadata";
import { navigateTo } from "~/lib/utils/url-utils";
import {
  WIKIOS_ALLOWED_PREFIXES,
  WikiStandaloneConfigError,
  ixstatesHref,
  ixstatesLinkHref,
  wikiStandaloneRedirect,
} from "~/lib/system/wikios-standalone";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

const BASE = "/projects/ixstates";
const IXSTATES = `https://ixwiki.com${BASE}`;
const saved = { ...process.env };

type Deployment = "ixstates" | "root" | "ixworld" | "wikios" | "wikios without an IxStates URL";

function deploy(d: Deployment): void {
  process.env = { ...saved };
  for (const key of [
    "NEXT_PUBLIC_BASE_PATH",
    "BASE_PATH",
    "NEXT_PUBLIC_IXWORLD_STANDALONE",
    "NEXT_PUBLIC_WIKIOS_STANDALONE",
    "NEXT_PUBLIC_IXSTATES_URL",
  ]) {
    delete process.env[key];
  }
  if (d === "root" || d === "wikios without an IxStates URL") {
    if (d !== "root") process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    return;
  }
  process.env.NEXT_PUBLIC_BASE_PATH = BASE;
  process.env.BASE_PATH = BASE;
  process.env.NEXT_PUBLIC_IXSTATES_URL = IXSTATES;
  if (d === "ixworld") process.env.NEXT_PUBLIC_IXWORLD_STANDALONE = "true";
  if (d === "wikios") process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
}

afterEach(() => {
  process.env = { ...saved };
  delete (globalThis as { window?: unknown }).window;
});

const helpers = { withBasePath, assetUrl, toRouterPath, ixstatesHref, ixstatesLinkHref };

it.each<[Deployment, keyof typeof helpers, string, string | null]>([
  ["ixstates", "withBasePath", "/vault/store", `${BASE}/vault/store`],
  [
    "ixstates",
    "assetUrl",
    "/images/uploads/uploaded_1_flag.png",
    `${BASE}/images/uploads/uploaded_1_flag.png`,
  ],
  [
    "ixstates",
    "assetUrl",
    "https://ixwiki.com/images/flag.png",
    "https://ixwiki.com/images/flag.png",
  ],
  ["ixstates", "assetUrl", "  ", null],
  ["ixstates", "toRouterPath", `${BASE}/wiki/X?action=edit#a`, "/wiki/X?action=edit#a"],
  ["ixstates", "toRouterPath", `${BASE}${BASE}/wiki/X`, `${BASE}/wiki/X`],
  ["ixstates", "toRouterPath", BASE, "/"],
  ["ixstates", "toRouterPath", `${BASE}x/y`, `${BASE}x/y`],
  // Never a protocol-relative path that would leave the site
  ["ixstates", "toRouterPath", "//example.org/x", "//example.org/x"],
  ["ixstates", "toRouterPath", `${BASE}//evil.com/x`, `${BASE}//evil.com/x`],
  ["ixstates", "toRouterPath", `${BASE}/\\evil.com/x`, `${BASE}/\\evil.com/x`],
  ["ixstates", "ixstatesHref", "/countries/aurelia?tab=x", `${BASE}/countries/aurelia?tab=x`],
  ["ixstates", "ixstatesLinkHref", "/blurbs", "/blurbs"],
  ["ixstates", "ixstatesLinkHref", "mycountry/diplomacy", "/mycountry/diplomacy"],
  ["ixstates", "ixstatesLinkHref", `${BASE}/blurbs`, "/blurbs"],
  ["root", "withBasePath", "/vault/store", "/vault/store"],
  ["root", "toRouterPath", `${BASE}/wiki/X`, `${BASE}/wiki/X`],
  ["ixworld", "withBasePath", "/vault/store", "/vault/store"],
  ["wikios", "ixstatesHref", "/blurbs", `${IXSTATES}/blurbs`],
  ["wikios", "ixstatesHref", `${BASE}/myleague/1`, `${IXSTATES}/myleague/1`],
  ["wikios", "ixstatesHref", "//example.org/x", "//example.org/x"],
  ["wikios", "ixstatesLinkHref", "/blurbs", `${IXSTATES}/blurbs`],
  // A page still renders when the standalone build lacks its IxStates URL
  ["wikios without an IxStates URL", "ixstatesHref", "/blurbs", "/blurbs"],
])("%s: %s(%j) is %j", (deployment, helper, input, expected) => {
  deploy(deployment);
  expect(helpers[helper](input)).toBe(expected);
});

it.each([
  ["on the subpath", `${BASE}/vault/store`, `${BASE}/vault/store`],
  ["at the root (dev)", "/vault/store", "/vault/store"],
])("in the browser %s, withBasePath follows the page's own path", (_where, pathname, expected) => {
  deploy("ixstates");
  (globalThis as { window?: unknown }).window = { location: { pathname, hostname: "localhost" } };
  expect(withBasePath("/vault/store")).toBe(expected);
});

it("sends every IxStates-only route to IxStates from the standalone wiki, and refuses a redirect with no URL", () => {
  deploy("wikios");
  for (const path of [
    "/blurbs",
    "/mycountry",
    "/dashboard",
    "/countries",
    "/vault",
    "/settings",
    "/messages",
    "/maps",
  ]) {
    expect(WIKIOS_ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))).toBe(false);
    expect(ixstatesHref(path)).toBe(`${IXSTATES}${path}`);
  }
  deploy("wikios without an IxStates URL");
  expect(() => wikiStandaloneRedirect("/blurbs", "")).toThrow(WikiStandaloneConfigError);
});

it("hands the router the plain path, and an absolute URL to window.location", () => {
  deploy("ixstates");
  const router = { push: jest.fn() };
  navigateWithBasePath("/mycountry", router);
  navigateWithBasePath(`${BASE}/vault`, router);
  navigateTo(router, `${BASE}/builder`);
  expect(router.push.mock.calls).toEqual([["/mycountry"], ["/vault"], ["/builder"]]);

  const location = { href: "" };
  (globalThis as { window?: unknown }).window = { location };
  navigateWithBasePath("https://example.org/x", router);
  expect(location.href).toBe("https://example.org/x");
  expect(router.push).toHaveBeenCalledTimes(3);
});

it("gives Next an origin-only metadataBase, so page and OG image URLs keep one base path", () => {
  expect(siteMetadataBase("https://example.org/projects/ixstates/").href).toBe(
    "https://example.org/"
  );
  expect(siteMetadataBase("false").href).toBe(`${new URL(mediaWikiOrigin()).origin}/`);
  const base = siteMetadataBase("https://example.org");
  expect(resolveUrl(`${BASE}/@alex`, base).href).toBe(`https://example.org${BASE}/@alex`);
  expect(resolveUrl(`${BASE}/id/alex/opengraph-image?1`, base).href).toBe(
    `https://example.org${BASE}/id/alex/opengraph-image?1`
  );
});
