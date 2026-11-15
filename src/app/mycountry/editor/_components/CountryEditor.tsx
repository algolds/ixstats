"use client";

import { Fragment, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { City, Community, Language, NavArrowLeft, WhiteFlag } from "iconoir-react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { FlagBanner, MonogramBanner } from "~/components/mycountry/shell/headers/FlagBanner";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { BuilderHalo } from "~/components/halo/plugins/builder";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { cn } from "~/lib/utils/cn";
import {
  EDITOR_SECTION_TITLES,
  staleMessage,
  type EditorSectionId,
} from "~/lib/mycountry/editor-fields";
import {
  MYCOUNTRY_PATH,
  resolveEditorPane,
  type EditorAnchor,
  type EditorPane,
} from "~/lib/mycountry/routes";
import { EditorProvider, type EditorState } from "./editor-context";
import { governmentFormOf, identityValuesOf, withSection } from "./editor-state";
import { ALL_STUDIO_PANES, EditorSidebar } from "./EditorSidebar";
import { BudgetSection } from "./BudgetSection";
import { FiguresSection } from "./FiguresSection";
import { CabinetSection, LegislatureSection, PartiesSection } from "./GovernanceSections";
import { GovernmentFormSection } from "./GovernmentFormSection";
import { IdentitySection } from "./IdentitySection";
import { InstitutionsSection } from "./InstitutionsSection";
import { LeaveGuard } from "./LeaveGuard";
import { NameSection } from "./NameSection";
import { SizeSection } from "./SizeSection";
import { TariffsSection } from "./TariffsSection";
import { TaxesSection } from "./TaxesSection";

export type { EditorState };

/** The page column: the shell's content width, padded like the other MyCountry pages. */
export const EDITOR_COLUMN = "mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 md:px-8";

interface StudioPaneContent {
  id: EditorPane;
  label: string;
  sections: Array<{ id: EditorAnchor; label: string; node: React.ReactNode }>;
}

/** How many times each section was reloaded after a conflict; part of its key. */
export type SectionReloads = Partial<Record<EditorSectionId, number>>;

/** Builds the 6 Facet Studio panes for one nation. */
export function editorPanes(state: EditorState, reloads: SectionReloads = {}): StudioPaneContent[] {
  const identity = state.nationalIdentity;
  const governmentForm = governmentFormOf(state);
  const images = { flag: state.flag, coatOfArms: state.coatOfArms };
  const k = (section: EditorSectionId, value: unknown) =>
    `${reloads[section] ?? 0}:${JSON.stringify(value)}`;
  const fieldsOf = (section: "language" | "culture" | "civic" | "symbols") =>
    identityValuesOf(state, section);

  return [
    {
      id: "identity",
      label: "Identity and symbols",
      sections: [
        {
          id: "name",
          label: "Name",
          node: <NameSection key={k("name", state.name)} name={state.name} />,
        },
        {
          id: "symbols",
          label: "Flag and symbols",
          node: (
            <IdentitySection
              key={k("symbols", [images, fieldsOf("symbols")])}
              sectionId="symbols"
              title="Flag and symbols"
              description="The images and emblems your nation is known by."
              icon={<WhiteFlag />}
              saveLabel="Save flag and symbols"
              identity={identity}
              images={images}
            />
          ),
        },
        {
          id: "language",
          label: "Capital and language",
          node: (
            <IdentitySection
              key={k("language", fieldsOf("language"))}
              sectionId="language"
              title="Capital and language"
              description="Where your government sits and what your people speak and pay with."
              icon={<Language />}
              saveLabel="Save capital and language"
              identity={identity}
              mapCapital={identity?.capitalCityRef?.name ?? null}
            />
          ),
        },
        {
          id: "culture",
          label: "Culture",
          node: (
            <IdentitySection
              key={k("culture", fieldsOf("culture"))}
              sectionId="culture"
              title="Culture"
              description="Your people, their faith and their traditions."
              icon={<Community />}
              saveLabel="Save culture"
              identity={identity}
            />
          ),
        },
        {
          id: "civic",
          label: "Civic standards",
          node: (
            <IdentitySection
              key={k("civic", fieldsOf("civic"))}
              sectionId="civic"
              title="Civic standards"
              description="Codes and conventions other nations use to reach yours."
              icon={<City />}
              saveLabel="Save civic standards"
              identity={identity}
            />
          ),
        },
      ],
    },
    {
      id: "constitution",
      label: "Constitution and legislature",
      sections: [
        {
          id: "form",
          label: "Form and institutions",
          node: (
            <GovernmentFormSection key={k("form", governmentForm)} government={governmentForm} />
          ),
        },
        {
          id: "legislature",
          label: "Legislature setup",
          node: <LegislatureSection key={reloads.legislature ?? 0} />,
        },
        {
          id: "institutions",
          label: "Institutions",
          node: (
            <InstitutionsSection
              key={k("institutions", state.governmentComponents)}
              components={state.governmentComponents}
              storedEffectiveness={state.governmentStructure?.governmentEffectiveness ?? null}
              effectiveness={state.effectiveness}
            />
          ),
        },
      ],
    },
    {
      id: "cabinet",
      label: "Cabinet and parties",
      sections: [
        {
          id: "cabinet",
          label: "Cabinet",
          node: <CabinetSection key={reloads.cabinet ?? 0} />,
        },
        {
          id: "parties",
          label: "Political parties",
          node: <PartiesSection key={reloads.parties ?? 0} />,
        },
      ],
    },
    {
      id: "scale",
      label: "Population and baselines",
      sections: [
        {
          id: "population",
          label: "Population and wealth",
          node: (
            <SizeSection
              key={k("population", [state.baselinePopulation, state.baselineGdpPerCapita])}
              population={state.currentPopulation}
              gdpPerCapita={state.currentGdpPerCapita}
              baseline={{
                baselinePopulation: state.baselinePopulation,
                baselineGdpPerCapita: state.baselineGdpPerCapita,
              }}
            />
          ),
        },
        {
          id: "figures",
          label: "Economic figures",
          node: (
            <FiguresSection
              key={k("figures", [
                state.inflationRate,
                state.unemploymentRate,
                state.totalDebtGDPRatio,
              ])}
              stored={{
                inflationRate: state.inflationRate,
                unemploymentRate: state.unemploymentRate,
                totalDebtGDPRatio: state.totalDebtGDPRatio,
              }}
              estimates={state.figureEstimates}
            />
          ),
        },
      ],
    },
    {
      id: "taxes",
      label: "Taxes and tariffs",
      sections: [
        {
          id: "taxes",
          label: "National tax rates",
          node: <TaxesSection key={reloads.taxes ?? 0} state={state} />,
        },
        {
          id: "tariffs",
          label: "Sector tariffs",
          node: <TariffsSection key={reloads.tariffs ?? 0} state={state} />,
        },
      ],
    },
    {
      id: "budget",
      label: "Departments and budget",
      sections: [
        {
          id: "budget",
          label: "Departments and budget",
          node: <BudgetSection key={reloads.budget ?? 0} state={state} />,
        },
      ],
    },
  ];
}

const hashWatchers = new Set<() => void>();

function watchHash(notify: () => void) {
  hashWatchers.add(notify);
  window.addEventListener("hashchange", notify);
  return () => {
    hashWatchers.delete(notify);
    window.removeEventListener("hashchange", notify);
  };
}

function readHashId(): string {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "";
  }
}

/** Updates the URL hash and notifies subscribers without pushing a new browser history entry. */
function setLocationHash(id: string) {
  window.history.replaceState(window.history.state, "", `#${id}`);
  hashWatchers.forEach((notify) => notify());
}

export function EditorSkeleton() {
  return (
    <div className={EDITOR_COLUMN} aria-busy="true" aria-label="Loading the editor">
      <div className="flex items-center gap-3 pt-14 pb-2">
        <Skeleton className="rounded-control h-10 w-16" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Skeleton className="rounded-card hidden h-96 lg:block" />
        <div className="flex flex-col gap-6">
          <Skeleton className="rounded-card h-48" />
          <Skeleton className="rounded-card h-96" />
        </div>
      </div>
    </div>
  );
}

function ConflictSignal({
  conflicts,
  onReload,
}: {
  conflicts: EditorSectionId[];
  onReload: () => void;
}) {
  const names = conflicts.map((id) => EDITOR_SECTION_TITLES[id]);
  return (
    <Signal
      tone="destructive"
      title={
        conflicts.length === 1
          ? staleMessage(conflicts[0]!)
          : `${names.join(", ")} changed since you opened them`
      }
    >
      <p>
        Another tab saved {conflicts.length === 1 ? "it" : "them"} after this page loaded. Reload to
        see the latest; your unsaved changes there are discarded, and every other section keeps its
        own.
      </p>
      <Button className="mt-3" variant="secondary" onClick={onReload}>
        {conflicts.length === 1 ? `Reload ${names[0]!.toLowerCase()}` : "Reload these sections"}
      </Button>
    </Signal>
  );
}

/**
 * Country Editor Facet Studio: two-column Apple System Settings workspace for nation identity,
 * constitution, cabinet, population baselines, tax rates, sector tariffs and department budgets.
 */
export function CountryEditor({ countryId }: { countryId: string }) {
  const query = api.countries.getEditorState.useQuery(
    { countryId },
    { retry: false, refetchOnWindowFocus: false }
  );
  const [state, setState] = useState<EditorState | null>(null);
  const [reloads, setReloads] = useState<SectionReloads>({});
  const [conflicts, setConflicts] = useState<EditorSectionId[]>([]);

  const activeHash = useSyncExternalStore(watchHash, readHashId, () => "");
  const activePane = resolveEditorPane(activeHash);

  const [visitedPanes, setVisitedPanes] = useState<ReadonlySet<EditorPane>>(
    () => new Set([activePane])
  );
  if (!visitedPanes.has(activePane)) {
    setVisitedPanes((prev) => new Set([...prev, activePane]));
  }

  const [mobileDrilledIn, setMobileDrilledIn] = useState(() => Boolean(activeHash));
  const [prevHash, setPrevHash] = useState(activeHash);
  if (activeHash !== prevHash) {
    setPrevHash(activeHash);
    if (activeHash) setMobileDrilledIn(true);
  }

  useEffect(() => {
    if (query.data && !state) setState(query.data);
  }, [query.data, state]);

  const markConflict = useCallback(
    (section: EditorSectionId) =>
      setConflicts((current) => (current.includes(section) ? current : [...current, section])),
    []
  );
  const applySaved = useCallback(
    (update: (current: EditorState) => EditorState) =>
      setState((current) => (current ? update(current) : current)),
    []
  );

  usePageTitle({ title: state ? `${state.name} · Editor` : "Country editor" });

  const loaded = !!state;
  useEffect(() => {
    if (!loaded || !activeHash) return;
    document.getElementById(activeHash)?.scrollIntoView({ block: "start" });
  }, [loaded, activeHash]);

  const selectPane = useCallback((pane: EditorPane) => {
    setMobileDrilledIn(true);
    setLocationHash(pane);
    window.scrollTo?.({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const jumpTo = useCallback((id: string) => {
    setMobileDrilledIn(true);
    setLocationHash(id);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    });
  }, []);

  if (query.isError && !state) {
    return (
      <div className={`${EDITOR_COLUMN} pt-14`}>
        <h1 className="sr-only">Country editor</h1>
        <EmptyState
          title="Couldn't load your nation."
          message={query.error.message}
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }
  if (!state) return <EditorSkeleton />;

  const panes = editorPanes(state, reloads);
  const flagUrl = normalizeFlagUrl(state.flag);

  const reloadConflicts = async () => {
    const fresh = (await query.refetch()).data;
    if (!fresh) return;
    const reloaded = conflicts;
    setState((current) =>
      current ? reloaded.reduce((acc, id) => withSection(id, acc, fresh), current) : current
    );
    setReloads((current) => {
      const next = { ...current };
      for (const id of reloaded) next[id] = (next[id] ?? 0) + 1;
      return next;
    });
    setConflicts((current) => current.filter((id) => !reloaded.includes(id)));
  };

  return (
    <EditorProvider
      countryId={countryId}
      conflicts={conflicts}
      onConflict={markConflict}
      onSaved={applySaved}
    >
      <div className={EDITOR_COLUMN}>
        <PageHeader
          title={state.name}
          back={{ href: MYCOUNTRY_PATH, label: "MyCountry" }}
          bleed
          className="group/hero"
          backdrop={flagUrl ? <FlagBanner src={flagUrl} /> : <MonogramBanner />}
          leading={
            <UnifiedCountryFlag
              countryName={state.name}
              flagUrl={flagUrl}
              size="xl"
              showTooltip={false}
              border
            />
          }
          subtitle="Identity, constitution, cabinet, taxes and budget. Each section saves on its own."
        />

        {conflicts.length > 0 && (
          <ConflictSignal conflicts={conflicts} onReload={() => void reloadConflicts()} />
        )}

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <EditorSidebar
            activePane={activePane}
            slug={state.slug}
            onSelectPane={selectPane}
            className={cn(mobileDrilledIn && "max-lg:hidden")}
          />

          <div className={cn("flex min-w-0 flex-col gap-6", !mobileDrilledIn && "max-lg:hidden")}>
            {mobileDrilledIn && (
              <div className="flex items-center lg:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileDrilledIn(false)}
                  className="-ml-2 gap-1"
                >
                  <NavArrowLeft aria-hidden />
                  All sections
                </Button>
              </div>
            )}

            {panes.map((pane) => {
              if (!visitedPanes.has(pane.id)) return null;
              const isActive = pane.id === activePane;
              return (
                <div
                  key={pane.id}
                  id={pane.id}
                  role="region"
                  aria-label={pane.label}
                  hidden={!isActive}
                  className={cn("flex scroll-mt-24 flex-col gap-6", !isActive && "hidden")}
                >
                  {pane.sections.map((s) => (
                    <Fragment key={s.id}>{s.node}</Fragment>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <BuilderHalo
        label={state.name}
        sections={ALL_STUDIO_PANES.map((pane) => ({ id: pane.id, label: pane.title }))}
        currentId={activePane}
        onJump={jumpTo}
      />
      <LeaveGuard />
    </EditorProvider>
  );
}
