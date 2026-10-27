/** @jest-environment node */
/**
 * A render MediaWiki did not deliver says why, in one throttled line: the HTTP status and the start of a body that is
 * not JSON (a Cloudflare or nginx page), MediaWiki's API error code, a timeout or a network error, or a local refusal.
 */
import {
  logRenderFailure,
  RENDER_FAILURE_LOGS_PER_MINUTE,
  renderArticleViaMediaWiki,
} from "~/lib/wiki-os/adapters/mediawiki/parsoid";

const mockLoopbackMissing = jest.fn(() => false);
jest.mock("~/lib/wiki-os/config", () => ({
  ...jest.requireActual<typeof import("~/lib/wiki-os/config")>("~/lib/wiki-os/config"),
  DEFAULT_USER_AGENT: "IxStats-Builder",
  getMediaWikiApiUrl: () => "https://wiki.test/api.php",
  loopbackRendererMissing: () => mockLoopbackMissing(),
}));

let warn: jest.SpyInstance;
let fetchSpy: jest.SpiedFunction<typeof fetch>;
/** A minute past the last test's window, so each test starts with the whole budget. */
let clock = 0;

beforeEach(() => {
  warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  fetchSpy = jest.spyOn(global, "fetch");
  mockLoopbackMissing.mockReturnValue(false);
  clock += 10 * 60_000;
  jest.spyOn(Date, "now").mockReturnValue(clock);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const lines = (): string[] => warn.mock.calls.map((call) => String(call[0]));

async function failWith(response: Response | Error): Promise<string> {
  if (response instanceof Error) fetchSpy.mockRejectedValueOnce(response);
  else fetchSpy.mockResolvedValueOnce(response);
  await expect(renderArticleViaMediaWiki("Some text", "Post-nominals")).resolves.toBeNull();
  return lines().at(-1) ?? "";
}

describe("why a render failed", () => {
  it("a page that is not JSON: the status and the start of the body", async () => {
    const line = await failWith(
      new Response("<html>\n<title>Just a moment...</title></html>", { status: 403 })
    );
    expect(line).toBe(
      '[WikiOS:render] MediaWiki did not render "Post-nominals": HTTP 403, not JSON: "<html> <title>Just a moment...</title></html>"'
    );
  });

  it("a MediaWiki API error: its code and info", async () => {
    const body = JSON.stringify({
      error: { code: "internal_api_error_Error", info: "Caught exception" },
    });
    expect(await failWith(new Response(body, { status: 200 }))).toContain(
      'HTTP 200, MediaWiki API error internal_api_error_Error: "Caught exception"'
    );
  });

  it("an answer with no page text, and an error status with a JSON body", async () => {
    expect(await failWith(new Response(JSON.stringify({ parse: {} }), { status: 200 }))).toContain(
      "HTTP 200, no page text in the response"
    );
    expect(await failWith(new Response(JSON.stringify({ busy: true }), { status: 503 }))).toContain(
      'HTTP 503: "{\\"busy\\":true}"'
    );
  });

  it("a timeout, and a network error with its code", async () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    expect(await failWith(timeout)).toContain('"Post-nominals": no answer within 6000 ms');
    const reset = new TypeError("fetch failed", {
      cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }),
    });
    expect(await failWith(reset)).toContain(
      "network error: TypeError: fetch failed (UND_ERR_SOCKET)"
    );
  });

  it("a local refusal sends no request", async () => {
    mockLoopbackMissing.mockReturnValue(true);
    await expect(renderArticleViaMediaWiki("Some text", "Post-nominals")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(lines().at(-1)).toContain('"Post-nominals": refused locally');
  });

  it("a render that works logs nothing", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ parse: { text: "<p>Hi</p>" } }), { status: 200 })
    );
    await expect(renderArticleViaMediaWiki("Some text", "Post-nominals")).resolves.toMatchObject({
      html: "<p>Hi</p>",
    });
    expect(lines().filter((line) => line.includes("did not render"))).toEqual([]);
  });
});

describe("the failure log's throttle", () => {
  it("writes at most the per-minute budget, then names how many it left out on the next line", () => {
    for (let i = 0; i < RENDER_FAILURE_LOGS_PER_MINUTE + 3; i++)
      logRenderFailure(`P${i}`, "HTTP 429", clock);
    expect(lines()).toHaveLength(RENDER_FAILURE_LOGS_PER_MINUTE);
    logRenderFailure("Later", "HTTP 429", clock + 59_999);
    expect(lines()).toHaveLength(RENDER_FAILURE_LOGS_PER_MINUTE);
    logRenderFailure("Next minute", "HTTP 429", clock + 60_000);
    expect(lines().at(-1)).toBe(
      '[WikiOS:render] MediaWiki did not render "Next minute": HTTP 429 (4 earlier failures not logged)'
    );
    logRenderFailure("After", "HTTP 429", clock + 60_001);
    expect(lines().at(-1)).not.toContain("not logged");
  });
});
