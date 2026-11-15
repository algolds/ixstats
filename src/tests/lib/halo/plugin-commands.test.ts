import { CORE_FEATURES } from "~/components/halo/halo-registry";
import { builderCommandsForSections } from "~/components/halo/plugins/builder/BuilderHalo";
import type { BuilderHaloSection } from "~/components/halo/plugins/builder/types";
import { MYCOUNTRY_PLUGIN_COMMANDS } from "~/components/halo/plugins/mycountry/MyCountryHalo";
import { sportsLiveCommandsForMatch } from "~/components/halo/plugins/sports/SportsLiveHalo";
import { wikiCommandsForArticle } from "~/components/halo/plugins/wiki/WikiHalo";
import {
  buildIndex,
  commandEntriesFor,
  indexPluginCommands,
  indexRealms,
  searchCatalog,
  type SearchSources,
} from "~/lib/halo/search";

jest.mock("~/components/ui/pretext", () => ({ PreText: () => null }));
jest.mock("~/trpc/react", () => ({
  api: { sports: { getLiveActivities: { useQuery: () => ({ data: undefined }) } } },
}));

describe("Halo plugin commands and open realm search", () => {
  it("BuilderHalo: ranks 'Jump to Identity and symbols' #1 for 'flag' on /mycountry/editor and invokes onJump", () => {
    const onJump = jest.fn();
    const editorSections: readonly BuilderHaloSection[] = [
      {
        id: "identity",
        label: "Identity and symbols",
        description: "Name, flag, capital, culture and civic codes",
        keywords: ["name", "symbols", "language", "culture", "civic"],
      },
      {
        id: "taxes",
        label: "Taxes and tariffs",
        description: "National tax rates and sector tariffs",
        keywords: ["taxes", "tariffs"],
      },
    ];
    const pluginCommands = builderCommandsForSections(editorSections, onJump);

    const sources: SearchSources = {
      pluginCommands: indexPluginCommands(pluginCommands),
      countries: buildIndex([
        { id: "c-flag", name: "Flagstone Republic", slug: "flagstone", economicTier: "Developed" },
      ]),
      commands: buildIndex(
        commandEntriesFor({ isAdmin: false, signedIn: true, pathname: "/mycountry/editor" })
      ),
      features: buildIndex(CORE_FEATURES),
      wiki: [{ title: "Flags of IxWorld", snippet: "Armorial and national flags" }],
    };

    const results = searchCatalog("flag", "all", sources, {
      wikiFirst: false,
      pluginId: "builder",
    });
    expect(results[0]).toMatchObject({
      kind: "command",
      key: "plugin-builder-jump-identity",
      title: "Jump to Identity and symbols",
      category: "On this page",
      pluginCommandKey: "jump-identity",
    });

    pluginCommands.find((cmd) => cmd.key === results[0]?.pluginCommandKey)?.run?.();
    expect(onJump).toHaveBeenCalledWith("identity");
  });

  it("MyCountryHalo: ranks 'Declare directive' #1 for 'directive' on /mycountry", () => {
    const sources: SearchSources = {
      pluginCommands: indexPluginCommands(MYCOUNTRY_PLUGIN_COMMANDS),
      countries: buildIndex([{ id: "c-dir", name: "Directorate of Sol", slug: "sol" }]),
      commands: buildIndex(
        commandEntriesFor({ isAdmin: false, signedIn: true, pathname: "/mycountry" })
      ),
      features: buildIndex(CORE_FEATURES),
      wiki: [{ title: "Executive Directive", snippet: "Legal instrument" }],
    };

    const results = searchCatalog("directive", "all", sources, {
      wikiFirst: false,
      pluginId: "mycountry",
    });
    expect(results[0]).toMatchObject({
      kind: "command",
      key: "plugin-mycountry-executive",
      title: "Declare directive",
      category: "On this page",
      path: "/mycountry/executive",
    });
  });

  it("WikiHalo: ranks 'Jump to History' #1 under both 'all' and 'wiki' filters and runs section + narrator callbacks", () => {
    const onJumpSection = jest.fn();
    const onToggleNarrator = jest.fn();
    const pluginCommands = wikiCommandsForArticle({
      articleTitle: "Aphis",
      toc: [
        { id: "Overview", text: "Overview" },
        { id: "History", text: "History" },
      ],
      canNarrate: true,
      isPlaying: false,
      onJumpSection,
      onToggleNarrator,
    });

    const sources: SearchSources = {
      pluginCommands: indexPluginCommands(pluginCommands),
      countries: buildIndex([{ id: "c-1", name: "Historic Federation", slug: "historic" }]),
      commands: buildIndex(
        commandEntriesFor({ isAdmin: false, signedIn: true, pathname: "/wiki/Aphis" })
      ),
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
        key: "plugin-wiki-toc-History",
        title: "Jump to History",
        category: "On this page",
      });
    }

    pluginCommands.find((c) => c.key === "toc-History")?.run?.();
    expect(onJumpSection).toHaveBeenCalledWith("History");

    const narrateResults = searchCatalog("narrate", "wiki", sources, {
      wikiFirst: true,
      pluginId: "wiki",
    });
    expect(narrateResults[0]?.title).toBe("Narrate article");
    pluginCommands.find((c) => c.key === "narrator-toggle")?.run?.();
    expect(onToggleNarrator).toHaveBeenCalledTimes(1);
  });

  it("SportsLiveHalo: ranks 'Watch live: APH vs VAL' #1 for 'live' and exposes standings route", () => {
    const pluginCommands = sportsLiveCommandsForMatch({
      leagueName: "Premier Concord League",
      homeTeam: { name: "Aphis City", shortName: "APH", color: "#2563eb" },
      awayTeam: { name: "Valenport Athletic", shortName: "VAL", color: "#dc2626" },
    });

    const sources: SearchSources = {
      pluginCommands: indexPluginCommands(pluginCommands),
      countries: [],
      commands: buildIndex(commandEntriesFor({ isAdmin: false, signedIn: true, pathname: "/" })),
      features: buildIndex(CORE_FEATURES),
      wiki: [{ title: "Live television", snippet: "Broadcasting" }],
    };

    const results = searchCatalog("live", "all", sources, {
      wikiFirst: false,
      pluginId: "sports-live",
    });
    expect(results[0]).toMatchObject({
      kind: "command",
      key: "plugin-sports-live-watch-live",
      title: "Watch live: APH vs VAL",
      category: "On this page",
      pluginCommandKey: "watch-live",
    });
    expect(pluginCommands[0]?.pluginView).toBe("sports-live");
    expect(pluginCommands[1]?.path).toBe("/myleague");
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
