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

  it("declares --wikios-editor-height once, for both editors, from the measured chrome height", () => {
    const declarations = css.match(/--wikios-editor-height\s*:[^;]*;/g) ?? [];
    expect(declarations).toHaveLength(1);
    expect(declarations[0]).toContain("var(--wikios-chrome-height");
    expect(declarations[0]).toContain("100dvh");
    const rule = /([^{}]*)\{[^}]*--wikios-editor-height\s*:/.exec(css)?.[1] ?? "";
    expect(rule).toContain(".wikios-ve-container");
    expect(rule).toContain(".wikios-editor-modern");
  });

  it.each([".wikios-ve-container", ".wikios-editor-modern"])(
    "%s is sized from --wikios-editor-height",
    (selector) => {
      const blocks = [
        ...css.matchAll(new RegExp(`\\n\\s*${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "g")),
      ].map((m) => m[1]);
      const sizing = blocks.find((b) => b?.includes("max-height"));
      expect(sizing).toContain("height: var(--wikios-editor-height)");
      expect(sizing).toContain("max-height: var(--wikios-editor-height)");
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

  describe("resize publishing", () => {
    const originalRO = globalThis.ResizeObserver;
    let notify: (() => void) | undefined;
    const disconnect = jest.fn();
    const frames: Array<() => void> = [];

    beforeEach(() => {
      notify = undefined;
      frames.length = 0;
      disconnect.mockClear();
      globalThis.ResizeObserver = class {
        constructor(cb: () => void) {
          notify = cb;
        }
        observe() {}
        unobserve() {}
        disconnect = disconnect;
      } as unknown as typeof ResizeObserver;
      jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        frames.push(() => cb(0));
        return frames.length;
      });
      jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    });

    afterEach(() => {
      globalThis.ResizeObserver = originalRO;
      jest.restoreAllMocks();
    });

    it("defers the publish to the next frame, so it never runs inside the observer callback", () => {
      let top = 100;
      jest
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(() => ({ top }) as DOMRect);
      const { container } = render(
        <WikiOSContentWrapper tabs={<div role="tablist">tabs</div>}>
          <p>editor</p>
        </WikiOSContentWrapper>
      );
      const main = container.querySelector("main") as HTMLElement;
      expect(main.style.getPropertyValue("--wikios-chrome-height")).toBe("100px");

      top = 160;
      notify?.();
      // Still the old value: nothing was published synchronously.
      expect(main.style.getPropertyValue("--wikios-chrome-height")).toBe("100px");
      frames.forEach((run) => run());
      expect(main.style.getPropertyValue("--wikios-chrome-height")).toBe("160px");
    });

    it("stops observing on unmount", () => {
      const { unmount } = render(
        <WikiOSContentWrapper>
          <p>editor</p>
        </WikiOSContentWrapper>
      );
      unmount();
      expect(disconnect).toHaveBeenCalled();
    });
  });
});
