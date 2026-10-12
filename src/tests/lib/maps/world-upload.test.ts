/** @jest-environment node */
/**
 * The browser's upload of a map file or a world bundle to the map import route: what is sent, and how a refusal
 * reaches the caller (the server's reason and the HTTP status).
 */
import { MAX_MAP_IMPORT_BYTES } from "~/lib/maps/import/options";
import { MapUploadError, postMapUpload, uploadWorldBundle } from "~/lib/maps/import/upload-client";

const info = {
  uploadId: "a".repeat(64),
  kind: "world",
  filename: "world.json.gz",
  size: 10,
  width: null,
  height: null,
};

let fetchMock: jest.SpyInstance;
const respondWith = (status: number, body: object) =>
  fetchMock.mockResolvedValue(Response.json(body, { status }));

beforeEach(() => {
  fetchMock = jest.spyOn(globalThis, "fetch");
});
afterEach(() => jest.restoreAllMocks());

describe("uploadWorldBundle", () => {
  it("posts the gzip bytes as the file field to the realm's upload route", async () => {
    respondWith(200, info);
    const bytes = new Uint8Array([0x1f, 0x8b, 0x08, 1, 2, 3]);
    await expect(uploadWorldBundle("r_eurth", bytes)).resolves.toMatchObject({
      uploadId: info.uploadId,
      kind: "world",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("/api/admin/map-import/upload?realm=r_eurth");
    expect(init.method).toBe("POST");
    const file = (init.body as FormData).get("file") as File;
    expect(file.name).toBe("world.json.gz");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
  });

  it("raises the server's reason with the HTTP status", async () => {
    respondWith(409, { error: "The world is locked: 1 claim is pending or approved" });
    await expect(uploadWorldBundle("r1", new Uint8Array([1]))).rejects.toMatchObject({
      name: "MapUploadError",
      message: "The world is locked: 1 claim is pending or approved",
      status: 409,
    });
  });

  it("says the status when the route answered with something that is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
    await expect(uploadWorldBundle("r1", new Uint8Array([1]))).rejects.toMatchObject({
      message: "Upload failed (502)",
      status: 502,
    });
  });
});

describe("postMapUpload", () => {
  it("refuses a file over the limit without sending it", async () => {
    const big = new File([new Uint8Array(MAX_MAP_IMPORT_BYTES + 1)], "big.png");
    const error = await postMapUpload("r1", big).catch((e: MapUploadError) => e);
    expect(error).toBeInstanceOf(MapUploadError);
    expect(error).toMatchObject({ message: "Map files are limited to 40 MB", status: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
