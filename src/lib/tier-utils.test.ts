import { formatMembershipTier } from "./tier-utils";

describe("formatMembershipTier", () => {
  it("formats mycountry_premium as Premium with amber styling", () => {
    const res = formatMembershipTier("mycountry_premium");
    expect(res.label).toBe("Premium");
    expect(res.isPremium).toBe(true);
    expect(res.badgeClass).toContain("amber");
  });

  it("formats premium as Premium with amber styling", () => {
    const res = formatMembershipTier("premium");
    expect(res.label).toBe("Premium");
    expect(res.isPremium).toBe(true);
  });

  it("formats basic as Citizen", () => {
    const res = formatMembershipTier("basic");
    expect(res.label).toBe("Citizen");
    expect(res.isPremium).toBe(false);
  });

  it("handles undefined or null gracefully", () => {
    const res = formatMembershipTier(null);
    expect(res.label).toBe("Citizen");
    expect(res.isPremium).toBe(false);
  });
});
