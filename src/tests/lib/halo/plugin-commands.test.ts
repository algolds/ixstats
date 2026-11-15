import { CORE_FEATURES } from "~/components/halo/halo-registry";
import {
  buildIndex,
  commandEntriesFor,
  indexPluginCommands,
  indexRealms,
  searchCatalog,
  type SearchSources,
} from "~/lib/halo/search";

describe("Halo plugin commands and open realm search (pure)", () => {
  it("ranks 'On this page' plugin matches first under 'all', 'commands', and 'wiki' (for WikiHalo)", () => {
    const pluginCommands = indexPluginCommands([
      {
        key: "toc-history",
        title: "Jump to History",
        description: "Section in Aphis",
        keywords: ["section", "heading", "jump", "history"],
      },
    ]);

    const sources: SearchSources = {
      pluginCommands,
      countries: buildIndex([{ id: "c-1", name: "Historic Federation", slug: "historic" }]),
      commands: buildIndex(commandEntriesFor({ isAdmin: false, signedIn: true, pathname: "/wiki/Aphis" })),
      features: buildIndex(CORE_FEATURES),
      wiki: [{ title: "History of Aphis", snippet: "Early history" }],
    };

    for (const filter of ["all", "commands", "wiki"] as const) {
      const results = searchCatalog("history", filter, sources, {
        wikiFirst: true,
        pluginId: "wiki",
      });
      expect(results[0]).toMatchObject({
        kind: "command",
        key: "plugin-wiki-toc-history",
        title: "Jump to History",
        category: "On this page",
        pluginCommandKey: "toc-history",
      });
      const keys = results.map((r) => r.key);
      expect(new Set(keys).size).toBe(keys.length);
    }

    // Non-wiki plugins do not inject commands into the dedicated 'wiki' filter.
    const nonWikiOnWikiFilter = searchCatalog("history", "wiki", sources, {
      wikiFirst: false,
      pluginId: "mycountry",
    });
    expect(nonWikiOnWikiFilter.every((r) => r.kind === "wiki")).toBe(true);
  });

  it("indexes and matches open realms by name, slug, tag, and description under 'all' only", () => {
    const realms = indexRealms([
      {
        id: "r-1",
        slug: "aurora-reach",
        name: "Aurora Reach",
        description: "Maritime trade leagues",
        thumbnail: "/uploads/aurora.png",
        tags: ["maritime", "archipelago"],
        nationCount: 18,
      },
      {
        id: "r-2",
        slug: "solitary-atoll",
        name: "Solitary Atoll",
        description: null,
        tags: ["archipelago"],
        nationCount: 1,
      },
    ]);

    const sources: SearchSources = {
      realms,
      countries: [],
      commands: buildIndex(commandEntriesFor({ isAdmin: false, signedIn: true, pathname: "/" })),
      features: buildIndex(CORE_FEATURES),
      wiki: [],
    };

    const byName = searchCatalog("aurora", "all", sources, { wikiFirst: false });
    expect(byName[0]).toMatchObject({
      kind: "realm",
      key: "realm-r-1",
      title: "Aurora Reach",
      description: "18 nations · Maritime trade leagues",
      category: "Realm",
      path: "/r/aurora-reach",
      thumbnail: "/uploads/aurora.png",
    });

    const byTag = searchCatalog("archipelago", "all", sources, { wikiFirst: false });
    expect(byTag.map((r) => r.title)).toEqual(["Aurora Reach", "Solitary Atoll"]);
    expect(byTag[1]?.description).toBe("1 nation");

    for (const filter of ["countries", "commands", "features", "wiki"] as const) {
      const scoped = searchCatalog("aurora", filter, sources, { wikiFirst: false });
      expect(scoped.some((r) => r.kind === "realm")).toBe(false);
    }
  });
});
