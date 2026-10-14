import { pickFeaturedStoreItem } from "~/lib/vault/featured-store-item";

const item = (id: string, price: number, quality: string, category = "cosmetics") => ({
  id,
  name: id,
  price,
  quality,
  category,
});

describe("pickFeaturedStoreItem", () => {
  it("returns null for an empty store", () => {
    expect(pickFeaturedStoreItem([], {})).toBeNull();
  });

  it("takes the highest quality, then the cheapest within it", () => {
    const items = [
      item("common", 10, "COMMON"),
      item("epic-dear", 900, "EPIC"),
      item("epic-cheap", 400, "EPIC"),
      item("rare", 100, "RARE"),
    ];
    expect(pickFeaturedStoreItem(items, {})?.id).toBe("epic-cheap");
  });

  it("skips cosmetics the player already owns", () => {
    const items = [item("epic", 400, "EPIC"), item("rare", 100, "RARE")];
    expect(pickFeaturedStoreItem(items, { epic: 1 })?.id).toBe("rare");
  });

  it("keeps stackable upgrades eligible after a purchase", () => {
    const items = [item("up", 500, "EPIC", "upgrades"), item("rare", 100, "RARE")];
    expect(pickFeaturedStoreItem(items, { up: 3 })?.id).toBe("up");
  });

  it("skips an upgrade whose prerequisite is not met", () => {
    const items = [
      item("upgrade_card_capacity_mega", 5000, "LEGENDARY", "upgrades"),
      item("rare", 100, "RARE"),
    ];
    expect(pickFeaturedStoreItem(items, {})?.id).toBe("rare");
    expect(pickFeaturedStoreItem(items, { upgrade_card_capacity: 5 })?.id).toBe(
      "upgrade_card_capacity_mega"
    );
  });

  it("reads quality case-insensitively and ranks unknown values lowest", () => {
    const items = [item("odd", 1, "standard"), item("rare", 100, "rare")];
    expect(pickFeaturedStoreItem(items, {})?.id).toBe("rare");
  });

  it("returns null when everything is owned", () => {
    expect(pickFeaturedStoreItem([item("a", 1, "RARE")], { a: 1 })).toBeNull();
  });
});
