import { classifyArticleTopic, cleanSummary } from "~/lib/country/article-topics";

describe("classifyArticleTopic", () => {
  it("matches full topic words derived from stems", () => {
    expect(classifyArticleTopic("History of Caphiria")).toBe("history");
    expect(classifyArticleTopic("Economy of Urcea")).toBe("economy");
    expect(classifyArticleTopic("Military of X")).toBe("defense");
    expect(classifyArticleTopic("Politics of X")).toBe("state");
    expect(classifyArticleTopic("Ministers of X")).toBe("state");
    expect(classifyArticleTopic("Ministry of X")).toBe("state");
    expect(classifyArticleTopic("Demographics of X")).toBe("society");
    expect(classifyArticleTopic("Culture of X")).toBe("culture");
    expect(classifyArticleTopic("Foreign relations of X")).toBe("diplomacy");
    expect(classifyArticleTopic("Geography of X")).toBe("geography");
  });

  it("does not misclassify employment as history and falls back to dossier", () => {
    expect(classifyArticleTopic("Employment in X")).not.toBe("history");
    expect(classifyArticleTopic("Foo")).toBe("dossier");
  });
});

describe("cleanSummary", () => {
  it("strips templates, wiki links, bold/italic quotes, and HTML", () => {
    expect(cleanSummary("{{Infobox}} '''Caphiria''' is a [[Federal republic|republic]].")).toBe(
      "Caphiria is a republic."
    );
    expect(cleanSummary("   ")).toBeNull();
    expect(cleanSummary(null)).toBeNull();
  });
});
