/** @jest-environment node */
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";

// Reference values computed independently (hashlib + a hand-written base-36 conversion).
describe("mwSha1Base36", () => {
  it("matches MediaWiki's hash of the empty text", () => {
    expect(mwSha1Base36("")).toBe("phoiac9h4m842xq45sp7s6u21eteeq1");
  });

  it.each([
    ["a", "frkhg3ewxov0h1g2eh87fri7z1g12ns"],
    ["Hello, world!", "hbbvduyzg9rvcn7s9tgwxvh7c4u19y1"],
  ])("hashes %j", (text, expected) => {
    expect(mwSha1Base36(text)).toBe(expected);
  });

  it("hashes the UTF-8 bytes of non-ASCII text", () => {
    expect(mwSha1Base36("é")).toBe("mbjtohs1ktyw7gssrnlvnpbszhhlflp");
    expect(mwSha1Base36("漢字🙂")).toBe("nq3loq1au93zsifzk7021o82b280ybq");
  });

  it("left-pads a small digest with zeros to 31 characters", () => {
    expect(mwSha1Base36("pad10")).toBe("0xppfai6ugrm8kqtj77un9sv64fkg0z");
  });
});
