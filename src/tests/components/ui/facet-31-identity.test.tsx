/** Primitive behaviour: the hero material, press and lift physics, figures in the body face, CutoutCard and the flag watermark. */
import fs from "fs";
import path from "path";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { ActionPill } from "~/components/ui/action-pill";
import {
  CutoutCard,
  CutoutCardAction,
  CutoutCardContent,
  CutoutCardHeader,
  CutoutCardStagger,
  CutoutCardStaggerItem,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { FacetMaterial, FlagWatermark } from "~/components/ui/facet";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Stat } from "~/components/ui/stat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { DynamicIslandEffects } from "~/components/halo/DynamicIslandEffects";
import { TEXT_STYLES } from "~/lib/design/tokens";
import { Card } from "~/components/ui/card";

const classOf = (el: Element) => el.getAttribute("class") ?? "";
const ROOT = path.resolve(__dirname, "../../../..");
const identityCss = fs.readFileSync(path.join(ROOT, "src/styles/facet/identity.css"), "utf8");
const tokensCss = fs.readFileSync(path.join(ROOT, "src/styles/facet/tokens.css"), "utf8");

describe("glass hero tier", () => {
  it("Card variant=hero is only the hero material", () => {
    render(
      <Card data-testid="hero" variant="hero">
        Nation
      </Card>
    );
    const hero = screen.getByTestId("hero");
    expect(classOf(hero)).toMatch(/\bmaterial-hero\b/);
    expect(classOf(hero)).toMatch(/\brounded-card\b/);
    expect(classOf(hero)).not.toMatch(/\bbg-surface\b|\bshadow-card\b/);
    expect(hero.querySelector("[aria-hidden]")).toBeNull();
  });

  it("pressable hero lifts and presses", () => {
    render(
      <Card variant="hero" onClick={() => undefined} interactive>
        Open
      </Card>
    );
    const card = screen.getByRole("button", { name: "Open" });
    expect(classOf(card)).toMatch(/\bfacet-lift\b/);
    expect(classOf(card)).toMatch(/\bfacet-press\b/);
  });
});

describe("acrylic and hero materials", () => {
  it.each(["acrylic", "hero"] as const)("FacetMaterial %s maps to its utility", (material) => {
    render(<FacetMaterial data-testid="m" material={material} />);
    expect(classOf(screen.getByTestId("m"))).toContain(`material-${material}`);
  });

  it("DynamicIslandEffects is a decorative glow underlay", () => {
    const { container } = render(<DynamicIslandEffects />);
    const glow = container.firstElementChild!;
    expect(glow).toHaveAttribute("aria-hidden", "true");
    expect(classOf(glow)).toContain("print:hidden");
    expect(container.innerHTML).not.toContain("animate-pulse");
  });
});

describe("primary actions", () => {
  it("the default Button paints the primary role, not the tint", () => {
    const cls = buttonVariants({ variant: "default" });
    expect(cls).toContain("bg-primary");
    expect(cls).toContain("text-primary-foreground");
    expect(cls).not.toMatch(/\bbg-tint\b/);
  });

  it("a caller's colour override still merges over the primary role", () => {
    render(<Button className="bg-destructive text-destructive-foreground">Delete</Button>);
    const cls = classOf(screen.getByRole("button", { name: "Delete" }));
    expect(cls).toContain("bg-destructive");
    expect(cls).not.toMatch(/(?<![\w:-])bg-primary(?![\w-])/);
    expect(cls).not.toMatch(/(?<![\w:-])text-primary-foreground(?![\w-])/);
  });
});

describe("press and lift physics", () => {
  it("Button presses with a colour change, not a scale", () => {
    expect(buttonVariants()).toContain("active:bg-primary/80");
    expect(buttonVariants()).not.toMatch(/\bfacet-press\b/);
    expect(buttonVariants()).not.toContain("scale-");
  });

  it("ActionPill, SegmentedControl segments, ToggleGroup items and FacetRow buttons press", () => {
    render(
      <>
        <ActionPill pressed={false}>Like</ActionPill>
        <SegmentedControl
          aria-label="Period"
          value="w"
          options={[
            { value: "w", label: "Week" },
            { value: "m", label: "Month" },
          ]}
        />
        <ToggleGroup type="multiple" aria-label="Filters">
          <ToggleGroupItem value="a">Active</ToggleGroupItem>
        </ToggleGroup>
        <FacetList>
          <FacetListSection>
            <FacetRow title="Open row" onClick={() => undefined} />
          </FacetListSection>
        </FacetList>
      </>
    );
    expect(classOf(screen.getByRole("button", { name: "Like" }))).toMatch(/\bfacet-press-sm\b/);
    expect(classOf(screen.getByRole("radio", { name: "Week" }))).toMatch(/\bfacet-press\b/);
    expect(classOf(screen.getByRole("button", { name: "Active" }))).toMatch(/\bfacet-press\b/);
    const row = screen.getByRole("button", { name: /Open row/ });
    expect(classOf(row)).toMatch(/\bfacet-press-subtle\b/);
  });

  it("the physics utilities honour Reduce Motion (OS and in-app) and use scale/translate", () => {
    for (const utility of ["facet-press", "facet-lift"]) {
      const body = identityCss.slice(identityCss.indexOf(`@utility ${utility} {`));
      const rule = body.slice(0, body.indexOf("\n}\n"));
      expect(rule).toContain("@media (prefers-reduced-motion: reduce)");
      expect(rule).toContain('[data-motion="reduced"]');
      expect(rule).not.toMatch(/\btransform:/);
    }
    expect(identityCss).toMatch(/@utility facet-press \{[\s\S]*?scale: var\(--facet-press-scale\)/);
    expect(identityCss).toMatch(/@utility facet-lift \{[\s\S]*?translate: 0 var\(--facet-lift-y\)/);
  });
});

describe("figures in the body face", () => {
  it("Stat value and delta are tabular, not mono", () => {
    render(<Stat label="GDP" value="$1.2T" delta={{ value: "+2.4%", direction: "up" }} />);
    const value = screen.getByText("$1.2T");
    expect(classOf(value)).toMatch(/\btabular-nums\b/);
    expect(classOf(value)).not.toMatch(/\bfont-data\b/);
    const delta = screen.getByText("+2.4%").closest('[data-slot="stat-delta"]')!;
    expect(classOf(delta)).toMatch(/\btabular-nums\b/);
    expect(classOf(delta)).not.toMatch(/\bfont-data\b/);
  });

  it("Badge, ActionPill and SegmentedControl counts are tabular, not mono", () => {
    render(
      <>
        <Badge variant="secondary">12</Badge>
        <ActionPill count={42}>Like</ActionPill>
        <SegmentedControl
          aria-label="Box"
          value="in"
          options={[{ value: "in", label: "Inbox", badge: 5, badgeLabel: "5 unread" }]}
        />
      </>
    );
    for (const text of ["12", "42", "5"]) {
      const cls = classOf(screen.getByText(text));
      expect(cls).toMatch(/\btabular-nums\b/);
      expect(cls).not.toMatch(/\bfont-data\b/);
    }
  });

  it("Table cells are tabular without mono; numeric right-aligns the column", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Country</TableHead>
            <TableHead numeric>GDP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Caphiria</TableCell>
            <TableCell numeric>$4.1T</TableCell>
            <TableCell>1,204</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(classOf(screen.getByText("$4.1T"))).toMatch(/\btext-right\b/);
    expect(classOf(screen.getByText("GDP"))).toMatch(/\btext-right\b/);
    for (const text of ["Caphiria", "$4.1T", "1,204"]) {
      expect(classOf(screen.getByText(text))).not.toMatch(/\bfont-data\b/);
    }
    expect(classOf(screen.getByText("1,204"))).toMatch(/\btabular-nums\b/);
  });

  it("FacetRow trailing values are tabular, not mono", () => {
    render(
      <FacetList>
        <FacetListSection>
          <FacetRow title="Population" trailing="12,400,000" />
        </FacetListSection>
      </FacetList>
    );
    const cls = classOf(screen.getByText("12,400,000"));
    expect(cls).toMatch(/\btabular-nums\b/);
    expect(cls).not.toMatch(/\bfont-data\b/);
  });

  it("font-data is Azeret Mono with tabular figures and a slashed zero (v2 .font-mono)", () => {
    expect(tokensCss).toContain('--font-data--font-feature-settings: "tnum" 1, "zero" 1;');
    expect(tokensCss).toContain('--font-mono--font-feature-settings: "tnum" 1, "zero" 1;');
    expect(tokensCss).toMatch(/--font-data: "Azeret Mono"/);
  });
});

describe("heavy tight headings", () => {
  it.each(["display", "large-title", "title-1", "title-2", "title-3"] as const)(
    "%s is bold-or-heavier and tight",
    (style) => {
      expect(TEXT_STYLES[style].weight).toBeGreaterThanOrEqual(700);
      expect(parseFloat(TEXT_STYLES[style].tracking)).toBeLessThanOrEqual(-0.02);
    }
  );

  it("body styles keep their weights", () => {
    expect(TEXT_STYLES.body.weight).toBe(400);
    expect(TEXT_STYLES.headline.weight).toBe(600);
  });
});

describe("CutoutCard", () => {
  it("variant=card is the 28px opaque cutout surface", () => {
    render(
      <CutoutCard data-testid="cut" variant="card">
        <CutoutCardContent>Body</CutoutCardContent>
      </CutoutCard>
    );
    const card = screen.getByTestId("cut");
    expect(classOf(card)).toMatch(/\brounded-cutout\b/);
    expect(classOf(card)).toMatch(/\bbg-surface\b/);
    expect(classOf(card)).toContain("group/cutout");
    expect(cutoutCardSurfaceClassName).toContain("shadow-(--cutout-shadow)");
    // Not pressable: no button role.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("variant=glass uses the hero material", () => {
    render(<CutoutCard data-testid="cut" variant="glass" />);
    expect(classOf(screen.getByTestId("cut"))).toMatch(/\bmaterial-hero\b/);
  });

  it("is keyboard accessible when pressable and lifts/presses", () => {
    const onClick = jest.fn();
    render(
      <CutoutCard variant="card" onClick={onClick} aria-label="Open vault">
        <CutoutCardContent>Vault</CutoutCardContent>
      </CutoutCard>
    );
    const card = screen.getByRole("button", { name: "Open vault" });
    expect(card).toHaveAttribute("tabindex", "0");
    expect(classOf(card)).toMatch(/\bfacet-lift\b/);
    expect(classOf(card)).toMatch(/\bfacet-press\b/);
    expect(classOf(card)).toContain("focus-visible:outline-tint");
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("focus inside reveals hover-only actions (keyboard users reach them)", () => {
    render(
      <CutoutCard data-testid="cut" variant="card">
        <button type="button">Inner</button>
        <CutoutCardAction data-testid="action">Act</CutoutCardAction>
      </CutoutCard>
    );
    expect(screen.getByTestId("cut")).toHaveAttribute("data-state", "idle");
    fireEvent.focus(screen.getByRole("button", { name: "Inner" }));
    expect(screen.getByTestId("cut")).toHaveAttribute("data-state", "hovered");
  });

  it("CutoutCardHeader draws the tinted tab with two inverted-corner notches", () => {
    const { container } = render(
      <CutoutCard variant="card">
        <CutoutCardHeader>Vault sections</CutoutCardHeader>
      </CutoutCard>
    );
    const header = container.querySelector('[data-slot="cutout-card-header"]')!;
    expect(classOf(header)).toContain("bg-tint-fill");
    const corners = header.querySelectorAll('[data-slot="cutout-corner"]');
    expect(corners).toHaveLength(2);
    corners.forEach((corner) => {
      expect(corner).toHaveAttribute("aria-hidden");
      expect(classOf(corner)).toContain("text-surface");
    });
    expect(screen.getByText("Vault sections")).toBeInTheDocument();
  });

  it("CutoutCorner is a decorative notch", () => {
    const { container } = render(<CutoutCorner size={16} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden");
  });

  it("CutoutCardStagger renders its items (blur-in stagger)", () => {
    render(
      <CutoutCard variant="card">
        <CutoutCardStagger>
          <CutoutCardStaggerItem>Headline</CutoutCardStaggerItem>
          <CutoutCardStaggerItem>Detail</CutoutCardStaggerItem>
        </CutoutCardStagger>
      </CutoutCard>
    );
    expect(screen.getByText("Headline")).toBeInTheDocument();
    expect(screen.getByText("Detail")).toBeInTheDocument();
  });
});

describe("FlagWatermark", () => {
  it("is the 320px corner disc with the hover brighten/scale on by default", () => {
    const { container } = render(<FlagWatermark src="/flag.png" />);
    const mark = container.querySelector('[data-slot="flag-watermark"]')!;
    expect(classOf(mark)).toContain("facet-flag-watermark");
    expect(classOf(mark)).toContain("size-80");
    expect(classOf(mark)).toContain("-top-12");
    expect(mark).toHaveAttribute("data-interactive", "true");
    expect(mark).toHaveAttribute("aria-hidden", "true");
  });

  it("the CSS brightens to .25 and scales to 105% on hover, and drops the scale under Reduce Motion", () => {
    expect(tokensCss).toContain("--flag-watermark-opacity: 0.14;");
    expect(tokensCss).toContain("--flag-watermark-opacity: 0.18;");
    expect(tokensCss).toContain("--flag-watermark-opacity-hover: 0.25;");
    expect(identityCss).toMatch(
      /\.facet-flag-watermark\[data-interactive="true"\] \{\s*opacity: var\(--flag-watermark-opacity-hover\);\s*scale: 1\.05;/
    );
    expect(identityCss).toMatch(
      /prefers-reduced-motion[\s\S]*\.facet-flag-watermark \{\s*scale: none;/
    );
  });
});
