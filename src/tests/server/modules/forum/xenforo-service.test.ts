import {
  xfFetch,
  xfFetchAsUser,
  xfPost,
  xfPostAsUser,
  getXfApiKey,
  getXfApiUrl,
} from "~/server/modules/forum";

describe("XenForo Service (Canonical Transport)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("xfFetch returns null when API key is missing", async () => {
    const originalKey = process.env.XENFORO_API_KEY;
    try {
      delete process.env.XENFORO_API_KEY;
      const result = await xfFetch("/test");
      expect(result).toBeNull();
    } finally {
      process.env.XENFORO_API_KEY = originalKey;
    }
  });

  test("xfFetch constructs valid headers and returns parsed JSON on 200 OK", async () => {
    process.env.XENFORO_API_KEY = "test-api-key";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true, data: "forums" }),
    } as any);

    const result = await xfFetch<{ success: boolean; data: string }>("/nodes/");

    expect(result).toEqual({ success: true, data: "forums" });
    expect(global.fetch).toHaveBeenCalledWith(
      `${getXfApiUrl()}/nodes/`,
      expect.objectContaining({
        headers: {
          "XF-Api-Key": "test-api-key",
          Accept: "application/json",
        },
      })
    );
  });

  test("xfFetch returns null on non-OK response", async () => {
    process.env.XENFORO_API_KEY = "test-api-key";

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await xfFetch("/nodes/999/");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith("[XenForo] HTTP 404 for /nodes/999/");
  });

  test("xfFetchAsUser includes XF-Api-User header", async () => {
    process.env.XENFORO_API_KEY = "test-api-key";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ user: { user_id: 42 } }),
    } as any);

    const result = await xfFetchAsUser<{ user: { user_id: number } }>("/users/me/", 42);

    expect(result).toEqual({ user: { user_id: 42 } });
    expect(global.fetch).toHaveBeenCalledWith(
      `${getXfApiUrl()}/users/me/`,
      expect.objectContaining({
        headers: expect.objectContaining({
          "XF-Api-Key": "test-api-key",
          "XF-Api-User": "42",
          Accept: "application/json",
        }),
      })
    );
  });
});
