import fs from "fs";
import path from "path";
import { render } from "@testing-library/react";
import { PageHeader } from "~/components/shell/PageHeader";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../../", p), "utf8");
const tokens = (el: Element | null) => (el?.getAttribute("class") ?? "").split(/\s+/);

describe("PageHeader under Halo", () => {
  it("wraps actions inside their half instead of sliding under Halo", () => {
    const { container } = render(<PageHeader title="T" actions={<button>a</button>} />);
    const actions = tokens(container.querySelector('[data-slot="page-header-actions"]'));
    expect(actions).toEqual(expect.arrayContaining(["flex-wrap", "justify-end-safe"]));
    const row = tokens(container.querySelector('[data-slot="page-header-row"]'));
    expect(row).toContain("min-h-14");
    expect(row).not.toContain("h-14");
  });
  it("centres Halo on the same column as the reserve on every page", () => {
    expect(read("styles/facet/shell.css")).not.toContain('[data-slot="shell-halo"]');
    const halo = read("components/shell/ShellHalo.tsx");
    for (const c of [
      "left-(--shell-sidebar-width)",
      "right-(--shell-inspector-width)",
      "top-(--shell-page-top)",
    ])
      expect(halo).toContain(c);
  });
  it("starts the shell page header in Halo's band", () => {
    expect(read("styles/facet/shell.css")).toMatch(
      /--shell-page-top:\s*calc\(env\(safe-area-inset-top\) \+ 0\.5rem\)/
    );
    expect(read("components/shell/ShellPageHeader.tsx")).toContain("pt-(--shell-page-top)");
  });
});
