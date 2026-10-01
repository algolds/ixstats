/** @jest-environment node */
/**
 * Plan 411: prop=imageinfo and list=allimages, from `wiki_assets`: the current version of each file, its URL absolute
 * (a path on this site while only WikiOS holds the bytes, MediaWiki's /images/ URL after the mirror), MediaWiki's field
 * names, continuation by name.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { call, fakeWiki, makeDeps, type FakeWikiData } from "./harness";

type Body = Record<string, any>;

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

const data = (): FakeWikiData => ({
  pages: [
    { pageId: 20, title: "File:Cat photo.png", namespace: 6 },
    { pageId: 21, title: "File:Dog.svg", namespace: 6 },
    { pageId: 22, title: "File:Ghost.png", namespace: 6 },
    { pageId: 1, title: "Alpha" },
  ],
  files: [
    {
      name: "Cat photo.png",
      pageId: 20,
      url: "https://ixwiki.com/images/c/c9/Cat_photo.png",
      size: 5000,
      width: 640,
      height: 480,
      sha1: SHA_A,
      timestamp: "2026-09-01T10:00:00Z",
      user: "Heku",
      comment: "A cat <b>photo</b>",
    },
    // uploaded in WikiOS, not in MediaWiki yet: a path on this site
    {
      name: "Dog.svg",
      pageId: 21,
      url: "/api/wiki/file/Dog.svg",
      size: 800,
      width: 40,
      height: 20,
      mime: "image/svg+xml",
      sha1: SHA_B,
      timestamp: "2026-09-30T12:00:00Z",
      user: "Mod",
    },
    {
      name: "Eel.pdf",
      url: "/api/wiki/file/Eel.pdf",
      size: 90000,
      width: 0,
      height: 0,
      mime: "application/pdf",
      sha1: SHA_B,
    },
    { name: "Fox.png", sha1: SHA_A, size: 10 },
  ],
});

async function run(params: string, wiki: FakeWikiData = data()): Promise<Body> {
  const deps = await makeDeps({ store: fakeWiki(wiki) });
  return (await call(deps, `action=query&${params}&formatversion=2`)).body as Body;
}

describe("prop=imageinfo", () => {
  it("describes a file with the default props: timestamp and user", async () => {
    const body = await run("titles=File:Cat_photo.png&prop=imageinfo");

    expect(body.query.pages[0]).toMatchObject({
      pageid: 20,
      title: "File:Cat photo.png",
      imagerepository: "local",
      imageinfo: [{ timestamp: "2026-09-01T10:00:00Z", user: "Heku" }],
    });
    expect(body.query.pages[0].imageinfo[0].url).toBeUndefined();
  });

  it("gives every prop WikiOS has, in MediaWiki's names, with an absolute URL", async () => {
    const body = await run(
      "titles=File:Cat photo.png|File:Dog.svg&prop=imageinfo&iiprop=timestamp|user|comment|parsedcomment|canonicaltitle|url|size|sha1|mime|mediatype|userid"
    );

    const [cat, dog] = body.query.pages;
    expect(cat.imageinfo[0]).toEqual({
      timestamp: "2026-09-01T10:00:00Z",
      user: "Heku",
      userid: 0,
      comment: "A cat <b>photo</b>",
      parsedcomment: "A cat &lt;b&gt;photo&lt;/b&gt;",
      canonicaltitle: "File:Cat photo.png",
      url: "https://ixwiki.com/images/c/c9/Cat_photo.png",
      descriptionurl: "https://ixwiki.com/wiki/File:Cat_photo.png",
      size: 5000,
      width: 640,
      height: 480,
      sha1: SHA_A,
      mime: "image/png",
      mediatype: "BITMAP",
    });
    // a file only WikiOS has: its URL is on this site, with the public origin in front
    expect(dog.imageinfo[0]).toMatchObject({
      url: "https://ixwiki.com/api/wiki/file/Dog.svg",
      descriptionurl: "https://ixwiki.com/wiki/File:Dog.svg",
      mime: "image/svg+xml",
      mediatype: "DRAWING",
    });
  });

  it("says a file page with no file has no image repository, and adds nothing to other pages", async () => {
    const body = await run("titles=File:Ghost.png|Alpha|File:Nobody.png&prop=imageinfo");

    const byTitle = Object.fromEntries(body.query.pages.map((page: Body) => [page.title, page]));
    expect(byTitle["File:Ghost.png"]).toMatchObject({ imagerepository: "" });
    expect(byTitle["File:Ghost.png"].imageinfo).toBeUndefined();
    expect(byTitle["File:Nobody.png"].imagerepository).toBe("");
    expect(byTitle.Alpha.imagerepository).toBeUndefined();
    expect(byTitle.Alpha.imageinfo).toBeUndefined();
  });

  it("answers a file that has an asset but no page (the page is `missing`, the file is there)", async () => {
    const body = await run("titles=File:Fox.png&prop=imageinfo&iiprop=size|sha1");

    expect(body.query.pages[0]).toMatchObject({
      missing: true,
      imagerepository: "local",
      imageinfo: [{ size: 10, sha1: SHA_A }],
    });
  });

  it("describes only the current version, and says so when more are asked for", async () => {
    const body = await run("titles=File:Cat photo.png&prop=imageinfo&iilimit=5");

    expect(body.query.pages[0].imageinfo).toHaveLength(1);
    expect(JSON.stringify(body.warnings)).toContain("Only the current version");
  });

  it("rejects a prop it does not know", async () => {
    const body = await run("titles=File:Cat photo.png&prop=imageinfo&iiprop=bogus");

    expect(body.error.code).toBe("badvalue");
  });
});

describe("list=allimages", () => {
  it("lists the files in name order with MediaWiki's fields, underscores in `name`", async () => {
    const body = await run("list=allimages");

    expect(body.query.allimages.map((file: Body) => file.name)).toEqual([
      "Cat_photo.png",
      "Dog.svg",
      "Eel.pdf",
      "Fox.png",
    ]);
    expect(body.query.allimages[0]).toEqual({
      name: "Cat_photo.png",
      title: "File:Cat photo.png",
      timestamp: "2026-09-01T10:00:00Z",
      url: "https://ixwiki.com/images/c/c9/Cat_photo.png",
      descriptionurl: "https://ixwiki.com/wiki/File:Cat_photo.png",
    });
  });

  it("takes the props it was asked for", async () => {
    const body = await run("list=allimages&aiprop=size|sha1|mime|user|mediatype&ailimit=1");

    expect(body.query.allimages[0]).toEqual({
      name: "Cat_photo.png",
      title: "File:Cat photo.png",
      size: 5000,
      width: 640,
      height: 480,
      sha1: SHA_A,
      mime: "image/png",
      user: "Heku",
      mediatype: "BITMAP",
    });
  });

  it("continues by name, ascending and descending", async () => {
    const first = await run("list=allimages&ailimit=2&aiprop=");
    expect(first.query.allimages.map((file: Body) => file.name)).toEqual([
      "Cat_photo.png",
      "Dog.svg",
    ]);
    expect(first.continue).toEqual({ aicontinue: "Eel.pdf", continue: "-||" });

    const second = await run(
      `list=allimages&ailimit=2&aiprop=&aicontinue=${first.continue.aicontinue}`
    );
    expect(second.query.allimages.map((file: Body) => file.name)).toEqual(["Eel.pdf", "Fox.png"]);
    expect(second.continue).toBeUndefined();

    const down = await run("list=allimages&ailimit=2&aidir=descending&aiprop=");
    expect(down.query.allimages.map((file: Body) => file.name)).toEqual(["Fox.png", "Eel.pdf"]);
    expect(down.continue.aicontinue).toBe("Dog.svg");
  });

  it("filters by prefix, name range, sha1 (hex or base 36), mime and size", async () => {
    const names = async (params: string) =>
      (await run(`list=allimages&aiprop=&${params}`)).query.allimages.map(
        (file: Body) => file.name
      );

    expect(await names("aiprefix=Ca")).toEqual(["Cat_photo.png"]);
    expect(await names("aifrom=Dog&aito=Eel.pdf")).toEqual(["Dog.svg", "Eel.pdf"]);
    expect(await names(`aisha1=${SHA_A}`)).toEqual(["Cat_photo.png", "Fox.png"]);
    expect(await names("aimime=application/pdf|image/svg%2Bxml")).toEqual(["Dog.svg", "Eel.pdf"]);
    expect(await names("aiminsize=1000&aimaxsize=6000")).toEqual(["Cat_photo.png"]);
  });

  it("refuses a bad sha1, both sha1 forms at once, and a continue that names no file", async () => {
    expect((await run("list=allimages&aisha1=xyz")).error.code).toBe("badvalue");
    expect((await run(`list=allimages&aisha1=${SHA_A}&aisha1base36=abc`)).error.code).toBe(
      "invalidparammix"
    );
    expect((await run("list=allimages&aicontinue=Bad|Name")).error.code).toBe("badcontinue");
  });
});
