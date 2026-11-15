import {
  cleanLeadImage,
  coverDomainTitles,
  coverTitleOrder,
  extractMainTitles,
} from "~/lib/country/cover-topics";

const mains = (entries: Record<string, string[]>) =>
  new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]));

describe("coverDomainTitles", () => {
  it("names each block's own domain articles, the legislature under State", () => {
    expect(coverDomainTitles("Caphiria", "Corcillum")).toEqual({
      economy: ["Economy of Caphiria"],
      state: ["Government of Caphiria", "Corcillum", "Politics of Caphiria"],
      foreign: ["Foreign relations of Caphiria"],
    });
  });

  it("leaves the legislature out when there is none on record", () => {
    expect(coverDomainTitles("Urcea", null).state).toEqual([
      "Government of Urcea",
      "Politics of Urcea",
    ]);
  });
});

describe("coverTitleOrder", () => {
  it("orders each block: domain articles, then their Main pages, then (Economy) capital and largest city", () => {
    const order = coverTitleOrder(
      "Caphiria",
      { legislature: "Corcillum", capital: "Venceia", largestCity: "Aurelia" },
      mains({
        "Economy of Caphiria": ["Central Bank of Caphiria", "Venceia"],
        "Government of Caphiria": ["Imperator of Caphiria"],
        "Politics of Caphiria": ["Political parties in Caphiria"],
        "Foreign relations of Caphiria": ["Caphiria–Urcea relations"],
      })
    );
    expect(order).toEqual({
      economy: ["Economy of Caphiria", "Central Bank of Caphiria", "Venceia", "Aurelia"],
      state: [
        "Government of Caphiria",
        "Corcillum",
        "Politics of Caphiria",
        "Imperator of Caphiria",
        "Political parties in Caphiria",
      ],
      foreign: ["Foreign relations of Caphiria", "Caphiria–Urcea relations"],
    });
  });

  it("never lets a military page qualify, even as a Main page of Foreign relations", () => {
    const order = coverTitleOrder(
      "Caphiria",
      {},
      mains({
        "Foreign relations of Caphiria": [
          "Imperial Armed Forces of Caphiria",
          "Caphirian Navy",
          "Military history of Caphiria",
          "Treaty of Kartika",
        ],
      })
    );
    expect(order.foreign).toEqual(["Foreign relations of Caphiria", "Treaty of Kartika"]);
  });

  it("skips the largest city when it is the capital", () => {
    const order = coverTitleOrder(
      "Caphiria",
      { capital: "Venceia", largestCity: "venceia" },
      mains({})
    );
    expect(order.economy).toEqual(["Economy of Caphiria", "Venceia"]);
  });
});

describe("extractMainTitles", () => {
  it("reads {{Main}}, {{See also}} and {{Further}} targets, without anchors or named args", () => {
    const text =
      "{{Main|Central Bank of Caphiria|Caphirian taler#History}} x {{see also|Trade_of_Caphiria|l1=Trade}}";
    expect(extractMainTitles(text)).toEqual([
      "Central Bank of Caphiria",
      "Caphirian taler",
      "Trade of Caphiria",
    ]);
  });
});

describe("cleanLeadImage", () => {
  it("drops unexpanded template URLs", () => {
    expect(cleanLeadImage("/images/a/ab/{{flag}}.png")).toBeNull();
    expect(cleanLeadImage(" /images/a/ab/Rail.jpg ")).toBe("/images/a/ab/Rail.jpg");
    expect(cleanLeadImage(null)).toBeNull();
  });
});
