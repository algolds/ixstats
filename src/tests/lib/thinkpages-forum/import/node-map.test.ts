/** @jest-environment node */
import {
  archiveCategory,
  archiveKey,
  heuristicTarget,
  nodeMapSchema,
  resolveNodeTargets,
} from "~/lib/thinkpages-forum/import/node-map";
import type { XfNode } from "~/lib/thinkpages-forum/import/xenforo-types";

const node = (node_id: number, title: string, node_type_id = "Forum"): XfNode => ({
  node_id,
  title,
  description: "",
  node_type_id,
  parent_node_id: 0,
  display_order: node_id,
});

describe("heuristicTarget", () => {
  it.each([
    ["Rules and Guidelines", "rules"],
    ["Site Announcements", "announcements"],
    ["Find a Realm", "find-a-realm"],
    ["Recruitment for regions", "find-a-realm"],
    ["Realm recruiting", "find-a-realm"],
    ["General Discussion", "general"],
    ["Off-Topic", "general"],
    ["Side Games", "side-games"],
    ["Games", "side-games"],
  ])("maps %s to the %s seed", (title, key) => {
    expect(heuristicTarget(title)).toEqual({ scope: "site", key });
  });

  it.each(["Staff Room", "Reports", "Moderators", "Roleplay", "Our rules"])(
    "archives %s (staff keys never come from heuristics)",
    (title) => {
      expect(heuristicTarget(title)).toEqual({ archive: true });
    }
  );
});

describe("nodeMapSchema", () => {
  it("accepts site, realm, archive and skip targets keyed by node id", () => {
    const parsed = nodeMapSchema.parse({
      nodes: {
        "12": { scope: "site", key: "general" },
        "13": { scope: "site", key: "staff" },
        "14": { scope: "realm", realm: "ixworld", key: "current-events" },
        "15": { archive: true, visibility: "staff" },
        "16": { skip: true },
      },
    });
    expect(Object.keys(parsed.nodes)).toEqual(["12", "13", "14", "15", "16"]);
  });

  it("refuses the reports category, bad keys, non-numeric node ids and unknown fields", () => {
    for (const nodes of [
      { "12": { scope: "site", key: "reports" } },
      { "12": { scope: "site", key: "Not A Key" } },
      { general: { scope: "site", key: "general" } },
      { "12": { archive: true, visibility: "reporter_staff" } },
      { "12": { scope: "site", key: "general", extra: 1 } },
      { "12": { skip: false } },
    ]) {
      expect(nodeMapSchema.safeParse({ nodes }).success).toBe(false);
    }
  });
});

describe("resolveNodeTargets", () => {
  const nodes = [
    node(1, "Community", "Category"),
    node(2, "Help page", "Page"),
    node(3, "Wiki", "LinkForum"),
    node(12, "General Discussion"),
    node(13, "Staff Room"),
    node(14, "Old roleplay"),
  ];

  it("skips Category, Page and LinkForum nodes and resolves forums by heuristic or archive", () => {
    const resolved = resolveNodeTargets(nodes, null);
    expect(resolved.map((r) => [r.node.node_id, r.target, r.source])).toEqual([
      [1, { skip: true }, "default"],
      [2, { skip: true }, "default"],
      [3, { skip: true }, "default"],
      [12, { scope: "site", key: "general" }, "heuristic"],
      [13, { archive: true }, "default"],
      [14, { archive: true }, "default"],
    ]);
  });

  it("prefers the map's explicit entry", () => {
    const resolved = resolveNodeTargets(nodes, {
      nodes: {
        "13": { scope: "site", key: "staff" },
        "14": { skip: true },
        "1": { scope: "site", key: "general" },
      },
    });
    const byId = new Map(resolved.map((r) => [r.node.node_id, r]));
    expect(byId.get(13)).toMatchObject({ target: { scope: "site", key: "staff" }, source: "map" });
    expect(byId.get(14)).toMatchObject({ target: { skip: true }, source: "map" });
    expect(byId.get(1)).toMatchObject({ target: { skip: true }, source: "default" });
    expect(byId.get(12)?.source).toBe("heuristic");
  });
});

describe("archiveCategory", () => {
  it("is a staff-posted sitewide category named after the node, ordered after the seeds", () => {
    const forum = {
      ...node(13, "Staff Room"),
      description: "<b>Private</b> talk.",
      display_order: 20,
    };
    expect(archiveKey(13)).toBe("xf-13");
    expect(archiveCategory(forum, "staff")).toEqual({
      key: "xf-13",
      name: "Archive: Staff Room",
      description: "Private talk.",
      order: 1020,
      visibility: "staff",
      postRole: "staff",
      icAllowed: false,
    });
  });

  it("has no description when the node has none", () => {
    expect(archiveCategory(node(12, "General"), "public").description).toBeNull();
  });
});
