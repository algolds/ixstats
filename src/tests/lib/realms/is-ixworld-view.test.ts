import { isIxWorldView } from "~/lib/realms/realm-ids";

/** AT-2: IxWorld-only map chrome (ocean labels, the tour) follows the realm the map shows. */
describe("isIxWorldView", () => {
  it("follows ?realm= when given", () => {
    expect(isIxWorldView("ixworld", "realm_eurth")).toBe(true);
    expect(isIxWorldView("default", "realm_eurth")).toBe(true);
    expect(isIxWorldView("eurth", "default")).toBe(false);
  });

  it("falls back to the viewer's active nation's realm, else IxWorld", () => {
    expect(isIxWorldView(undefined, "default")).toBe(true);
    expect(isIxWorldView(undefined, null)).toBe(true);
    expect(isIxWorldView(undefined, "realm_eurth")).toBe(false);
  });
});
