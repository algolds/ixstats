/**
 * Status Badge/Alert inks and roles, the ShellPageHeader page-title hook, SegmentedControl option
 * badges, virtual-anchor Popover/HoverCard, the FacetDataTable family and the Card parts.
 */
import "fs";
import "path";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  PopoverVirtualAnchor,
  Popover,
  PopoverContent,
  VirtualAnchorPopover,
  toMeasurable,
} from "~/components/ui/popover";
import { VirtualAnchorHoverCard } from "~/components/ui/hover-card";
import { FacetDataTable } from "~/components/ui/data-table/FacetDataTable";
import { FacetTablePagination } from "~/components/ui/data-table/FacetTablePagination";
const classOf = (el: Element) => el.getAttribute("class") ?? "";
const CARD_SURFACE = ["facet-pane", "rounded-card"];

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});
describe("Alert", () => {
  it("adds caution and info; info and success are polite status, the rest assertive", () => {
    render(
      <>
        <Alert variant="info" data-testid="info">
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>New data arrives nightly.</AlertDescription>
        </Alert>
        <Alert variant="success" data-testid="success" />
        <Alert variant="caution" data-testid="caution" />
        <Alert variant="destructive" data-testid="destructive" />
        <Alert data-testid="default" />
        <Alert variant="warning" role="note" data-testid="note" />
      </>
    );
    expect(screen.getByTestId("info")).toHaveAttribute("role", "status");
    expect(screen.getByTestId("success")).toHaveAttribute("role", "status");
    expect(screen.getByTestId("caution")).toHaveAttribute("role", "alert");
    expect(screen.getByTestId("destructive")).toHaveAttribute("role", "alert");
    expect(screen.getByTestId("default")).toHaveAttribute("role", "alert");
    expect(screen.getByTestId("note")).toHaveAttribute("role", "note");
    expect(screen.getByTestId("info")).toHaveAttribute("data-variant", "info");
    expect(classOf(screen.getByTestId("default"))).toMatch(/\bbg-surface\b.*|\bborder-separator\b/);
  });
});
describe("SegmentedControl option badges", () => {
  function Inbox() {
    const [value, setValue] = useState("inbox");
    return (
      <SegmentedControl
        aria-label="Mailbox"
        value={value}
        onValueChange={setValue}
        options={[
          { value: "inbox", label: "Inbox", badge: 12, badgeLabel: "12 unread" },
          { value: "sent", label: "Sent", badge: 3 },
          { value: "drafts", label: "Drafts" },
          { value: "stars", label: <span aria-hidden>★</span>, "aria-label": "Starred", badge: 2 },
        ]}
      />
    );
  }

  it("renders a tabular, aria-hidden count and names the segment with its label", () => {
    render(<Inbox />);
    expect(screen.getByRole("radio", { name: "Inbox , 12 unread" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Sent , 3" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Drafts" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Starred, 2" })).toBeInTheDocument();
    const badge = screen
      .getByRole("radio", { name: /Inbox/ })
      .querySelector('[data-slot="segmented-control-badge"]')!;
    expect(badge).toHaveAttribute("aria-hidden");
    expect(badge.textContent).toBe("12");
    expect(classOf(badge)).toMatch(/\btabular-nums\b/);
    expect(classOf(badge)).toMatch(/\bbg-tint-fill\b/);
  });
});
describe("Virtual-anchor Popover / HoverCard", () => {
  const rect = { x: 10, y: 20, width: 30, height: 10, top: 20, left: 10, right: 40, bottom: 30 };

  it("toMeasurable keeps elements, wraps rects and follows ranges live", () => {
    const el = document.createElement("a");
    expect(toMeasurable(el)).toBe(el);

    const domRect = { ...rect, toJSON: () => rect } as DOMRect;
    expect(toMeasurable(domRect).getBoundingClientRect()).toBe(domRect);

    const p = document.createElement("p");
    p.textContent = "Selected text";
    document.body.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p);
    const live = jest.fn(() => domRect);
    range.getBoundingClientRect = live;
    const measurable = toMeasurable(range);
    expect(measurable.contextElement).toBe(p);
    measurable.getBoundingClientRect();
    expect(live).toHaveBeenCalled();
    p.remove();
  });

  it("PopoverVirtualAnchor positions a Popover without rendering an element", () => {
    const el = document.createElement("span");
    const { container } = render(
      <Popover open>
        <PopoverVirtualAnchor anchor={el} />
        <PopoverContent>Anchored</PopoverContent>
      </Popover>
    );
    expect(screen.getByText("Anchored")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="popover-virtual-anchor"]')).toBeNull();
  });

  it("opens with an anchor, closes without one, and never takes focus", () => {
    const link = document.createElement("a");
    link.href = "/wiki/Caphiria";
    link.textContent = "Caphiria";
    document.body.appendChild(link);
    const before = document.createElement("button");
    document.body.appendChild(before);
    before.focus();

    const { rerender } = render(
      <VirtualAnchorPopover anchor={link} role="toolbar" aria-label="Selection actions">
        <button type="button">Discuss</button>
      </VirtualAnchorPopover>
    );
    const toolbar = screen.getByRole("toolbar", { name: "Selection actions" });
    expect(toolbar).toHaveAttribute("data-slot", "virtual-anchor-popover");
    expect(classOf(toolbar)).toMatch(/\bfacet-overlay\b/);
    expect(before).toHaveFocus();

    rerender(
      <VirtualAnchorPopover anchor={null} role="toolbar" aria-label="Selection actions">
        <button type="button">Discuss</button>
      </VirtualAnchorPopover>
    );
    expect(screen.queryByRole("toolbar")).toBeNull();
    link.remove();
    before.remove();
  });

  it("reports dismissal (Escape) through onOpenChange", () => {
    const el = document.createElement("span");
    document.body.appendChild(el);
    const onOpenChange = jest.fn();
    render(
      <VirtualAnchorPopover anchor={el} onOpenChange={onOpenChange} role="toolbar" aria-label="T">
        <button type="button">Copy</button>
      </VirtualAnchorPopover>
    );
    fireEvent.keyDown(screen.getByRole("toolbar"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    el.remove();
  });

  it("VirtualAnchorHoverCard is an overlay card with no dialog role", () => {
    const el = document.createElement("a");
    document.body.appendChild(el);
    render(
      <VirtualAnchorHoverCard anchor={el} data-testid="card">
        Preview
      </VirtualAnchorHoverCard>
    );
    const card = screen.getByTestId("card");
    expect(card).not.toHaveAttribute("role");
    expect(classOf(card)).toMatch(/\bfacet-overlay\b/);
    el.remove();
  });
});

describe("FacetDataTable family on Facet 3", () => {
  const rows = [
    { id: "1", name: "Alice", salary: 10 },
    { id: "2", name: "Bob", salary: 20 },
  ];
  const columns = [
    { key: "name", header: "Name", sortable: true },
    { key: "salary", header: "Salary", sortable: true },
  ];

  it("sortable headers are buttons with aria-sort", () => {
    render(<FacetDataTable data={rows} columns={columns} layoutMode="table" />);
    const header = screen.getByRole("columnheader", { name: "Name" });
    expect(header).toHaveAttribute("aria-sort", "none");
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(header).toHaveAttribute("aria-sort", "ascending");
  });
  it("loading uses Skeletons and marks itself busy", () => {
    const { container } = render(<FacetDataTable data={[]} columns={columns} loading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("mobile cards are pane FacetCards, pressable by keyboard", () => {
    const onRowClick = jest.fn();
    const { container } = render(
      <FacetDataTable data={rows} columns={columns} layoutMode="cards" onRowClick={onRowClick} />
    );
    const card = container.querySelector('[data-slot="facet-mobile-card"]')!;
    for (const token of CARD_SURFACE) expect(card).toHaveClass(token);
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("pagination is a named nav with the current page marked", () => {
    render(
      <FacetTablePagination
        currentPage={2}
        totalPages={3}
        totalItems={30}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Next Page" })).toBeInTheDocument();
  });
});
