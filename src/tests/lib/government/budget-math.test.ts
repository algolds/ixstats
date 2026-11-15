import { batchAllocationOverCap } from "~/lib/government/budget-math";
import { resolveEditorPane } from "~/lib/mycountry/routes";

describe("batchAllocationOverCap", () => {
  it("allows totals up to 100% plus rounding tolerance", () => {
    expect(batchAllocationOverCap({ currentTotal: 80, nextTotal: 100 })).toBeNull();
    expect(batchAllocationOverCap({ currentTotal: 80, nextTotal: 100.04 })).toBeNull();
  });

  it("rejects increases past 100%", () => {
    expect(batchAllocationOverCap({ currentTotal: 90, nextTotal: 105.5 })).toBe(
      "The budget would allocate 105.5%, which is more than 100%."
    );
  });

  it("permits cuts on an already over-allocated legacy budget", () => {
    expect(batchAllocationOverCap({ currentTotal: 120, nextTotal: 110 })).toBeNull();
  });
});

describe("resolveEditorPane", () => {
  it("maps studio panes and legacy sub-section hashes to their owning studio pane", () => {
    expect(resolveEditorPane(undefined)).toBe("identity");
    expect(resolveEditorPane("#culture")).toBe("identity");
    expect(resolveEditorPane("#government")).toBe("constitution");
    expect(resolveEditorPane("#legislature")).toBe("constitution");
    expect(resolveEditorPane("#parties")).toBe("cabinet");
    expect(resolveEditorPane("#size")).toBe("scale");
    expect(resolveEditorPane("#figures")).toBe("scale");
    expect(resolveEditorPane("#tariffs")).toBe("taxes");
    expect(resolveEditorPane("#budget")).toBe("budget");
  });
});
