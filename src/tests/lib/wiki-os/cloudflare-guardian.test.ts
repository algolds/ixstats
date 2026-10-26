/** @jest-environment node */
/**
 * The edge purge on a save (cloudflare-guardian.ts): classic's page (which the mirror changes) and the reader's
 * canonical URL on IxStates' own host and base path, both by the title's percent-encoded path. The base path comes
 * from the deployment, never a hard-coded one; a purge that cannot be built or is refused is logged, never thrown.
 */
import { CloudflareGuardian } from "~/lib/wiki-os/guardian/cloudflare-guardian";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

const KEYS = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ZONE_ID",
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "BASE_PATH",
  "NEXT_PUBLIC_BASE_PATH",
  "NODE_ENV",
] as const;
const env = process.env as Record<string, string | undefined>;
const saved = Object.fromEntries(KEYS.map((key) => [key, env[key]]));
const realFetch = global.fetch;
const fetchMock = jest.fn();

/** The `files` of the one purge request sent. */
function purgedFiles(): string[] {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("https://api.cloudflare.com/client/v4/zones/zone-1/purge_cache");
  return (JSON.parse(String(init.body)) as { files: string[] }).files;
}

beforeEach(() => {
  for (const key of KEYS) delete env[key];
  env.NODE_ENV = "test";
  env.CLOUDFLARE_API_TOKEN = "token-1";
  env.CLOUDFLARE_ZONE_ID = "zone-1";
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ success: true })));
  global.fetch = fetchMock;
});

afterEach(() => {
  global.fetch = realFetch;
  jest.restoreAllMocks();
  for (const key of KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
});

describe("CloudflareGuardian.purgeArticleEdgeCache", () => {
  it("purges classic's page and the reader's canonical URL under the base path; no hard-coded base path", async () => {
    env.NEXT_PUBLIC_APP_URL = "https://app.example.org/ignored/path";
    env.BASE_PATH = "/staging/app";

    await CloudflareGuardian.purgeArticleEdgeCache("Holy See");

    expect(purgedFiles()).toEqual([
      `${mediaWikiOrigin()}/wiki/Holy_See`,
      "https://app.example.org/staging/app/wiki/Holy_See",
    ]);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("/projects/ixstates");
  });

  it("on production's base path the reader's URL carries it once", async () => {
    env.NEXT_PUBLIC_APP_URL = "https://ixwiki.com/projects/ixstates";
    env.BASE_PATH = "/projects/ixstates";

    await CloudflareGuardian.purgeArticleEdgeCache("Ćaphiria");

    expect(purgedFiles()).toEqual([
      `${mediaWikiOrigin()}/wiki/%C4%86aphiria`,
      "https://ixwiki.com/projects/ixstates/wiki/%C4%86aphiria",
    ]);
  });

  it("sends nothing without the Cloudflare credentials", async () => {
    delete env.CLOUDFLARE_ZONE_ID;
    await CloudflareGuardian.purgeArticleEdgeCache("Holy See");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("purges classic's URL only, warns naming NEXT_PUBLIC_APP_URL", async () => {
    env.NODE_ENV = "production";
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(CloudflareGuardian.purgeArticleEdgeCache("Holy See")).resolves.toBeUndefined();

    expect(purgedFiles()).toEqual([`${mediaWikiOrigin()}/wiki/Holy_See`]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]!.map(String).join(" ")).toMatch(/NEXT_PUBLIC_APP_URL/);
  });
});
