import React from "react";
import { render } from "@testing-library/react";
import { PageHeader } from "~/components/shell/PageHeader";

describe("PageHeader backdrop plate", () => {
  beforeEach(() => {
    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  });

  it("puts the title on a frosted lens over visible backdrop art", () => {
    const { container } = render(<PageHeader title="Caphiria" backdrop={<div />} />);
    const plate = container.querySelector('[data-slot="page-header-plate"]');
    expect(plate).not.toBeNull();
    expect(plate).toHaveAttribute("data-layer", "lens");
    expect(plate).toHaveClass("facet-lens-frosted");
  });

  it("keeps a plain title with no lens when the page has no backdrop", () => {
    const { container } = render(<PageHeader title="Caphiria" />);
    expect(container.querySelector('[data-slot="page-header-plate"]')).toBeNull();
    expect(container.querySelector('[data-layer="lens"]')).toBeNull();
  });});

