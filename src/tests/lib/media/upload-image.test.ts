/**
 * @jest-environment node
 */
import { uploadImageFile, UploadImageError } from "~/lib/media/upload-image";

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("uploadImageFile", () => {
  const originalFetch = global.fetch;
  const file = new File(["png-bytes"], "dance.png", { type: "image/png" });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("posts the file as multipart form data and returns the uploaded URL", async () => {
    const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async () =>
      jsonResponse({ success: true, url: "/images/uploads/uploaded_1_abc_dance.png" })
    );
    global.fetch = fetchMock;

    await expect(uploadImageFile(file)).resolves.toBe("/images/uploads/uploaded_1_abc_dance.png");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/upload\/image$/);
    expect(init?.method).toBe("POST");
    const body = init?.body as FormData;
    expect((body.get("file") as File).name).toBe("dance.png");
  });

  it("throws the route's error message when the upload is rejected", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ success: false, error: "File size exceeds 5MB limit" }, 400)
    );

    await expect(uploadImageFile(file)).rejects.toThrow("File size exceeds 5MB limit");
  });

  it("throws a generic error when the response is not JSON", async () => {
    global.fetch = jest.fn(async () => new Response("<html>413</html>", { status: 413 }));

    await expect(uploadImageFile(file)).rejects.toThrow("Upload failed");
  });

  it("throws when a success response carries no URL", async () => {
    global.fetch = jest.fn(async () => jsonResponse({ success: true }));

    await expect(uploadImageFile(file)).rejects.toThrow("Upload failed");
  });

  it("reports the HTTP status when the server answers with an HTML error page", async () => {
    global.fetch = jest.fn(async () => new Response("<html>413</html>", { status: 413 }));

    const error = await uploadImageFile(file).catch((e: Error) => e);

    expect(error).toBeInstanceOf(UploadImageError);
    expect((error as UploadImageError).status).toBe(413);
  });

  it("carries the retry hint of a rate-limited upload", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ success: false, error: "Too many uploads", retryAfter: 30 }, 429)
    );

    const error = await uploadImageFile(file).catch((e: Error) => e);

    expect(error).toBeInstanceOf(UploadImageError);
    expect((error as UploadImageError).status).toBe(429);
    expect((error as UploadImageError).retryAfter).toBe(30);
  });

  it("passes the abort signal to fetch", async () => {
    const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async () =>
      jsonResponse({ success: true, url: "/images/uploads/x.png" })
    );
    global.fetch = fetchMock;
    const controller = new AbortController();

    await uploadImageFile(file, { signal: controller.signal });

    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
  });
});
