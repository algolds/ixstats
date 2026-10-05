import { resolveInitialTab } from "~/components/vault/sections/cards/useVaultCardsState";
import { SUB_TABS } from "~/components/vault/sections/cards/types";
import { getSubTabFromPathname } from "~/components/vault/vault-sections";

describe("vault Cards lore-first gallery", () => {
  it("offers the Card Gallery tab first, outside development builds", () => {
    expect(process.env.NODE_ENV).not.toBe("development");
    expect(SUB_TABS.map((t) => t.id)).toEqual(["gallery", "inventory", "collections"]);
  });

  it("defaults to the gallery and still honours explicit tabs", () => {
    expect(resolveInitialTab(null)).toBe("gallery");
    expect(resolveInitialTab("lore-gallery")).toBe("gallery");
    expect(resolveInitialTab("inventory")).toBe("inventory");
    expect(resolveInitialTab("collections")).toBe("collections");
  });

  it("maps /vault/cards to the gallery and /vault/inventory to inventory", () => {
    expect(getSubTabFromPathname("/vault/cards")).toBe("gallery");
    expect(getSubTabFromPathname("/vault/lore-gallery")).toBe("gallery");
    expect(getSubTabFromPathname("/vault/inventory")).toBe("inventory");
  });
});
