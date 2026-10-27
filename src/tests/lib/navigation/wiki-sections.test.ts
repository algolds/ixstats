/** The wiki app's navigation has a Lorewards row, right before Utilities, that owns /util/lorewards. */
import { getActiveSectionId, getApp } from "~/lib/navigation/app-sections";

describe("wiki sections", () => {
  it("lists Lorewards right before Utilities", () => {
    const ids = getApp("wiki").sections.map((section) => section.id);
    expect(ids.indexOf("lorewards")).toBeGreaterThan(-1);
    expect(ids.indexOf("lorewards")).toBe(ids.indexOf("utilities") - 1);
  });

  it("points Lorewards to /util/lorewards", () => {
    const row = getApp("wiki").sections.find((section) => section.id === "lorewards");
    expect(row).toMatchObject({ label: "Lorewards", href: "/util/lorewards" });
  });

  it("marks Lorewards current on /util/lorewards, not Utilities", () => {
    expect(getActiveSectionId(getApp("wiki"), "/util/lorewards", null)).toBe("lorewards");
    expect(getActiveSectionId(getApp("wiki"), "/util", null)).toBe("utilities");
  });
});
