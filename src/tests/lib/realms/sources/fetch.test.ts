/** @jest-environment node */
import { fetchRepoFile, rawGithubUrl, SourceFetchError } from "~/lib/realms/sources/fetch";

const file = { repo: "a-seth-harrison/eurth-map", ref: "main", path: "eurth-map/src/data/nations.js" };

function response(body: string, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(body, { status: init.status ?? 200, headers: init.headers });
}

describe("rawGithubUrl", () => {
  it("builds a raw.githubusercontent.com URL from a validated repo, ref and path", () => {
    expect(rawGithubUrl(file).toString()).toBe(
      "https://raw.githubusercontent.com/a-seth-harrison/eurth-map/main/eurth-map/src/data/nations.js"
    );
    expect(rawGithubUrl({ ...file, path: "a dir/file name.js" }).pathname).toContain("a%20dir/file%20name.js");
  });

  it.each([
    ["a repo without owner", { ...file, repo: "eurth-map" }],
    ["a repo with a host", { ...file, repo: "evil.example/x/y" }],
    ["a dot-dot repo", { ...file, repo: "owner/.." }],
    ["a ref with ..", { ...file, ref: "main/../../x" }],
    ["a path with ..", { ...file, path: "eurth-map/../../etc/passwd" }],
    ["an absolute path", { ...file, path: "/etc/passwd" }],
    ["a path with a backslash", { ...file, path: "a\\b" }],
    ["a URL as path", { ...file, path: "https://evil.example/x" }],
  ])("refuses %s", (_label, bad) => {
    expect(() => rawGithubUrl(bad)).toThrow(SourceFetchError);
  });
});

describe("fetchRepoFile", () => {
  it("reads the file without following redirects", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response("const nations = {};"));
    await expect(fetchRepoFile(file, { fetchImpl })).resolves.toBe("const nations = {};");
    expect(fetchImpl.mock.calls[0][0]).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("refuses a redirect (it could point at another host)", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(response("", { status: 302, headers: { location: "https://evil.example/" } }));
    await expect(fetchRepoFile(file, { fetchImpl })).rejects.toThrow(/redirect/);
  });

  it("refuses a file over the size cap, by header or while streaming", async () => {
    const declared = jest
      .fn()
      .mockResolvedValue(response("x", { headers: { "content-length": String(10_000_000) } }));
    await expect(fetchRepoFile(file, { fetchImpl: declared, maxBytes: 1000 })).rejects.toThrow(/larger/);
    const streamed = jest.fn().mockResolvedValue(response("x".repeat(2000)));
    await expect(fetchRepoFile(file, { fetchImpl: streamed, maxBytes: 1000 })).rejects.toThrow(/larger/);
  });

  it("reports HTTP errors and time-outs as fetch errors", async () => {
    const notFound = jest.fn().mockResolvedValue(response("nope", { status: 404 }));
    await expect(fetchRepoFile(file, { fetchImpl: notFound })).rejects.toThrow(/HTTP 404/);
    const hang = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) =>
          init.signal.addEventListener("abort", () => reject(new Error("aborted")))
        )
    );
    await expect(fetchRepoFile(file, { fetchImpl: hang as never, timeoutMs: 20 })).rejects.toThrow(/timed out/);
  });

  it("never sends a request for a refused file", async () => {
    const fetchImpl = jest.fn();
    await expect(fetchRepoFile({ ...file, path: "../x" }, { fetchImpl })).rejects.toThrow(SourceFetchError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
