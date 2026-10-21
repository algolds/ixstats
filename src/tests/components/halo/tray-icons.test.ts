/** The notification tray's icons: card and pack notices get their own, the ones the Vault uses for cards and packs. */
import { MultiplePages, Package } from "iconoir-react";
import { getIcon } from "~/components/halo/views/tray/types";

describe("getIcon", () => {
  it("gives card notices the cards icon and pack notices the pack icon, whatever their type", () => {
    expect(getIcon({ id: "n1", title: "Sold", category: "cards", type: "success" })).toBe(
      MultiplePages
    );
    expect(getIcon({ id: "n2", title: "Opened", category: "packs", type: "info" })).toBe(Package);
  });
});
