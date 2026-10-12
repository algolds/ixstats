/**
 * The generic map import wizard's upload refuses a world bundle: it is applied through the map editor's World tab.
 */
import { uploadMapFile } from "~/app/admin/maps/_components/map-import/ImportSourceStep";

const info = (kind: string) => ({
  uploadId: "a".repeat(64),
  kind,
  filename: "map.file",
  size: 10,
  width: null,
  height: null,
});

function respondWith(status: number, body: object) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe("uploadMapFile", () => {
  it("returns what the server says about a map file", async () => {
    respondWith(200, info("geojson"));
    await expect(uploadMapFile("r1", new File(["{}"], "map.geojson"))).resolves.toMatchObject({
      kind: "geojson",
    });
  });

  it("refuses a world bundle and points to the World tab", async () => {
    respondWith(200, info("world"));
    await expect(uploadMapFile("r1", new File(["x"], "world.json.gz"))).rejects.toThrow(
      /World tab of the map editor/
    );
  });

  it("raises the server's reason for a file it refused", async () => {
    respondWith(400, { error: "That file is not a world bundle: cells is not valid base64" });
    await expect(uploadMapFile("r1", new File(["x"], "world.json.gz"))).rejects.toThrow(
      /not a world bundle/
    );
  });
});
