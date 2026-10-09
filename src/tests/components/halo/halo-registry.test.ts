import { CORE_COMMANDS } from "~/components/halo/halo-registry";

function command(name: string) {
  return CORE_COMMANDS.find((entry) => entry.name === name);
}

describe("Halo registry: ThinkPages destinations", () => {
  it("sends /thinkpages to the forum, not the feed", () => {
    expect(command("ThinkPages")).toMatchObject({
      path: "/thinkpages",
      category: "Community",
      description: "The forum: sitewide boards and a section for every realm",
      keywords: ["forum", "boards", "threads", "discussions", "thinkpages"],
    });
  });

  it("finds the feed on the dashboard", () => {
    expect(command("ThinkPages feed")).toMatchObject({ path: "/dashboard", category: "Community" });
  });

  it("lists Accounts and Saved posts at their dashboard homes", () => {
    expect(command("Accounts")).toMatchObject({
      path: "/dashboard/accounts",
      category: "Community",
      keywords: ["personas", "accounts", "post as"],
    });
    expect(command("Saved posts")).toMatchObject({
      path: "/dashboard/saved",
      category: "Community",
      keywords: ["saved", "bookmarks", "posts"],
    });
  });

  it("points no entry at a moved feed page under /thinkpages", () => {
    const moved = /^\/thinkpages\/(feed|post|profile|saved|thinkshare|forum)(\/|$)/;
    expect(CORE_COMMANDS.filter((entry) => entry.path && moved.test(entry.path))).toEqual([]);
  });

  it("gives every command a unique name (result ids are built from it)", () => {
    const names = CORE_COMMANDS.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
