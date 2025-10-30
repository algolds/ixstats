import type { Mock } from "jest-mock";

type FetchMock = Mock<Promise<unknown>, [unknown, RequestInit?]>;

const ORIGINAL_ENV = process.env;
const globalWithWindow = global as typeof global & { window?: unknown };
const ORIGINAL_WINDOW = globalWithWindow.window;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

function mockFetch() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      query: {
        search: [],
      },
    }),
  }) as FetchMock;
}

describe("wiki-search-service base path handling", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    if (ORIGINAL_WINDOW === undefined) {
      // Ensure JSDOM window isn't leaked between tests
      delete globalWithWindow.window;
    } else {
      globalWithWindow.window = ORIGINAL_WINDOW;
    }
    mockFetch();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    if (ORIGINAL_WINDOW === undefined) {
      delete globalWithWindow.window;
    } else {
      globalWithWindow.window = ORIGINAL_WINDOW;
    }
    jest.restoreAllMocks();
  });

  it("prefixes API proxy calls with base path on the server", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstats";
    process.env.NEXT_PUBLIC_APP_URL = "https://ixstats.example.com/projects/ixstats";

    const { searchWiki } = await import("../wiki-search-service");
    await searchWiki("Caphiria", "ixwiki");

    const fetchCalls = (global.fetch as FetchMock).mock.calls;
    const targetCall = fetchCalls.find(
      ([url]) => typeof url === "string" && url.includes("/api/ixwiki-proxy")
    );
    expect(targetCall).toBeDefined();
    expect(targetCall?.[0] as string).toMatch(
      /^https:\/\/ixstats\.example\.com\/projects\/ixstats\/api\/ixwiki-proxy\/wiki\/api\.php\?/
    );
  });

  it("prefixes API proxy calls with base path on the client", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstats";
    // Simulate browser environment
    globalWithWindow.window = {};

    const { searchWiki } = await import("../wiki-search-service");
    await searchWiki("Caphiria", "iiwiki");

    const fetchCalls = (global.fetch as FetchMock).mock.calls;
    const targetCall = fetchCalls.find(
      ([url]) => typeof url === "string" && url.includes("/api/iiwiki-proxy")
    );
    expect(targetCall).toBeDefined();
    expect(targetCall?.[0] as string).toMatch(
      /^\/projects\/ixstats\/api\/iiwiki-proxy\/wiki\/api\.php\?/
    );
  });

  it("supports all configured wiki endpoints", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstats";
    process.env.NEXT_PUBLIC_APP_URL = "https://ixstats.example.com/projects/ixstats";

    const { searchWiki } = await import("../wiki-search-service");

    await searchWiki("Caphiria", "ixwiki");
    await searchWiki("Caphiria", "iiwiki");
    await searchWiki("Caphiria", "althistory");

    const fetchCalls = (global.fetch as FetchMock).mock.calls.map((call) => call[0] as string);

    expect(fetchCalls.some((url) => url.includes("/api/ixwiki-proxy/wiki/api.php?"))).toBe(true);
    expect(fetchCalls.some((url) => url.includes("/api/iiwiki-proxy/wiki/api.php?"))).toBe(true);
    expect(fetchCalls.some((url) => url.includes("/api/althistory-wiki-proxy/api.php?"))).toBe(
      true
    );
  });

  it("falls back to localhost base when server env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.VERCEL_URL;
    process.env.PORT = "4567";

    const { searchWiki } = await import("../wiki-search-service");
    await searchWiki("Caphiria", "ixwiki");

    const calledUrl = (global.fetch as FetchMock).mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/^http:\/\/localhost:4567\/api\/ixwiki-proxy\/wiki\/api\.php\?/);
  });
});
