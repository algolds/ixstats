import { facetClerkAppearance } from "~/lib/clerk/theme";

describe("Clerk Components & Theme Architecture", () => {
  const elements = facetClerkAppearance.elements as Record<string, string>;

  it("provides valid theme-compliant facetClerkAppearance variables and elements", () => {
    expect(facetClerkAppearance.variables).toBeDefined();
    expect(facetClerkAppearance.variables?.colorPrimary).toContain("var(--color-brand-primary");
    expect(facetClerkAppearance.variables?.colorBackground).toContain("var(--color-bg-secondary");
    expect(facetClerkAppearance.variables?.borderRadius).toBe("1rem");
    expect(elements).toBeDefined();
    expect(elements?.card).toContain("backdrop-blur-2xl");
    expect(elements?.card).toContain("border-border");
    expect(elements?.card).toContain("bg-card/90");
  });

  it("includes organization switcher styling in facet appearance", () => {
    expect(elements?.organizationSwitcherTrigger).toBeDefined();
    expect(elements?.organizationSwitcherTrigger).toContain("rounded-xl");
    expect(elements?.organizationProfile).toBeDefined();
  });

  it("includes user profile styling in facet appearance", () => {
    expect(elements?.userProfile).toBeDefined();
    expect(elements?.userButtonAvatarBox).toBeDefined();
  });
});
