"use client";

/**
 * Showcase of the production primitives from `src/components/ui`: per-app tints, surfaces and
 * layers, stats and grouped lists, controls and badges, text styles and system colours.
 * Nothing here is lab-only.
 */

import * as React from "react";
import {
  Bell,
  Cpu,
  Group as Users,
  Settings,
  Trash,
  Search,
  Spark,
  BoxIso as Package,
  Wallet,
  Trophy,
} from "iconoir-react";
import { FacetMaterial } from "~/components/ui/facet/shared/FacetMaterial";
import { cn } from "~/lib/utils/cn";
import {
  CutoutCard,
  CutoutCardHeader,
  CutoutCardStagger,
  CutoutCardStaggerItem,
} from "~/components/ui/cutout-card";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Stat } from "~/components/ui/stat";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Switch } from "~/components/ui/switch";
import { Progress } from "~/components/ui/progress";
import { EmptyState } from "~/components/ui/empty-state";
import { Eyebrow } from "~/components/ui/eyebrow";
import { SearchField } from "~/components/ui/search-field";
import { Card } from "~/components/ui/card";

const APP_TINTS = [
  { value: "admin", label: "Default" },
  { value: "mycountry", label: "MyCountry" },
  { value: "maps", label: "Maps" },
  { value: "thinkpages", label: "ThinkPages" },
  { value: "vault", label: "Vault" },
  { value: "forum", label: "Forum" },
  { value: "wiki", label: "Wiki" },
  { value: "intel", label: "Intel" },
  { value: "sports", label: "Sports" },
] as const;

type AppTint = (typeof APP_TINTS)[number]["value"];

const TEXT_STYLES = [
  ["text-large-title", "Large title: one per page"],
  ["text-title-1", "Title 1: sheets and dialogs"],
  ["text-title-2", "Title 2: card titles"],
  ["text-title-3", "Title 3: group titles, stat values"],
  ["text-headline", "Headline: row titles"],
  ["text-body", "Body: default text"],
  ["text-callout", "Callout: helper text"],
  ["text-subhead", "Subhead: list section headers"],
  ["text-footnote", "Footnote: metadata, timestamps"],
  ["text-caption", "Caption: chips, axis labels"],
] as const;

const SYSTEM_COLOURS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
] as const;

const SWATCH: Record<(typeof SYSTEM_COLOURS)[number], string> = {
  red: "bg-red",
  orange: "bg-orange",
  yellow: "bg-yellow",
  green: "bg-green",
  teal: "bg-teal",
  blue: "bg-blue",
  indigo: "bg-indigo",
  purple: "bg-purple",
  pink: "bg-pink",
};

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-title-3 text-label">{title}</h3>
      <p className="text-callout text-label-secondary">{description}</p>
    </div>
  );
}

type LayerSwatchProps = { className?: string; children?: React.ReactNode };

/** One swatch per layer, in stacking order. */
const LAYER_SWATCHES: {
  name: string;
  use: string;
  Swatch: React.ComponentType<LayerSwatchProps>;
}[] = [
  {
    name: "facet-canvas",
    use: "Page background",
    Swatch: ({ className, children }) => (
      <div className={cn("facet-canvas", className)}>{children}</div>
    ),
  },
  {
    name: "facet-pane",
    use: "Cards and content",
    Swatch: ({ className, children }) => (
      <div className={cn("facet-pane", className)}>{children}</div>
    ),
  },
  {
    name: "facet-well",
    use: "Insets inside a pane",
    Swatch: ({ className, children }) => (
      <div className={cn("facet-well", className)}>{children}</div>
    ),
  },
  {
    name: "facet-chrome",
    use: "Sidebar, tab bar, toolbars",
    Swatch: ({ className, children }) => (
      <FacetMaterial layer="chrome" className={className}>
        {children}
      </FacetMaterial>
    ),
  },
  {
    name: "facet-overlay",
    use: "Popovers, menus, sheets",
    Swatch: ({ className, children }) => (
      <FacetMaterial layer="overlay" className={className}>
        {children}
      </FacetMaterial>
    ),
  },
];

export function FacetShowcase() {
  const [tint, setTint] = React.useState<AppTint>("admin");
  const [period, setPeriod] = React.useState("week");
  const [filters, setFilters] = React.useState<string[]>(["active"]);
  const [notify, setNotify] = React.useState(true);

  return (
    // The tint scope: every primitive below inherits --tint from the nearest data-app.
    <div data-app={tint} className="space-y-8">
      <Card padding="md" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-title-3 text-label">App tint</h3>
            <p className="text-callout text-label-secondary">
              Each app root sets <code className="font-mono">data-app</code>; selection, links,
              toggles and focus follow its tint.
            </p>
          </div>
          <Button>Primary action</Button>
        </div>
        <SegmentedControl
          size="sm"
          aria-label="Preview app tint"
          value={tint}
          onValueChange={setTint}
          options={APP_TINTS.map((app) => ({ value: app.value, label: app.label }))}
        />
      </Card>

      <CardsAndChrome />

      <section>
        <SectionTitle
          title="Surfaces and layers"
          description="Five layers: canvas, pane, well, chrome and overlay. Only chrome and overlay blur; a well sits inside a pane."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padding="md" className="space-y-3">
            <Eyebrow>Card</Eyebrow>
            <p className="text-body text-label">
              Opaque <code className="font-mono">surface</code> with a hairline and{" "}
              <code className="font-mono">rounded-card</code>.
            </p>
            <div className="bg-surface-secondary rounded-row text-callout text-label-secondary p-3">
              Insets inside a card use <code className="font-mono">surface-secondary</code>.
            </div>
          </Card>

          {/* A busy backdrop so the glass has something to blur. */}
          <div className="bg-grouped rounded-card relative isolate overflow-hidden p-4">
            <div aria-hidden className="absolute inset-0 -z-10">
              <div className="bg-tint absolute -top-6 left-6 size-24 rounded-full opacity-60" />
              <div className="bg-pink absolute top-10 right-8 size-20 rounded-full opacity-50" />
              <div className="bg-teal absolute bottom-0 left-1/3 size-28 rounded-full opacity-50" />
            </div>
            <div className="grid gap-3">
              {LAYER_SWATCHES.map(({ name, use, Swatch }) => (
                <Swatch
                  key={name}
                  className="rounded-row flex items-center justify-between px-4 py-3"
                >
                  <span className="text-headline text-label">{name}</span>
                  <span className="text-footnote text-label-secondary">{use}</span>
                </Swatch>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle
          title="Data"
          description="Stat tiles pair a small label with a tabular value. Lists are inset grouped."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <Card padding="sm">
              <Stat
                size="sm"
                label="Countries"
                icon={<Users />}
                value="1,284"
                delta={{ value: "+12", direction: "up" }}
              />
            </Card>
            <Card padding="sm">
              <Stat
                size="sm"
                label="Failed jobs"
                icon={<Cpu />}
                value="3"
                delta={{ value: "+2", direction: "up", sentiment: "negative" }}
              />
            </Card>
            <Card padding="sm" className="col-span-2 space-y-2">
              <div className="text-footnote text-label-secondary flex justify-between tabular-nums">
                <span>Storage</span>
                <span>64%</span>
              </div>
              <Progress value={64} aria-label="Storage used" />
            </Card>
          </div>

          <FacetList>
            <FacetListSection
              header="Console"
              footer="Rows are 44px with separators inset to the text."
            >
              <FacetRow leading={<Settings />} title="General settings" accessory="chevron" />
              <FacetRow
                leading={<Bell />}
                title="Notifications"
                trailing={
                  <Switch checked={notify} onCheckedChange={setNotify} aria-label="Notify" />
                }
              />
              <FacetRow
                leading={<Package />}
                title="Card packs"
                subtitle="3 drafts"
                trailing={<Badge variant="warning">Review</Badge>}
              />
              <FacetRow leading={<Trash />} title="Purge cache" destructive onClick={() => {}} />
            </FacetListSection>
          </FacetList>
        </div>
      </section>

      <section>
        <SectionTitle
          title="Controls"
          description="Button styles, a segmented control for 2–5 peer choices, toggle groups for filters."
        />
        <Card padding="md" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default">Filled</Button>
            <Button variant="secondary">Tinted</Button>
            <Button variant="secondary">Gray</Button>
            <Button variant="outline">Bordered</Button>
            <Button variant="ghost">Plain</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              aria-label="Period"
              value={period}
              onValueChange={setPeriod}
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]}
            />
            <ToggleGroup
              type="multiple"
              size="sm"
              aria-label="Filters"
              value={filters}
              onValueChange={setFilters}
            >
              <ToggleGroupItem value="active">Active</ToggleGroupItem>
              <ToggleGroupItem value="archived">Archived</ToggleGroupItem>
              <ToggleGroupItem value="flagged">Flagged</ToggleGroupItem>
            </ToggleGroup>
            <SearchField
              size="sm"
              placeholder="Search"
              aria-label="Search"
              containerClassName="w-48"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Neutral</Badge>
            <Badge variant="secondary">Tinted</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="warning">Caution</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="info">Info</Badge>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle
          title="Type and colour"
          description="HIG text styles at desktop density (nothing below 12px) and the system colours for status and data."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padding="md" className="space-y-2">
            {TEXT_STYLES.map(([style, label]) => (
              <p key={style} className={`${style} text-label truncate`}>
                {label}
              </p>
            ))}
            <Eyebrow>Eyebrow: footnote label</Eyebrow>
          </Card>
          <Card padding="md" className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {SYSTEM_COLOURS.map((colour) => (
                <div key={colour} className="space-y-1">
                  <div className={`rounded-control h-8 ${SWATCH[colour]}`} />
                  <div className="text-caption text-label-secondary capitalize">{colour}</div>
                </div>
              ))}
            </div>
            <EmptyState
              compact
              icon={<Search />}
              title="No results"
              message="Empty states pair an icon, a title and one action."
              action={
                <Button variant="secondary" size="sm">
                  <Spark />
                  Clear filters
                </Button>
              }
            />
          </Card>
        </div>
      </section>
    </div>
  );
}

/** CutoutCard, chrome and the achievement aurora, on a busy backdrop so the glass has something to blur. */
function CardsAndChrome() {
  return (
    <section>
      <SectionTitle
        title="Cards and chrome"
        description="CutoutCard, the Halo pill and the achievement aurora."
      />
      <div className="bg-grouped rounded-card relative isolate overflow-hidden p-4 md:p-6">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="bg-tint absolute -top-10 left-10 size-40 rounded-full opacity-40 blur-2xl" />
          <div className="bg-pink absolute top-24 right-16 size-32 rounded-full opacity-30 blur-2xl" />
          <div className="bg-teal absolute bottom-0 left-1/3 size-48 rounded-full opacity-30 blur-2xl" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* CutoutCard: the header title is a real h3. */}
          <CutoutCard variant="card" onClick={() => {}} aria-label="Open the Vault">
            <CutoutCardHeader
              as="h3"
              icon={<Wallet />}
              trailing={<Badge variant="secondary">12</Badge>}
            >
              Vault
            </CutoutCardHeader>
            <CutoutCardStagger className="space-y-1 pt-2">
              <CutoutCardStaggerItem>
                <p className="text-title-3 text-label">Pack drop</p>
              </CutoutCardStaggerItem>
              <CutoutCardStaggerItem>
                <p className="text-callout text-label-secondary">
                  CutoutCard: 28px, inverted-corner header, lift and press, blur-in stagger.
                </p>
              </CutoutCardStaggerItem>
            </CutoutCardStagger>
          </CutoutCard>

          {/* Chrome (Halo) */}
          <FacetMaterial
            layer="chrome"
            className="flex items-center justify-between rounded-full px-5 py-3"
          >
            <span className="text-headline text-label">facet-chrome</span>
            <Badge variant="secondary">3</Badge>
          </FacetMaterial>

          {/* Achievement aurora / radiance / foil / ghost heraldry */}
          <Card
            padding="md"
            className="group isolate overflow-hidden"
            style={{ "--facet-accent-2": "var(--color-yellow)" } as React.CSSProperties}
          >
            <div
              aria-hidden
              data-interactive="true"
              className="facet-aurora absolute -inset-px -z-10 rounded-[inherit]"
            />
            <div
              aria-hidden
              data-interactive="true"
              className="facet-radiance absolute inset-0 -z-10"
            />
            <div aria-hidden className="facet-foil absolute -inset-px -z-10 rounded-[inherit]" />
            <div className="relative flex items-center gap-3">
              <Trophy className="text-green size-6" aria-hidden />
              <div>
                <h3 className="text-title-3 text-label">Economic titan</h3>
                <p className="text-footnote text-label-secondary">Aurora, radiance and foil</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
