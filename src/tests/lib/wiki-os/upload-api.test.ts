/**
 * Plan 411: the browser's side of the upload route: the query string the file's fields travel in, the warnings as
 * sentences, and the request itself (the file is the body, a refusal carries MediaWiki's code).
 */
import { MAX_UPLOAD_BYTES } from "~/lib/wiki-os/config";
import {
  describeWarnings,
  postUpload,
  UploadFailed,
  uploadQuery,
  uploadSizeProblem,
} from "~/lib/wiki-os/upload-api";

describe("uploadQuery", () => {
  it("carries only what is set, trimmed, with a parameter for each category", () => {
    const query = new URLSearchParams(
      uploadQuery({
        filename: "Flag of Eurth.png",
        description: "  A flag  ",
        license: "",
        categories: ["Flags", " ", "Eurth"],
        comment: "First",
        ignoreWarnings: true,
      })
    );

    expect(query.get("filename")).toBe("Flag of Eurth.png");
    expect(query.get("description")).toBe("A flag");
    expect(query.has("license")).toBe(false);
    expect(query.getAll("category")).toEqual(["Flags", "Eurth"]);
    expect(query.get("comment")).toBe("First");
    expect(query.get("ignorewarnings")).toBe("1");
  });

  it("does not ask to ignore warnings unless told to", () => {
    expect(uploadQuery({ filename: "A.png" })).toBe("filename=A.png");
  });
});

describe("warnings as sentences", () => {
  it("says a taken name will be replaced, and the same file is already the current version", () => {
    expect(describeWarnings({ exists: "Flag.png" })).toEqual([
      'A file called "Flag.png" already exists. Uploading will replace it with a new version.',
    ]);
    expect(describeWarnings({ exists: "Flag.png", nochange: true })).toEqual([
      '"Flag.png" already has exactly this file as its current version.',
    ]);
  });

  it("lists the other names that hold the same file", () => {
    expect(describeWarnings({ duplicate: ["A.png", "B.png"] })).toEqual([
      'The same file is already uploaded as "A.png", "B.png".',
    ]);
  });
});

describe("postUpload", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("does not send a file over the limit", async () => {
    const big = { size: MAX_UPLOAD_BYTES + 1, type: "image/png" } as Blob;

    expect(uploadSizeProblem(big)).toContain("10 MB");
    await expect(postUpload(big, { filename: "Big.png" })).rejects.toMatchObject({
      code: "file-too-large",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the file as the body with its own type, and falls back to octet-stream", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: "Success" }),
    });
    const file = new File([new Uint8Array([1])], "x.pdf", { type: "" });

    await postUpload(file, { filename: "x.pdf" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/wiki/upload?filename=x.pdf");
    expect(init).toMatchObject({
      method: "POST",
      body: file,
      headers: { "Content-Type": "application/octet-stream" },
    });
  });

  it("rejects with the code and the sentence of a refusal", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "blocked: You are blocked from editing.", code: "blocked" }),
    });

    const failure = await postUpload(new Blob([new Uint8Array([1])]), { filename: "x.png" }).catch(
      (e: unknown) => e
    );

    expect(failure).toBeInstanceOf(UploadFailed);
    expect(failure).toMatchObject({
      code: "blocked",
      message: "blocked: You are blocked from editing.",
    });
  });

  it("says so when the answer is not JSON at all (a proxy's error page)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => {
        throw new SyntaxError("not json");
      },
    });

    await expect(
      postUpload(new Blob([new Uint8Array([1])]), { filename: "x.png" })
    ).rejects.toMatchObject({
      code: "upload-failed",
      message: "The upload failed (413).",
    });
  });
});
