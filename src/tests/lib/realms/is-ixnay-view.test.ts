import { isIxnayView } from "~/lib/realms/realm-ids";

/** AT-2: Ixnay-only map chrome (ocean labels, the tour) follows the realm the map shows. */
describe("isIxnayView", () => {
  it("follows ?realm= when given", () => {
    expect(isIxnayView("ixnay", "realm_eurth")).toBe(true);
    expect(isIxnayView("eurth", "default")).toBe(false);
  });

  it("still reads the legacy ixworld and default slugs as Ixnay, so old links keep working", () => {
    expect(isIxnayView("ixworld", "realm_eurth")).toBe(true);
    expect(isIxnayView("default", "realm_eurth")).toBe(true);
  });

  it("falls back to the viewer's active nation's realm, else Ixnay", () => {
    expect(isIxnayView(undefined, "default")).toBe(true);
    expect(isIxnayView(undefined, null)).toBe(true);
    expect(isIxnayView(undefined, "realm_eurth")).toBe(false);
  });
});
