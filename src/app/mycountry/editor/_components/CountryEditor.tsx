"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { City, Community, Language, WhiteFlag } from "iconoir-react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { BuilderHalo } from "~/components/halo/plugins/builder";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import {
  EDITOR_SECTION_TITLES,
  staleMessage,
  type EditorSectionId,
} from "~/lib/mycountry/editor-fields";
import type { EditorAnchor } from "~/lib/mycountry/routes";
import { EditorProvider, type EditorState } from "./editor-context";
import { governmentFormOf, identityValuesOf, withSection } from "./editor-state";
import { ElsewhereSection } from "./ElsewhereSection";
import { GovernmentFormSection } from "./GovernmentFormSection";
import { IdentitySection } from "./IdentitySection";
import { InstitutionsSection } from "./InstitutionsSection";
import { LeaveGuard } from "./LeaveGuard";
import { NameSection } from "./NameSection";
import { SizeSection } from "./SizeSection";

export type { EditorState };

/** The page column: the shell's content width, padded like the other MyCountry pages. */
export const EDITOR_COLUMN = "mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 md:px-8";

interface EditorGroup {
  id: EditorAnchor;
  label: string;
  sections: Array<{ id: EditorAnchor; label: string; node: React.ReactNode }>;
}

/** How many times each section was reloaded after a conflict; part of its key. */
export type SectionReloads = Partial<Record<EditorSectionId, number>>;

/** One list drives the nav and the page. */
export function editorGroups(state: EditorState, reloads: SectionReloads = {}): EditorGroup[] {
  const identity = state.nationalIdentity;
  const governmentForm = governmentFormOf(state);
  const images = { flag: state.flag, coatOfArms: state.coatOfArms };
  // A section remounts (starting over from its saved values) when its own values change, after
  // its save or a reload. Keys never read another section's values, so that one keeps its edits.
  const k = (section: EditorSectionId, value: unknown) =>
    `${reloads[section] ?? 0}:${JSON.stringify(value)}`;
  const fieldsOf = (section: "language" | "culture" | "civic" | "symbols") =>
    identityValuesOf(state, section);

  return [
    {
      id: "identity",
      label: "Identity",
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
      id: "government",
      label: "Government",
      sections: [
        {
          id: "form",
          label: "Form and institutions",
          node: (
            <GovernmentFormSection key={k("form", governmentForm)} government={governmentForm} />
          ),
        },
        {
          id: "institutions",
          label: "Institutions",
          node: (
            <InstitutionsSection
              key={k("institutions", state.governmentComponents)}
              components={state.governmentComponents}
              storedEffectiveness={state.governmentStructure?.governmentEffectiveness ?? null}
            />
          ),
        },
      ],
    },
    {
      id: "size",
      label: "Size",
      sections: [
        {
          id: "population",
          label: "Population and wealth",
          node: (
            <SizeSection
              // The stat progression moves the current figures; only a new baseline re-keys.
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
      ],
    },
    {
      id: "elsewhere",
      label: "Managed elsewhere",
      sections: [
        { id: "consoles", label: "Consoles", node: <ElsewhereSection slug={state.slug} /> },
      ],
    },
  ];
}

/** Scrolls to a section and keeps the address on it without adding a history entry. */
function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: "start" });
  window.history.replaceState(window.history.state, "", `#${id}`);
}

function EditorNav({ groups }: { groups: EditorGroup[] }) {
  return (
    <nav
      aria-label="Editor sections"
      // One scrolling row on small screens; the grouped column from lg up.
      className="flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:gap-4 lg:self-start lg:overflow-visible"
    >
      {groups.map((group) => (
        <div
          key={group.id}
          role="group"
          aria-labelledby={`editor-nav-${group.id}`}
          className="shrink-0"
        >
          <p
            id={`editor-nav-${group.id}`}
            className="text-footnote text-label hidden px-3 pb-1 font-semibold lg:block"
          >
            {group.label}
          </p>
          <ul className="flex gap-1 lg:flex-col">
            {group.sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    jumpTo(s.id);
                  }}
                  className="rounded-control text-footnote text-label-secondary hover:bg-fill-4 hover:text-label flex min-h-11 items-center px-3 whitespace-nowrap lg:min-h-0 lg:py-1"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function EditorSkeleton() {
  return (
    <div className={EDITOR_COLUMN} aria-busy="true" aria-label="Loading the editor">
      <div className="flex items-center gap-3 pt-14 pb-2">
        <Skeleton className="rounded-control h-10 w-16" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <Skeleton className="rounded-card hidden h-80 lg:block" />
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
 * The country editor for one nation: identity, government and size, each section saved on its
 * own. Mounted per nation (keyed by its id), so switching nation starts a fresh editor.
 */
export function CountryEditor({ countryId }: { countryId: string }) {
  const query = api.countries.getEditorState.useQuery(
    { countryId },
    // The page keeps its own copy (below); a refetch only matters for Reload.
    { retry: false, refetchOnWindowFocus: false }
  );
  // The page's copy of the nation: loaded once, then moved on by each section's save and by
  // Reload, one section at a time.
  const [state, setState] = useState<EditorState | null>(null);
  const [reloads, setReloads] = useState<SectionReloads>({});
  const [conflicts, setConflicts] = useState<EditorSectionId[]>([]);

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
    if (loaded && window.location.hash) {
      document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
    }
  }, [loaded]);

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

  const groups = editorGroups(state, reloads);

  // Takes the latest values for the sections in conflict only, and remounts just those.
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
          leading={
            <UnifiedCountryFlag
              countryName={state.name}
              flagUrl={normalizeFlagUrl(state.flag)}
              size="xl"
              showTooltip={false}
              border
            />
          }
          subtitle="Identity, government and size. Each section saves on its own."
        />

        {conflicts.length > 0 && (
          <ConflictSignal conflicts={conflicts} onReload={() => void reloadConflicts()} />
        )}

        <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <EditorNav groups={groups} />
          <div className="flex min-w-0 flex-col gap-6">
            {groups.map((group) => (
              <div
                key={group.id}
                id={group.id}
                role="group"
                aria-label={group.label}
                className="flex scroll-mt-24 flex-col gap-6"
              >
                {group.sections.map((s) => (
                  <Fragment key={s.id}>{s.node}</Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <BuilderHalo
        label={state.name}
        sections={groups.flatMap((group) =>
          group.sections.map((s) => ({ id: s.id, label: s.label }))
        )}
        onJump={jumpTo}
      />
      <LeaveGuard />
    </EditorProvider>
  );
}
