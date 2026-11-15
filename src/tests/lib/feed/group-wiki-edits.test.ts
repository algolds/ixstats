import { groupWikiEdits } from "~/lib/feed/group-wiki-edits";

const edit = (id: string, page: string, user = "a") => ({
  id,
  source: "wiki",
  user: { name: user },
  content: { title: `Wiki edit: ${page}`, metadata: { pageTitle: page } },
});

describe("groupWikiEdits", () => {
  it("folds every edit to one page into one entry at its newest place", () => {
    const post = { id: "p", source: "thinkpages", content: { title: "Hello" } };
    const out = groupWikiEdits([
      edit("1", "Urcea", "x"),
      edit("2", "Castadilla"),
      post,
      edit("3", "Urcea", "y"),
      edit("4", "Castadilla"),
    ]);
    expect(out.map((o) => (o as { _editCount?: number })._editCount ?? o.id)).toEqual([2, 2, "p"]);
    expect(out[0]).toMatchObject({ content: { title: "Urcea" }, _editors: ["x", "y"] });
  });

  it("leaves a page edited once, and non-wiki items, as they are", () => {
    const single = edit("1", "Urcea");
    const post = { id: "p", source: "thinkpages" };
    expect(groupWikiEdits([single, post])).toEqual([single, post]);
  });
});
