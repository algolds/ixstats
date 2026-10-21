import { heroCardInputs, mayNameCountry } from "~/lib/wiki-os/hero-card";
describe("mayNameCountry", () => {
  it("is true for a plain article title", () => {
    expect(mayNameCountry("Pelaxia")).toBe(true);
    expect(mayNameCountry("Economy of Urcea")).toBe(true);
  });

  it("is false for the Main Page, an empty title and anything in a namespace", () => {
    expect(mayNameCountry("Main Page")).toBe(false);
    expect(mayNameCountry("Main_Page")).toBe(false);
    expect(mayNameCountry("  ")).toBe(false);
    expect(mayNameCountry("Talk:Pelaxia")).toBe(false);
    expect(mayNameCountry("Category:Countries")).toBe(false);
  });
});

describe("heroCardInputs", () => {
  it("is each read's input, as the procedures take it", () => {
    expect(heroCardInputs("Pelaxia")).toEqual({
      parentCategories: { title: "Pelaxia" },
      awards: { title: "Pelaxia" },
      country: { id: "Pelaxia" },
    });
  });
});
