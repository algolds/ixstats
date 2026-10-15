"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { City, Community, Language, WhiteFlag } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import {
  IDENTITY_FIELDS,
  STALE_EDITOR_MESSAGE,
  type IdentitySectionId,
} from "~/lib/mycountry/editor-fields";
import type { EditorAnchor } from "~/lib/mycountry/routes";
import { EditorProvider } from "./editor-context";
import { ElsewhereSection } from "./ElsewhereSection";
import { GovernmentFormSection } from "./GovernmentFormSection";
import { IdentitySection } from "./IdentitySection";
import { InstitutionsSection } from "./InstitutionsSection";
import { LeaveGuard } from "./LeaveGuard";
import { NameSection } from "./NameSection";
import { SizeSection } from "./SizeSection";

export type EditorState = RouterOutputs["countries"]["getEditorState"];

/** The page column: the shell's content width, padded like the other MyCountry pages. */
export const EDITOR_COLUMN = "mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 md:px-8";

interface EditorGroup {
  id: EditorAnchor;
  label: string;
  sections: Array<{ id: EditorAnchor; label: string; node: React.ReactNode }>;
}

/**
 * Remounts a section when its saved values change (after its own save, or a reload), so it starts
 * over from what the server holds. Other sections keep their unsaved edits.
 */
const keyOf = (value: unknown) => JSON.stringify(value);

/** One list drives the nav and the page. */
export function editorGroups(state: EditorState, reload: number): EditorGroup[] {
  const identity = state.nationalIdentity;
  const government = state.governmentStructure;
  const governmentForm = {
    governmentType: government?.governmentType ?? state.governmentType ?? null,
    headOfState: government?.headOfState ?? null,
    headOfGovernment: government?.headOfGovernment ?? null,
    legislatureName: government?.legislatureName ?? null,
    executiveName: government?.executiveName ?? null,
    judicialName: government?.judicialName ?? null,
  };
  const images = { flag: state.flag, coatOfArms: state.coatOfArms };
  const k = (value: unknown) => `${reload}:${keyOf(value)}`;
  // Each identity section re-keys on its own fields only, so saving one keeps the others' edits.
  const fieldsOf = (section: IdentitySectionId) =>
    IDENTITY_FIELDS[section].map((f) => identity?.[f.key] ?? null);

  return [
    {
      id: "identity",
      label: "Identity",
      sections: [
        {
          id: "name",
          label: "Name",
          node: <NameSection key={k(state.name)} name={state.name} />,
        },
        {
          id: "symbols",
          label: "Flag and symbols",
          node: (
            <IdentitySection
              key={k([images, fieldsOf("symbols")])}
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
              key={k(fieldsOf("language"))}
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
              key={k(fieldsOf("culture"))}
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
              key={k(fieldsOf("civic"))}
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
          node: <GovernmentFormSection key={k(governmentForm)} government={governmentForm} />,
        },
        {
          id: "institutions",
          label: "Institutions",
          node: (
            <InstitutionsSection
              key={k(state.governmentComponents)}
              components={state.governmentComponents}
              storedEffectiveness={government?.governmentEffectiveness ?? null}
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
              key={k([state.currentPopulation, state.currentGdpPerCapita])}
              population={state.currentPopulation}
              gdpPerCapita={state.currentGdpPerCapita}
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

/**
 * The country editor for one nation: identity, government and size, each section saved on its
 * own. Mounted per nation (keyed by its id), so switching nation starts a fresh editor.
 */
export function CountryEditor({ countryId }: { countryId: string }) {
  const query = api.countries.getEditorState.useQuery(
    { countryId },
    // A refetch re-keys sections whose saved values moved; only saves and Reload should.
    { retry: false, refetchOnWindowFocus: false }
  );
  const state = query.data;
  // The version saves are checked against: the one loaded first, then each reload's.
  const [version, setVersion] = useState<Date | null>(null);
  const [reload, setReload] = useState(0);
  const [stale, setStale] = useState(false);
  const markStale = useCallback(() => setStale(true), []);

  usePageTitle({ title: state ? `${state.name} · Editor` : "Country editor" });

  useEffect(() => {
    if (state && version === null) setVersion(state.updatedAt);
  }, [state, version]);

  const loaded = !!state && version !== null;
  useEffect(() => {
    if (loaded && window.location.hash) {
      document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
    }
  }, [loaded]);

  if (query.isError) {
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
  if (!state || version === null) return <EditorSkeleton />;

  const groups = editorGroups(state, reload);

  const reloadAll = async () => {
    const fresh = await query.refetch();
    if (fresh.data) setVersion(fresh.data.updatedAt);
    setStale(false);
    setReload((n) => n + 1);
  };

  return (
    <EditorProvider countryId={countryId} version={version} stale={stale} onStale={markStale}>
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

        {stale && (
          <Signal tone="destructive" title={STALE_EDITOR_MESSAGE}>
            <p>
              Another tab or a game update saved it after this page loaded. Reload to see the
              latest; changes you have not saved here are discarded.
            </p>
            <Button className="mt-3" variant="secondary" onClick={() => void reloadAll()}>
              Reload
            </Button>
          </Signal>
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
      <LeaveGuard />
    </EditorProvider>
  );
}
