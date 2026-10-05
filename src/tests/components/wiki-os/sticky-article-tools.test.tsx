/**
 * Long articles keep the article views and page tools in reach: the tabs row is sticky under the
 * shell's Halo band (`--shell-top-offset`), on chrome so scrolled text never shows through, and
 * below the page header's own sticky toolbar so the two never overlap.
 */
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ usePathname: () => "/wiki/Aurelia" }));
jest.mock("~/components/shell/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import { WikiOSContentWrapper } from "~/components/wiki-os/shared/WikiOSContentWrapper";

const tabs = <div role="tablist">tabs</div>;

function stickyRow(el: HTMLElement) {
  return el.closest("[data-slot='wiki-article-tools']") as HTMLElement;
}

describe("WikiOS article tools row", () => {
  it.each([
    ["with a page header", "Aurelia"],
    ["without one", undefined],
  ])("is sticky under the shell top offset on chrome %s", (_label, title) => {
    render(
      <WikiOSContentWrapper title={title} tabs={tabs} actions={<button>New page</button>}>
        <p>body</p>
      </WikiOSContentWrapper>
    );
    const row = stickyRow(screen.getByRole("tablist"));
    expect(row).not.toBeNull();
    expect(row).toHaveClass("sticky", "top-(--shell-top-offset)", "facet-chrome", "z-raised");
  });

  it("keeps the page header's z-sticky toolbar above the tools row", () => {
    // The PageHeader toolbar uses z-sticky (100); the row must stay in the lower raised layer.
    render(
      <WikiOSContentWrapper title="Aurelia" tabs={tabs}>
        <p>body</p>
      </WikiOSContentWrapper>
    );
    expect(stickyRow(screen.getByRole("tablist"))).not.toHaveClass("z-sticky");
  });

  it("renders no tools row without tabs", () => {
    const { container } = render(
      <WikiOSContentWrapper title="Aurelia">
        <p>body</p>
      </WikiOSContentWrapper>
    );
    expect(container.querySelector("[data-slot='wiki-article-tools']")).toBeNull();
  });
});
