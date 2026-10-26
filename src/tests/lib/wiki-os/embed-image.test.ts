/** @jest-environment node */
/**
 * An embed card's stored image (user content) loads only as its wiki's images are served: a sister's through its
 * media proxy, IxWiki's from IxWiki's own host or as a same-origin upload. Anything else is no image.
 */
import { embedImageSrc, pickableEmbedImages } from "~/lib/wiki-os/embed-image";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

const KEYS = ["NEXT_PUBLIC_BASE_PATH", "BASE_PATH", "NEXT_PUBLIC_IXWORLD_STANDALONE"] as const;
const env = process.env as Record<string, string | undefined>;
const saved = KEYS.map((key) => [key, env[key]] as const);

beforeEach(() => {
  for (const key of KEYS) delete env[key];
});

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
});

const ORIGIN = mediaWikiOrigin();
const HOST = new URL(ORIGIN).host;

describe("embedImageSrc for IxWiki", () => {
  it.each([
    [`${ORIGIN}/images/a/ab/Port.png`, `${ORIGIN}/images/a/ab/Port.png`],
    [
      `https://www.${HOST}/images/thumb/a/ab/Port.png/300px-Port.png`,
      `${ORIGIN}/images/thumb/a/ab/Port.png/300px-Port.png`,
    ],
    [`http://${HOST}/images/a/ab/Port.png`, `${ORIGIN}/images/a/ab/Port.png`],
    [`//${HOST}/data/map.svg?v=2`, `${ORIGIN}/data/map.svg?v=2`],
    [`  ${ORIGIN}/images/a/ab/Port.png  `, `${ORIGIN}/images/a/ab/Port.png`],
  ])("a file on IxWiki's own host (%s) loads from its origin", (url, src) => {
    expect(embedImageSrc(url, "ixwiki")).toBe(src);
  });

  it.each([
    ["/images/uploads/uploaded_1.png", "/images/uploads/uploaded_1.png"],
    ["/api/wiki/file/Port.png", "/api/wiki/file/Port.png"],
    ["/images/uploads/a.png?x=1", "/images/uploads/a.png?x=1"],
  ])("a same-origin upload (%s) loads from the app", (url, src) => {
    expect(embedImageSrc(url, "ixwiki")).toBe(src);
  });

  it("an upload gets the base path once, stored with it or without", () => {
    env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    expect(embedImageSrc("/images/uploads/a.png", "ixwiki")).toBe(
      "/projects/ixstates/images/uploads/a.png"
    );
    expect(embedImageSrc("/projects/ixstates/images/uploads/a.png", "ixwiki")).toBe(
      "/projects/ixstates/images/uploads/a.png"
    );
  });

  it.each([
    ["another host", "https://evil.example/images/a.png"],
    ["a look-alike host", `https://${HOST}.evil.example/images/a.png`],
    ["userinfo naming the host", `https://${HOST}@evil.example/images/a.png`],
    ["IxWiki's host outside its files", `${ORIGIN}/projects/ixstates/api/x.png`],
    ["IxWiki's files climbing out", `${ORIGIN}/images/../api.php`],
    ["an encoded climb", `${ORIGIN}/images/%2e%2e/api.php`],
    ["a bare files directory", `${ORIGIN}/images/`],
    ["an escaped slash climb", `${ORIGIN}/images/..%2F..%2Fapi.php`],
    ["a lower-case escaped slash", `${ORIGIN}/images/a%2fb.png`],
    ["an escaped backslash", `${ORIGIN}/images/..%5Capi.php`],
    ["a lower-case escaped backslash", `${ORIGIN}/data/a%5cb.svg`],
    ["a port", `https://${HOST}:8443/images/a.png`],
    ["a sister host", "https://iiwiki.com/images/a/ab/Flag.png"],
    ["a root-relative wiki path", "/images/a/ab/Port.png"],
    ["an upload climbing out", "/images/uploads/../../api/admin"],
    ["the bare uploads directory", "/images/uploads/"],
    ["an upload with an escaped slash climb", "/images/uploads/..%2F..%2Fapi/admin"],
    ["an upload with a lower-case escaped backslash", "/api/wiki/file/..%5capi"],
    ["a protocol-relative other host", "//evil.example/images/uploads/a.png"],
    ["a backslash host", "/\\evil.example/images/uploads/a.png"],
    ["a tab the URL parser drops, naming a host", "/\t/evil.example/images/uploads/a.png"],
    ["data:", "data:image/png;base64,AAAA"],
    ["javascript:", "javascript:alert(1)"],
    ["ftp:", `ftp://${HOST}/images/a.png`],
    ["empty", ""],
    ["a bare word", "Port.png"],
  ])("%s is no image", (_label, url) => {
    expect(embedImageSrc(url, "ixwiki")).toBeNull();
  });
});

describe("embedImageSrc for a sister wiki", () => {
  it("goes through that wiki's media proxy, or is no image", () => {
    expect(embedImageSrc("https://iiwiki.com/images/a/ab/Flag.png", "iiwiki")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/Flag.png"
    );
    expect(embedImageSrc(" https://iiwiki.com/images/a/ab/Flag.png", "iiwiki")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/Flag.png"
    );
    expect(embedImageSrc(`${ORIGIN}/images/a/ab/Port.png`, "iiwiki")).toBeNull();
    expect(embedImageSrc("https://evil.example/a.png", "althistory")).toBeNull();
  });
});

describe("pickableEmbedImages", () => {
  const listed = [
    { title: "File:Track.png", url: "https://evil.example/track.png", thumbUrl: "" },
    {
      title: "File:Flag.png",
      url: "https://iiwiki.com/images/a/ab/Flag.png",
      thumbUrl: "https://iiwiki.com/images/thumb/a/ab/Flag.png/300px-Flag.png",
    },
    { title: "File:Seal.png", url: "https://iiwiki.com/images/b/bc/Seal.png", thumbUrl: "" },
  ];

  it("keeps the images a card can show, in order, as stored (the thumbnail, else the URL) and as loaded", () => {
    expect(pickableEmbedImages(listed, "iiwiki")).toEqual([
      {
        name: "Flag.png",
        stored: "https://iiwiki.com/images/thumb/a/ab/Flag.png/300px-Flag.png",
        src: "/api/mediawiki/iiwiki/images/thumb/a/ab/Flag.png/300px-Flag.png",
      },
      {
        name: "Seal.png",
        stored: "https://iiwiki.com/images/b/bc/Seal.png",
        src: "/api/mediawiki/iiwiki/images/b/bc/Seal.png",
      },
    ]);
  });

  it("is empty for no list", () => {
    expect(pickableEmbedImages(null, "iiwiki")).toEqual([]);
    expect(pickableEmbedImages(undefined, "ixwiki")).toEqual([]);
  });
});
