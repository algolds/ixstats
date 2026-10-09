/** @jest-environment node */
import { forumAssetVisibilities } from "~/server/modules/thinkpages-forum/import-db";
import { importStore } from "~/tests/helpers/forum-import-fake";

describe("forumAssetVisibilities (M10)", () => {
  it("maps each forum asset's sourceRef to its stored visibility, ignoring other sources and null refs", async () => {
    const { db } = importStore({
      assets: [
        { id: "a", source: "forum", sourceRef: "55", visibility: "public" },
        { id: "b", source: "forum", sourceRef: "57", visibility: "restricted" },
        { id: "c", source: "forum", sourceRef: null, visibility: "public" },
        { id: "d", source: "upload", sourceRef: "55", visibility: "restricted" },
      ],
    });
    expect(Object.fromEntries(await forumAssetVisibilities(db as never))).toEqual({
      "55": "public",
      "57": "restricted",
    });
  });
});
