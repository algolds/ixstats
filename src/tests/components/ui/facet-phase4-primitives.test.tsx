/**
 * Status Badge/Alert inks and roles, the ShellPageHeader page-title hook, SegmentedControl option
 * badges, virtual-anchor Popover/HoverCard, the FacetDataTable family and the Card parts.
 */
import fs from "fs";
import path from "path";
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { Badge, badgeVariants } from "~/components/ui/badge";
import { Alert, AlertDescription, AlertTitle, alertVariants } from "~/components/ui/alert";
import {
  ShellPageHeader,
  SHELL_PAGE_TITLE_ATTRIBUTE,
  shellPageTitleProps,
} from "~/components/shell/ShellPageHeader";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { STATUS_ALIASES } from "~/lib/design/tokens";

const ROOT = path.resolve(__dirname, "../../../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
const classOf = (el: Element) => el.getAttribute("class") ?? "";
const STATUSES = Object.keys(STATUS_ALIASES) as (keyof typeof STATUS_ALIASES)[];
const BADGE_STATUSES = ["success", "warning", "destructive", "info"] as const;
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

describe("Status Badge contrast", () => {
  it.each(BADGE_STATUSES)("%s badge uses the status ink on a 15%% fill", (status) => {
    const cls = badgeVariants({ variant: status });
    expect(cls).toContain(`bg-${status}/15`);
    expect(cls).toContain(`text-${status}-ink`);
    expect(cls).not.toMatch(new RegExp(`text-${status}(\\s|$)`));
  });

  it("renders the variant as data", () => {
    render(<Badge variant="warning">Late</Badge>);
    expect(screen.getByText("Late")).toHaveAttribute("data-variant", "warning");
  });
});

describe("Alert", () => {
  it.each(STATUSES)("%s: ink on a 15%% fill, label description", (status) => {
    const cls = alertVariants({ variant: status });
    expect(cls).toContain(`bg-${status}/15`);
    expect(cls).toContain(`text-${status}-ink`);
    expect(cls).toContain("*:data-[slot=alert-description]:text-label");
  });

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

  it("uses no legacy classes", () => {
    const source = read("src/components/ui/alert.tsx");
    expect(source).not.toMatch(/muted-foreground|text-sm\b|rounded-lg\b|bg-card\b/);
  });
});

describe("ShellPageHeader page-title hook", () => {
  it("exports the attribute and spreadable props", () => {
    expect(SHELL_PAGE_TITLE_ATTRIBUTE).toBe("data-shell-page-title");
    render(<h1 {...shellPageTitleProps}>Countries</h1>);
    expect(screen.getByRole("heading", { name: "Countries" })).toHaveAttribute(
      "data-shell-page-title",
      ""
    );
  });

  it("marks the shell header with where it shows", () => {
    const { container, rerender } = render(<ShellPageHeader title="Vault" />);
    expect(container.querySelector('[data-slot="shell-page-header"]')).toHaveAttribute(
      "data-shell-page-header",
      "phone"
    );
    rerender(<ShellPageHeader title="Vault" phoneOnly={false} />);
    expect(container.querySelector('[data-slot="shell-page-header"]')).toHaveAttribute(
      "data-shell-page-header",
      "all"
    );
  });

  it("hides a marked title where the shell header shows", () => {
    const css = read("src/styles/facet/shell.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const utilities = css.slice(css.indexOf("@layer utilities"));
    expect(utilities).toMatch(
      /:root:has\(\[data-shell-page-header="all"\]\) \[data-shell-page-title\]\s*\{\s*display:\s*none;/
    );
    expect(utilities).toMatch(
      /@media \(max-width: 1023\.98px\) \{\s*:root:has\(\[data-shell-page-header="phone"\]\) \[data-shell-page-title\]\s*\{\s*display:\s*none;/
    );
  });

  it("is adopted by the countries index and the ThinkPages hub (no ad-hoc facet-nav hiding)", () => {
    const countries = read("src/app/countries/_components/CountriesHeader.tsx");
    const hub = read("src/components/thinkpages/ThinkPagesAccountHub.tsx");
    expect(countries).toContain("<PageHeader");
    expect(countries).not.toContain("shellPageTitleProps");
    expect(countries).not.toContain("facet-nav:max-lg:hidden");
    expect(hub).toMatch(/<h1 \{\.\.\.shellPageTitleProps\}/);
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

  it("selected and unselected badges differ", () => {
    render(<Inbox />);
    fireEvent.click(screen.getByRole("radio", { name: /Sent/ }));
    const sent = screen
      .getByRole("radio", { name: /Sent/ })
      .querySelector('[data-slot="segmented-control-badge"]')!;
    const inbox = screen
      .getByRole("radio", { name: /Inbox/ })
      .querySelector('[data-slot="segmented-control-badge"]')!;
    expect(classOf(sent)).toMatch(/\bbg-tint-fill\b/);
    expect(classOf(inbox)).toMatch(/\bbg-fill-3\b/);
  });

  it("draws the thumb with the control-thumb role (no dark: override)", () => {
    expect(read("src/components/ui/segmented-control.tsx")).not.toMatch(/\bdark:/);
  });
});

describe("Card parts", () => {
  it("keeps the surface and its slotted parts", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>Content</CardContent>
      </Card>
    );
    const card = screen.getByTestId("card");
    for (const token of CARD_SURFACE) expect(card).toHaveClass(token);
    expect(card).toHaveAttribute("data-slot", "card");
    expect(screen.getByText("Content")).toHaveAttribute("data-slot", "card-content");
    expect(screen.getByText("Title")).toHaveAttribute("data-slot", "card-title");
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
    expect(toolbar).toHaveAttribute("data-surface", "material");
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

  it("VirtualAnchorHoverCard is an elevated card with no dialog role", () => {
    const el = document.createElement("a");
    document.body.appendChild(el);
    render(
      <VirtualAnchorHoverCard anchor={el} data-testid="card">
        Preview
      </VirtualAnchorHoverCard>
    );
    const card = screen.getByTestId("card");
    expect(card).not.toHaveAttribute("role");
    expect(card).toHaveAttribute("data-surface", "elevated");
    expect(classOf(card)).toMatch(/\bbg-surface-elevated\b/);
    el.remove();
  });

  it("the WikiOS selection toolbar, link hover card and cite tooltips use it (no portals)", () => {
    for (const file of [
      "src/components/wiki-os/margin/SelectionCapsule.tsx",
      "src/components/wiki-os/shared/GlobalLinkTooltipProvider.tsx",
      "src/components/wiki-os/reader/useCiteTooltips.ts",
    ]) {
      const source = read(file);
      expect([file, source.includes("createPortal")]).toEqual([file, false]);
      expect([file, /VirtualAnchor(Popover|HoverCard)/.test(source)]).toEqual([file, true]);
    }
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

  it("empty state is the EmptyState primitive in a card", () => {
    const { container } = render(
      <FacetDataTable data={[]} columns={columns} emptyMessage="No leaders yet" />
    );
    expect(container.querySelector('[data-slot="empty-state"]')).toBeInTheDocument();
    expect(screen.getByText("No leaders yet")).toBeInTheDocument();
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

  it("uses no glass or muted classes", () => {
    for (const file of [
      "FacetDataTable.tsx",
      "FacetMobileCard.tsx",
      "FacetTablePagination.tsx",
      "FacetTableToolbar.tsx",
    ]) {
      const source = read(`src/components/ui/data-table/${file}`);
      expect([file, source]).not.toEqual([
        file,
        expect.stringMatching(
          /muted|backdrop-blur|facet-hierarchy|facet-surface|bg-card|border-border/
        ),
      ]);
    }
  });
});

describe("src/components/ui has no v2 classes", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(ROOT, "src/components/ui"));

  it.each([
    ["glass-*", /\bglass-[a-z]/],
    ["facet-hierarchy-*", /facet-hierarchy-/],
    ["bg-background/…", /bg-background\//],
    ["border-border/…", /border-border\//],
    ["muted-foreground", /muted-foreground/],
    ["dark: overrides", /\bdark:[a-z[]/],
    ["hex classes", /\[#[0-9a-fA-F]{3,8}\]/],
    [
      "retired x.5 spacing",
      /(^|[\s"'`])-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|left|right|bottom)-[123]\.5\b/,
    ],
  ])("%s", (_name, pattern) => {
    const offenders = files.filter((file) => pattern.test(fs.readFileSync(file, "utf8")));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});
