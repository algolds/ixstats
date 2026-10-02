/**
 * Facet 3.1 — identity restored (docs/specs/2026-09-30-facet-3-design-system.md §16).
 *
 * The primitives that carry the v2 identity on tokens: the glass hero tier, glow and refraction,
 * the monochrome / gold primary, press and lift physics, the data face for figures, the heavy
 * headings, the restored CutoutCard and the v2-strength flag watermark.
 */
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
import { FacetCard, MotionFacetCard } from "~/components/ui/facet-container";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import {
  AcrylicGlow,
  FacetMaterial,
  FlagWatermark,
  Refraction,
  TintGlow,
} from "~/components/ui/facet";
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
import { isNumericText } from "~/lib/design/identity";
import { TEXT_STYLES } from "~/lib/design/tokens";

const classOf = (el: Element) => el.getAttribute("class") ?? "";
const ROOT = path.resolve(__dirname, "../../../..");
const identityCss = fs.readFileSync(path.join(ROOT, "src/styles/facet/identity.css"), "utf8");
const tokensCss = fs.readFileSync(path.join(ROOT, "src/styles/facet/tokens.css"), "utf8");

describe("glass hero tier", () => {
  it("FacetCard variant=glass is the hero material with a refraction hairline", () => {
    render(
      <FacetCard data-testid="hero" variant="glass">
        Nation
      </FacetCard>
    );
    const hero = screen.getByTestId("hero");
    expect(hero).toHaveAttribute("data-variant", "glass");
    expect(classOf(hero)).toMatch(/\bmaterial-hero\b/);
    expect(classOf(hero)).toMatch(/\brounded-card\b/);
    // Opaque card classes are not mixed in.
    expect(classOf(hero)).not.toMatch(/\bbg-surface\b|\bshadow-card\b/);
    const line = hero.querySelector('[data-slot="refraction"]')!;
    expect(line).toHaveAttribute("aria-hidden", "true");
    expect(classOf(line)).toContain("facet-refraction-line");
  });

  it("refraction can be turned off on glass and on for the opaque card", () => {
    const { rerender } = render(
      <FacetCard data-testid="c" variant="glass" refraction={false}>
        x
      </FacetCard>
    );
    expect(screen.getByTestId("c").querySelector('[data-slot="refraction"]')).toBeNull();
    rerender(
      <FacetCard data-testid="c" refraction>
        x
      </FacetCard>
    );
    expect(screen.getByTestId("c").querySelector('[data-slot="refraction"]')).not.toBeNull();
  });

  it("glass skips the opaque hover wash; pressable glass lifts and presses", () => {
    render(
      <FacetCard variant="glass" onClick={() => undefined}>
        Open
      </FacetCard>
    );
    const card = screen.getByRole("button", { name: "Open" });
    expect(classOf(card)).not.toContain("hover:bg-[image:");
    expect(classOf(card)).toMatch(/\bfacet-lift\b/);
    expect(classOf(card)).toMatch(/\bfacet-press\b/);
  });

  it("MotionFacetCard takes the glass variant and glow", () => {
    render(
      <MotionFacetCard data-testid="m" variant="glass" glow initial={false}>
        x
      </MotionFacetCard>
    );
    const card = screen.getByTestId("m");
    expect(classOf(card)).toMatch(/\bmaterial-hero\b/);
    expect(card.querySelector('[data-slot="tint-glow"]')).not.toBeNull();
  });
});

describe("glow", () => {
  it.each([
    [true, "both", true, true],
    ["blob", "blob", true, false],
    ["shadow", "shadow", false, true],
  ] as const)("glow=%s renders %s", (glow, kind, blob, shadow) => {
    render(
      <FacetCard data-testid="g" glow={glow}>
        x
      </FacetCard>
    );
    const card = screen.getByTestId("g");
    expect(card).toHaveAttribute("data-glow", kind);
    expect(card.querySelector('[data-slot="tint-glow"]') !== null).toBe(blob);
    expect(/\bfacet-glow\b/.test(classOf(card))).toBe(shadow);
    if (blob) {
      // The blob sits under the content inside the card's own stacking context, clipped.
      expect(classOf(card)).toMatch(/\bisolate\b/);
      expect(classOf(card)).toMatch(/\boverflow-hidden\b/);
      expect(classOf(card.querySelector('[data-slot="tint-glow"]')!)).toContain("-z-10");
    }
    if (shadow) {
      // The glow's shadow stack replaces shadow-card (Tailwind's list has no glow slot).
      expect(classOf(card)).not.toMatch(/\bshadow-card\b/);
    }
  });

  it("TintGlow is a decorative tint disc placed by position", () => {
    const { container } = render(<TintGlow position="bottom-left" color="var(--color-green)" />);
    const glow = container.querySelector('[data-slot="tint-glow"]')!;
    expect(glow).toHaveAttribute("aria-hidden", "true");
    expect(classOf(glow)).toContain("facet-tint-glow");
    expect(classOf(glow)).toContain("-bottom-10");
    expect(classOf(glow)).toContain("print:hidden");
    expect((glow as HTMLElement).style.getPropertyValue("--glow-color")).toBe("var(--color-green)");
  });
});

describe("acrylic and hero materials", () => {
  it("FacetMaterial acrylic: material-acrylic, four refraction edges, optional glow underlay", () => {
    render(
      <FacetMaterial data-testid="island" material="acrylic" glow>
        Halo
      </FacetMaterial>
    );
    const island = screen.getByTestId("island");
    expect(island).toHaveAttribute("data-material", "acrylic");
    expect(classOf(island)).toMatch(/\bmaterial-acrylic\b/);
    expect(island.querySelectorAll('[data-slot="refraction"]')).toHaveLength(4);
    expect(island.querySelector('[data-slot="acrylic-glow"]')).not.toBeNull();
    expect(classOf(island)).toMatch(/\bisolate\b/);
  });

  it("FacetMaterial hero has the top hairline; thin/regular/thick stay as they were", () => {
    const { rerender } = render(<FacetMaterial data-testid="m" material="hero" />);
    expect(classOf(screen.getByTestId("m"))).toMatch(/\bmaterial-hero\b/);
    expect(screen.getByTestId("m").querySelectorAll('[data-slot="refraction"]')).toHaveLength(1);
    rerender(<FacetMaterial data-testid="m" material="regular" />);
    expect(screen.getByTestId("m").querySelector('[data-slot="refraction"]')).toBeNull();
  });

  it("Refraction edges=all draws the four Dynamic Island edges", () => {
    const { container } = render(<Refraction edges="all" />);
    const edges = [...container.querySelectorAll('[data-slot="refraction"]')].map((el) =>
      el.getAttribute("data-edge")
    );
    expect(edges).toEqual(["top", "bottom", "left", "right"]);
  });

  it("AcrylicGlow and DynamicIslandEffects render the three v2 glow layers, no shimmer loop", () => {
    const { container, rerender } = render(<AcrylicGlow orientation="vertical" />);
    expect(container.querySelectorAll(".facet-acrylic-glow")).toHaveLength(3);
    rerender(<DynamicIslandEffects showShimmer />);
    expect(container.querySelectorAll(".facet-acrylic-glow")).toHaveLength(3);
    expect(container.querySelectorAll('[data-slot="refraction"]')).toHaveLength(4);
    expect(container.innerHTML).not.toContain("animate-pulse");
  });
});

describe("primary actions", () => {
  it("filled (and default) paint the primary role, not the tint", () => {
    for (const variant of ["filled", "default"] as const) {
      const cls = buttonVariants({ variant });
      expect(cls).toContain("bg-primary-fill");
      expect(cls).toContain("bg-(image:--primary-fill-image)");
      expect(cls).toContain("text-on-primary");
      expect(cls).toContain("shadow-(--primary-rim)");
      expect(cls).not.toMatch(/\bbg-tint\b/);
    }
    expect(buttonVariants({ variant: "tinted" })).toContain("bg-tint-fill text-tint");
  });

  it("a caller's colour override still merges over the primary role", () => {
    render(<Button className="bg-destructive text-on-destructive">Delete</Button>);
    const cls = classOf(screen.getByRole("button", { name: "Delete" }));
    expect(cls).toContain("bg-destructive");
    expect(cls).not.toMatch(/(?<![\w:-])bg-primary-fill(?![\w-])/);
    expect(cls).not.toMatch(/(?<![\w:-])text-on-primary(?![\w-])/);
  });

  it("the gold primary is scoped to MyCountry / Builder and reset for every other app scope", () => {
    const mycountry = tokensCss.slice(
      tokensCss.indexOf('[data-app="mycountry"],\n  [data-app="builder"] {')
    );
    expect(mycountry).toContain("--primary-fill: var(--gold);");
    expect(mycountry).toContain("--on-primary: var(--on-gold);");
    expect(tokensCss).toMatch(
      /:root,\n\s+\[data-app\] \{\n\s+--primary-fill: var\(--primary-mono\);/
    );
  });
});

describe("press and lift physics", () => {
  it("Button presses (.98; icon sizes .95) through facet-press, not ad-hoc scale classes", () => {
    expect(buttonVariants()).toMatch(/\bfacet-press\b/);
    expect(buttonVariants()).not.toContain("active:scale-");
    expect(buttonVariants({ size: "icon" })).toMatch(/\bfacet-press-sm\b/);
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
      expect(rule).toContain("@variant motion-reduce");
      expect(rule).not.toMatch(/\btransform:/);
    }
    expect(identityCss).toMatch(/@utility facet-press \{[\s\S]*?scale: var\(--facet-press-scale\)/);
    expect(identityCss).toMatch(/@utility facet-lift \{[\s\S]*?translate: 0 var\(--facet-lift-y\)/);
  });
});

describe("data face for figures", () => {
  it("Stat value and delta use font-data (and keep tabular-nums)", () => {
    render(<Stat label="GDP" value="$1.2T" delta={{ value: "+2.4%", direction: "up" }} />);
    const value = screen.getByText("$1.2T");
    expect(classOf(value)).toMatch(/\bfont-data\b/);
    expect(classOf(value)).toMatch(/\btabular-nums\b/);
    expect(classOf(screen.getByText("+2.4%").closest('[data-slot="stat-delta"]')!)).toMatch(
      /\bfont-data\b/
    );
  });

  it("Badge counts switch to the data face; words do not", () => {
    render(
      <>
        <Badge>12</Badge>
        <Badge>Tier 3</Badge>
        <Badge numeric>
          <span>7</span>
        </Badge>
      </>
    );
    expect(classOf(screen.getByText("12"))).toMatch(/\bfont-data\b/);
    expect(classOf(screen.getByText("Tier 3"))).not.toMatch(/\bfont-data\b/);
    expect(classOf(screen.getByText("7").parentElement!)).toMatch(/\bfont-data\b/);
  });

  it("ActionPill and SegmentedControl counts use font-data", () => {
    render(
      <>
        <ActionPill count={42}>Like</ActionPill>
        <SegmentedControl
          aria-label="Box"
          value="in"
          options={[{ value: "in", label: "Inbox", badge: 5, badgeLabel: "5 unread" }]}
        />
      </>
    );
    expect(classOf(screen.getByText("42"))).toMatch(/\bfont-data\b/);
    expect(classOf(screen.getByText("5"))).toMatch(/\bfont-data\b/);
  });

  it("Table figures: auto data face; numeric right-aligns the column", () => {
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
    expect(classOf(screen.getByText("Caphiria"))).not.toMatch(/\bfont-data\b/);
    expect(classOf(screen.getByText("$4.1T"))).toMatch(/\bfont-data\b/);
    expect(classOf(screen.getByText("$4.1T"))).toMatch(/\btext-right\b/);
    expect(classOf(screen.getByText("1,204"))).toMatch(/\bfont-data\b/);
    expect(classOf(screen.getByText("GDP"))).toMatch(/\btext-right\b/);
  });

  it("FacetRow numeric trailing values use the data face", () => {
    render(
      <FacetList>
        <FacetListSection>
          <FacetRow title="Population" trailing="12,400,000" />
          <FacetRow title="Capital" trailing="Velaria" />
        </FacetListSection>
      </FacetList>
    );
    expect(classOf(screen.getByText("12,400,000"))).toMatch(/\bfont-data\b/);
    expect(classOf(screen.getByText("Velaria"))).not.toMatch(/\bfont-data\b/);
  });

  it.each([
    ["1,204", true],
    ["+2.4%", true],
    ["−120", true],
    ["$1.2T", true],
    ["#3", true],
    ["4.5×", true],
    ["12 / 40", true],
    ["12 unread", false],
    ["Tier 3", false],
    ["v2", false],
    ["", false],
  ])("isNumericText(%p) is %p", (text, expected) => {
    expect(isNumericText(text)).toBe(expected);
  });

  it("font-data is Azeret Mono with tabular figures and a slashed zero (v2 .font-mono)", () => {
    expect(tokensCss).toContain('--font-data--font-feature-settings: "tnum" 1, "zero" 1;');
    expect(tokensCss).toContain('--font-mono--font-feature-settings: "tnum" 1, "zero" 1;');
    expect(tokensCss).toMatch(/--font-data: "Azeret Mono"/);
  });
});

describe("headings", () => {
  it.each(["display", "large-title", "title-1"] as const)("%s is bold and tight", (style) => {
    expect(TEXT_STYLES[style].weight).toBe(700);
    expect(TEXT_STYLES[style].tracking).toBe("-0.015em");
  });

  it.each(["title-2", "title-3", "headline"] as const)("%s is semibold", (style) => {
    expect(TEXT_STYLES[style].weight).toBe(600);
  });

  it("tracking tightens only as the size grows", () => {
    const sizes = Object.values(TEXT_STYLES).sort((a, b) => b.size - a.size);
    const tracking = sizes.map((s) => parseFloat(s.tracking));
    expect(tracking).toEqual([...tracking].sort((a, b) => a - b));
  });

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
    // The accent fill: the app tint's tint-fill unless the card or header sets `accent`.
    expect(classOf(header)).toContain("bg-facet-accent-fill");
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

  it("glow renders a clipped tint blob", () => {
    render(<CutoutCard data-testid="cut" variant="card" glow />);
    const card = screen.getByTestId("cut");
    expect(card.querySelector('[data-slot="tint-glow"]')).not.toBeNull();
    expect(classOf(card)).toMatch(/\bisolate\b/);
  });
});

describe("FlagWatermark (v2 strength)", () => {
  it("is the 320px corner disc with the hover brighten/scale on by default", () => {
    const { container } = render(<FlagWatermark src="/flag.png" />);
    const mark = container.querySelector('[data-slot="flag-watermark"]')!;
    expect(classOf(mark)).toContain("facet-flag-watermark");
    expect(classOf(mark)).toContain("size-80");
    expect(classOf(mark)).toContain("-top-12");
    expect(mark).toHaveAttribute("data-interactive", "true");
    expect(mark).toHaveAttribute("aria-hidden", "true");
  });

  it("interactive={false} keeps it static", () => {
    const { container } = render(<FlagWatermark src="/flag.png" interactive={false} />);
    expect(container.querySelector('[data-slot="flag-watermark"]')).toHaveAttribute(
      "data-interactive",
      "false"
    );
  });

  it("the CSS brightens to .25 and scales to 105% on hover, and drops the scale under Reduce Motion", () => {
    expect(identityCss).toContain("--watermark-opacity: 0.14;");
    expect(identityCss).toContain("--watermark-opacity: 0.18;");
    expect(identityCss).toMatch(
      /\.facet-flag-watermark\[data-interactive="true"\] \{\s*opacity: 0\.25;\s*scale: 1\.05;\s*@variant motion-reduce \{\s*scale: none;/
    );
  });
});
