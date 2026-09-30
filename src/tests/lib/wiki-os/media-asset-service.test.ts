/**
 * media-asset-service.test.ts — Unit tests for WikiOS Media Asset Engine
 */

import { describe, expect, it, jest } from "@jest/globals";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";

describe("MediaAssetService MD5 Shard Path Calculation", () => {
  it("calculates accurate MD5 shards and paths for filenames", () => {
    const result1 = MediaAssetService.getMd5ShardPath("Caphiria_flag.svg");
    expect(result1.shard).toBeDefined();
    expect(result1.fullPath).toContain("Caphiria_flag.svg");
    expect(result1.cleanName).toBe("Caphiria_flag.svg");

    const result2 = MediaAssetService.getMd5ShardPath("File:National Emblem of Vesper.png");
    expect(result2.cleanName).toBe("National_Emblem_of_Vesper.png");
    expect(result2.fullPath).toContain("National_Emblem_of_Vesper.png");
  });

  it("extracts image references from mixed wikitext, infoboxes, and HTML", async () => {
    const content = `
      {{Infobox Country
      | name = Sovereign Republic of Vesper
      | flag = Vesper_Flag_Official.svg
      | coat_of_arms = Seal_of_Vesper.png
      }}

      The nation's capital features a grand monument [[File:Central_Square_View.jpg|thumb|300px|Central Square]].

      <img src="/images/8/8c/Historical_Map.png" alt="Map" />
    `;

    const registerSpy = jest.spyOn(MediaAssetService, "registerAsset").mockResolvedValue({
      id: "test-id",
      title: "Test",
      slug: "test",
      filename: "test.png",
      url: "https://ixwiki.com/images/test.png",
      thumbnailUrl: null,
      mimeType: "image/png",
      sizeBytes: 1024,
      width: 800,
      height: 600,
      blurhash: null,
      md5Hash: "testhash",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const count = await MediaAssetService.processContentImages(content);
    expect(count).toBeGreaterThanOrEqual(3);
    registerSpy.mockRestore();
  });
});
