import fs from "fs";
import path from "path";
import { TOASTER_PLACEMENT } from "~/components/ui/toast";

const css = fs.readFileSync(path.resolve(__dirname, "../../../styles/integrations.css"), "utf8");
const sonner = css.slice(css.indexOf("Sonner Toaster Overrides"));

describe("toaster placement", () => {
  it("sits at the bottom, above the tab bar and clear of the Inspector", () => {
    expect(TOASTER_PLACEMENT.position).toMatch(/^bottom-/);
    expect(TOASTER_PLACEMENT.offset.bottom).toContain("--shell-tabbar-height");
    expect(TOASTER_PLACEMENT.offset.right).toContain("--shell-inspector-width");
    expect(TOASTER_PLACEMENT.mobileOffset.bottom).toContain("--shell-tabbar-height");
  });
  it("is not pinned to the top or scaled in by a stylesheet", () => {
    expect(sonner).not.toMatch(/\btop:/);
    expect(sonner).not.toMatch(/--offset-top/);
    expect(sonner).not.toMatch(/scale\(/);
  });
});
