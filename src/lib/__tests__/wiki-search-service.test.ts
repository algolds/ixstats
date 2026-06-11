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
  }) as any;
}

describe("wiki-search-service base path handling", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    globalWithWindow.window = ORIGINAL_WINDOW as any;
    delete (global as any).__TEST_IS_SERVER;
    mockFetch();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    globalWithWindow.window = ORIGINAL_WINDOW as any;
    delete (global as any).__TEST_IS_SERVER;
    jest.restoreAllMocks();
  });

  it("prefixes API proxy calls with base path on the server", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    process.env.NEXT_PUBLIC_APP_URL = "https://ixstates.example.com/projects/ixstates";

    // Simulate server side
    (global as any).__TEST_IS_SERVER = true;
    globalWithWindow.window = undefined as any;

    const { searchWiki } = await import("../wiki-search-service");
    await searchWiki("Caphiria", "ixwiki");

    // Restore window / server simulation
    delete (global as any).__TEST_IS_SERVER;
    globalWithWindow.window = ORIGINAL_WINDOW as any;

    const fetchCalls = (global.fetch as any).mock.calls as any[][];
    const targetCall = fetchCalls.find(
      ([url]: any[]) => typeof url === "string" && url.includes("/api/mediawiki/ixwiki")
    );
    expect(targetCall).toBeDefined();
    expect(targetCall?.[0] as string).toMatch(
      /^https:\/\/ixstates\.example\.com\/projects\/ixstates\/api\/mediawiki\/ixwiki\/api\.php\?/
    );
  });

  it("prefixes API proxy calls with base path on the client", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    // Simulate browser environment
    globalWithWindow.window = {} as any;
    delete (global as any).__TEST_IS_SERVER;

    const { searchWiki } = await import("../wiki-search-service");
    await searchWiki("Caphiria", "ixwiki");

    const fetchCalls = (global.fetch as any).mock.calls as any[][];
    const targetCall = fetchCalls.find(
      ([url]: any[]) => typeof url === "string" && url.includes("/api/mediawiki/ixwiki")
    );
    expect(targetCall).toBeDefined();
    expect(targetCall?.[0] as string).toMatch(
      /^\/projects\/ixstates\/api\/mediawiki\/ixwiki\/api\.php\?/
    );
  });

  it("supports all configured wiki endpoints", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    process.env.NEXT_PUBLIC_APP_URL = "https://ixstates.example.com/projects/ixstates";

    const { searchWiki } = await import("../wiki-search-service");

    await searchWiki("Caphiria", "ixwiki");
    await searchWiki("Caphiria", "iiwiki");
    await searchWiki("Caphiria", "althistory");

    const fetchCalls = ((global.fetch as any).mock.calls as any[][]).map((call: any[]) => call[0] as string);

    expect(fetchCalls.some((url: string) => url.includes("/api/mediawiki/ixwiki/api.php?"))).toBe(true);
    expect(fetchCalls.some((url: string) => url.includes("https://iiwiki.com/api.php?"))).toBe(true);
    expect(fetchCalls.some((url: string) => url.includes("/api/mediawiki/althistory/api.php?"))).toBe(
      true
    );
  });

  it("falls back to localhost base when server env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.VERCEL_URL;
    process.env.PORT = "4567";

    // Simulate server side
    (global as any).__TEST_IS_SERVER = true;
    globalWithWindow.window = undefined as any;

    const { searchWiki } = await import("../wiki-search-service");
    await searchWiki("Caphiria", "ixwiki");

    // Restore window / server simulation
    delete (global as any).__TEST_IS_SERVER;
    globalWithWindow.window = ORIGINAL_WINDOW as any;

    const fetchCalls = (global.fetch as any).mock.calls as any[][];
    const targetCall = fetchCalls.find(
      ([url]: any[]) => typeof url === "string" && url.includes("/api/mediawiki/ixwiki")
    );
    expect(targetCall).toBeDefined();
    expect(targetCall?.[0] as string).toMatch(
      /^http:\/\/localhost:4567\/api\/mediawiki\/ixwiki\/api\.php\?/
    );
  });
});
