import { defineAbilityFor } from "~/lib/ability";

describe("defineAbilityFor", () => {
  it("should grant full access to owner", () => {
    const ability = defineAbilityFor("owner", [], "basic", []);
    expect(ability.can("manage", "all")).toBe(true);
    expect(ability.can("manage", "User")).toBe(true);
    expect(ability.can("manage", "Role")).toBe(true);
    expect(ability.can("access", "MyCountryFeature", "defense")).toBe(true);
  });

  it("should grant user/role management to admin", () => {
    const ability = defineAbilityFor("admin", [], "basic", []);
    expect(ability.can("manage", "all")).toBe(false);
    expect(ability.can("manage", "User")).toBe(true);
    expect(ability.can("manage", "Role")).toBe(true);
    expect(ability.can("read", "SystemConfig")).toBe(true);
    expect(ability.can("update", "SystemConfig")).toBe(false);
  });

  it("should map specific db permissions correctly", () => {
    const ability = defineAbilityFor("user", ["user.manage", "role.create"], "basic", []);
    expect(ability.can("manage", "User")).toBe(true);
    expect(ability.can("manage", "Role")).toBe(true);
    expect(ability.can("manage", "SystemConfig")).toBe(false);
  });

  it("should restrict basic users from premium features", () => {
    const ability = defineAbilityFor("user", [], "basic", []);
    // Standard features should be accessible
    expect(ability.can("access", "MyCountryFeature", "overview")).toBe(true);
    expect(ability.can("access", "MyCountryFeature", "executive")).toBe(true);
    expect(ability.can("access", "MyCountryFeature", "politics")).toBe(true);
    // Premium features should be locked
    expect(ability.can("access", "MyCountryFeature", "defense")).toBe(false);
    expect(ability.can("access", "MyCountryFeature", "intelligence")).toBe(false);
    expect(ability.can("access", "MyCountryFeature", "map-editor")).toBe(false);
  });

  it("should grant access to premium features for premium users", () => {
    const ability = defineAbilityFor("user", [], "mycountry_premium", []);
    expect(ability.can("access", "MyCountryFeature", "overview")).toBe(true);
    expect(ability.can("access", "MyCountryFeature", "defense")).toBe(true);
    expect(ability.can("access", "MyCountryFeature", "intelligence")).toBe(true);
    expect(ability.can("access", "MyCountryFeature", "map-editor")).toBe(true);
  });

  it("should grant access to dynamic tools", () => {
    // basic_calculator is always unlocked
    const ability1 = defineAbilityFor("user", [], "basic", []);
    expect(ability1.can("use", { type: "Tool", toolId: "basic_calculator", unlocked: true })).toBe(
      true
    );
    expect(ability1.can("use", { type: "Tool", toolId: "map_measurer", unlocked: true })).toBe(
      false
    );

    // custom tools unlocked
    const ability2 = defineAbilityFor("user", [], "basic", ["map_measurer"]);
    expect(ability2.can("use", { type: "Tool", toolId: "map_measurer", unlocked: true })).toBe(
      true
    );
  });
});
