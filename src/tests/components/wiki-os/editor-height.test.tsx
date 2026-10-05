/**
 * The WikiOS editors fill the viewport below whatever chrome sits above them (tabs row, page
 * header), measured by the content wrapper, instead of subtracting a hard-coded pixel guess.
 */
import fs from "fs";
import path from "path";
import { render } from "@testing-library/react";

jest.mock("next/navigation", () => ({ usePathname: () => "/wiki/Aurelia/edit" }));
jest.mock("~/components/shell/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import { WikiOSContentWrapper } from "~/components/wiki-os/shared/WikiOSContentWrapper";

const css = fs.readFileSync(path.resolve(__dirname, "../../../styles/wiki-os/editors.css"), "utf8");

describe("WikiOS editor height", () => {
  it("has no viewport-minus-pixels magic number", () => {
    expect(css).not.toMatch(/100vh\s*-\s*\d+px/);
  });

  it.each([".wikios-ve-container", ".wikios-editor-modern"])(
    "%s is sized from the measured chrome height",
    (selector) => {
      const block = new RegExp(`\\n\\s*${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`).exec(css);
      expect(block?.[1]).toContain("var(--wikios-chrome-height");
      expect(block?.[1]).toContain("100dvh");
    }
  );

  it("publishes the document offset of the content below the tabs row as --wikios-chrome-height", () => {
    // The body block sits 132px below the viewport top, page scrolled 40px: 172px from the document top.
    const rect = jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: 132 } as DOMRect);
    Object.defineProperty(window, "scrollY", { value: 40, configurable: true });
    const { container } = render(
      <WikiOSContentWrapper tabs={<div role="tablist">tabs</div>}>
        <p>editor</p>
      </WikiOSContentWrapper>
    );
    const main = container.querySelector("main") as HTMLElement;
    expect(main.style.getPropertyValue("--wikios-chrome-height")).toBe("172px");
    rect.mockRestore();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });
});
