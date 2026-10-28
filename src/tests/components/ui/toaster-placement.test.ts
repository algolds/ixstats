import fs from "fs";
import path from "path";
import { TOASTER_PLACEMENT } from "~/components/ui/toast";

const css = fs.readFileSync(path.resolve(__dirname, "../../../styles/integrations.css"), "utf8");
const shell = fs.readFileSync(path.resolve(__dirname, "../../../styles/facet/shell.css"), "utf8");
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

/** Declarations of the rule whose selector list contains `selector`. */
function declarationsFor(source: string, selector: string): string {
  const at = source.indexOf(selector);
  if (at === -1) return "";
  const open = source.indexOf("{", at);
  return source.slice(open + 1, source.indexOf("}", open));
}

// The Toaster mounts beside AppShell, not inside it, so it reads the variables from :root.
describe("shell variables reach the toaster", () => {
  it("zeroes the tab bar and Inspector gutter at the root on chromeless routes", () => {
    const body = declarationsFor(shell, ":root:has([data-app-shell][data-chromeless])");
    expect(body).toContain("--shell-tabbar-height: 0px");
    expect(body).toContain("--shell-inspector-width: 0px");
  });
  it("zeroes the Inspector gutter at the root on pages without an Inspector", () => {
    const body = declarationsFor(shell, ':root:not(:has([data-slot="inspector"]))');
    expect(body).toContain("--shell-inspector-width: 0px");
  });
});
