import { TextDecoder, TextEncoder } from "util";

import { crc32 } from "~/lib/worldgen/zip-store";
import {
  REVOKE_DELAY_MS,
  downloadBlob,
  exportFileName,
  geojsonZip,
  layerFiles,
  pngFailureText,
} from "~/lib/worldgen/world-export";
import { worldResult } from "~/tests/helpers/fake-world-worker";

// jsdom has neither; the browser does
Object.assign(globalThis, { TextEncoder, TextDecoder });

describe("worldgen/world-export", () => {
  it("makes one geojson file per layer of the world, from the layer's own text", () => {
    const result = worldResult();
    const files = layerFiles(result);
    expect(files.map((f) => f.name).sort()).toEqual(
      Object.keys(result.layers)
        .map((layer) => `${layer}.geojson`)
        .sort()
    );
    const political = files.find((f) => f.name === "political.geojson")!;
    expect(new TextDecoder().decode(political.data)).toBe(result.layers.political);
    expect(files.map((f) => f.name)).toContain("icecaps.geojson");
  });

  it("zips them, each file's CRC in the directory", () => {
    const result = worldResult();
    const zip = geojsonZip(result);
    expect(new TextDecoder().decode(zip.subarray(30, 30 + "background.geojson".length))).toBe(
      "background.geojson"
    );
    const first = layerFiles(result)[0]!;
    expect(new DataView(zip.buffer).getUint32(14, true)).toBe(crc32(first.data));
  });

  it("names the files for the preset and the seed", () => {
    expect(exportFileName("eurth", 1234)).toBe("world-eurth-1234.zip");
    expect(exportFileName("eurth", 1234, 4096)).toBe("world-eurth-1234-4096.png");
  });

  it("words a failed image by its width", () => {
    expect(pngFailureText(8192)).toBe("Your browser could not make an image this large. Try 4096.");
    expect(pngFailureText(4096)).toContain("Try 2048");
    expect(pngFailureText(2048)).not.toContain("Try");
  });

  it("downloads from a blob URL it revokes afterwards", () => {
    jest.useFakeTimers();
    const create = jest.fn(() => "blob:world");
    const revoke = jest.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    const clicked: Array<{ href: string; download: string }> = [];
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked.push({ href: this.href, download: this.download });
    });

    downloadBlob(new Blob(["x"]), "world-a-1.zip");
    expect(clicked).toEqual([{ href: "blob:world", download: "world-a-1.zip" }]);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    jest.advanceTimersByTime(REVOKE_DELAY_MS);
    expect(revoke).toHaveBeenCalledWith("blob:world");

    click.mockRestore();
    jest.useRealTimers();
  });
});
