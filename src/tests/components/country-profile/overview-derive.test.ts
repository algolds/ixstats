/** The country overview's derivations: standing chips, region shares, the founding headline and relation nodes. */
import {
  earliestFounding,
  regionShares,
  relationNodes,
  standingHighlights,
  type DnaAxis,
} from "~/components/country-profile/derive";

const axis = (label: string, percentile: number): DnaAxis => ({
  key: label,
  label,
  percentile,
  rank: 1,
  total: 10,
  value: "",
});

describe("standingHighlights", () => {
  it("takes up to five strengths, best first, and up to two weak points, worst first", () => {
    const axes = [10, 95, 60, 99, 40, 70, 80, 5, 90].map((p) => axis(`a${p}`, p));
    const { strengths, weaknesses } = standingHighlights(axes);
    expect(strengths.map((a) => a.percentile)).toEqual([99, 95, 90, 80, 70]);
    expect(weaknesses.map((a) => a.percentile)).toEqual([5, 10]);
  });

  it("has no weak points when every category is in the top half", () => {
    expect(standingHighlights([axis("a", 50), axis("b", 80)]).weaknesses).toEqual([]);
  });
});

describe("regionShares", () => {
  const regions = [
    { id: "c", name: "C", population: 20 },
    { id: "a", name: "A", population: 50 },
    { id: "x", name: "X", population: null },
    { id: "b", name: "B", population: 30 },
  ];

  it("ranks peopled regions and shares them against the national population", () => {
    const shares = regionShares(regions, 200, 2)!;
    expect(shares.regions.map((r) => [r.name, r.share, r.width])).toEqual([
      ["A", 25, 100],
      ["B", 15, 60],
    ]);
    expect(shares.topShare).toBe(40);
    expect(shares.others).toBe(1);
  });

  it("falls back to the regions' sum when it exceeds the national figure", () => {
    expect(regionShares(regions, 10)!.regions[0]!.share).toBe(50);
  });

  it("is null without regional figures", () => {
    expect(regionShares([{ id: "x", name: "X", population: null }], 100)).toBeNull();
  });
});

describe("earliestFounding", () => {
  it("picks the earliest founding entry", () => {
    const chronicle = [
      { kind: "decision", year: -900, title: "d" },
      { kind: "founding", year: 136, title: "First Imperium" },
      { kind: "founding", year: -480, title: "Kingdom founded" },
    ];
    expect(earliestFounding(chronicle)?.title).toBe("Kingdom founded");
  });

  it("is null without founding entries", () => {
    expect(earliestFounding([{ kind: "story", year: 1 }])).toBeNull();
  });
});

describe("relationNodes", () => {
  const relation = {
    id: "r1",
    countryId: "m",
    name: "Maresteyn",
    flagUrl: null,
    relationship: "NEUTRAL",
    strength: 40,
    treaties: [],
  };
  const embassy = (id: string, countryName: string, role: "host" | "guest") => ({
    id,
    countryName,
    countrySlug: countryName.toLowerCase(),
    flagUrl: null,
    role,
    status: "active",
    level: 1,
  });

  it("merges an embassy into its country's relation node", () => {
    const nodes = relationNodes({
      relations: [relation],
      embassies: [embassy("e1", "Maresteyn", "host"), embassy("e2", "Kabasa", "guest")],
    });
    expect(nodes.map((n) => [n.name, n.detail])).toEqual([
      ["Maresteyn", "Neutral · their embassy here"],
      ["Kabasa", "Our embassy there"],
    ]);
    expect(nodes[0]!.variant).toBe("default");
    expect(nodes[1]!.variant).toBeNull();
  });

  it("orders relations by strength before embassies", () => {
    const nodes = relationNodes({
      relations: [
        relation,
        { ...relation, id: "r2", name: "Urcea", relationship: "ALLIED", strength: 90 },
      ],
      embassies: [],
    });
    expect(nodes.map((n) => n.name)).toEqual(["Urcea", "Maresteyn"]);
  });
});
