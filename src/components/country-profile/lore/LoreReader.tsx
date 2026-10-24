"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { OpenBook } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { useProfileShell } from "~/app/countries/[slug]/_components/ProfileShellContext";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { useDossier } from "~/hooks/useDossier";
import { parseWikiContent } from "~/lib/builder";
import { cn } from "~/lib/utils/cn";
import { wikiReaderPath } from "~/lib/wiki-os/config";
import { pageEditHref } from "~/lib/wiki-os/page-tools";
import { LoreProse, READING_STYLE } from "../LoreProse";
import { useScrollSpy } from "../useScrollSpy";

const PROLOGUE_ID = "lore-prologue";
const chapterId = (id: string) => `lore-${id}`;
/** Sections stop below the shell's floating chrome when jumped to. */
const SCROLL_MARGIN = "scroll-mt-[calc(var(--shell-top-offset,5rem)+1rem)]";

function LoreLoading() {
  return (
    <div className="max-w-[38rem] space-y-3" role="status" aria-label="Loading lore">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className={i === 4 ? "h-4 w-1/2" : "h-4 w-full"} />
      ))}
    </div>
  );
}

/**
 * LoreReader — the Lore tab: the country's wiki article as one reading column (the prologue as a
 * lead, then every chapter in article order, in the wiki Reading face) beside a chapter index
 * that follows the section being read (wide screens). Native lore joins as its own chapters when
 * it becomes shared content (a separate project).
 */
export function LoreReader({ layer }: { layer: CountryProfileLayer }) {
  const router = useRouter();
  const { country } = useProfileShell();
  const { wikiData, isLoading, hasAccess } = useDossier({
    countryName: country.name,
    wikiSource: country.wikiSource,
    wikiPageTitle: country.wikiPageTitle,
    countryData: {
      currentPopulation: country.currentPopulation,
      currentGdpPerCapita: country.currentGdpPerCapita,
      currentTotalGdp: country.currentTotalGdp,
      economicTier: country.economicTier,
      continent: country.continent ?? undefined,
      governmentType: country.governmentType ?? undefined,
    },
  });
  const chapters = wikiData.sections.filter(
    (s) => s.id !== "overview" && hasAccess(s.classification)
  );
  const prologue = layer.lore.prologue;
  const ids = [
    ...(prologue.length > 0 ? [PROLOGUE_ID] : []),
    ...chapters.map((c) => chapterId(c.id)),
  ];
  const active = useScrollSpy(ids);

  if (isLoading || layer.lore.isLoading) return <LoreLoading />;

  if (prologue.length === 0 && chapters.length === 0 && wikiData.error) {
    return (
      <EmptyState
        icon={<OpenBook />}
        title="The wiki could not be loaded"
        message="The wiki did not answer. Try again in a moment."
      />
    );
  }

  if (prologue.length === 0 && chapters.length === 0) {
    return (
      <EmptyState
        icon={<OpenBook />}
        title="No wiki article yet"
        message={`${layer.identity.name}'s story has not been written on the wiki.`}
        action={
          <Button asChild size="sm">
            <Link href={pageEditHref(country.name)}>Create page on WikiOS</Link>
          </Button>
        }
      />
    );
  }

  const source = wikiData.wikiSource ?? "ixwiki";
  const openLink = (page: string) => router.push(wikiReaderPath(page, source));
  const index = [
    ...(prologue.length > 0 ? [{ id: PROLOGUE_ID, title: "Prologue" }] : []),
    ...chapters.map((c) => ({ id: chapterId(c.id), title: c.title })),
  ];

  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 space-y-10">
        {prologue.length > 0 && (
          <section id={PROLOGUE_ID} aria-label="Prologue" className={SCROLL_MARGIN}>
            <LoreProse paragraphs={prologue} />
          </section>
        )}
        {chapters.map((c) => (
          <section
            key={c.id}
            id={chapterId(c.id)}
            aria-labelledby={`${chapterId(c.id)}-title`}
            className={cn("space-y-4", SCROLL_MARGIN)}
          >
            <h2 id={`${chapterId(c.id)}-title`} className="text-title-2 text-label">
              {c.title}
            </h2>
            <div className={cn("max-w-[38rem] space-y-4 whitespace-pre-line", READING_STYLE)}>
              {parseWikiContent(c.content, openLink)}
            </div>
          </section>
        ))}
        {wikiData.error && chapters.length === 0 && (
          <p className="text-footnote text-label-secondary">
            The wiki chapters could not be loaded.
          </p>
        )}
      </article>
      {index.length > 1 && (
        <nav aria-label="Chapters" className="hidden w-52 shrink-0 lg:block">
          <ol className="sticky top-[calc(var(--shell-top-offset,5rem)+1rem)] flex flex-col gap-0.5">
            {index.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={active === item.id ? "location" : undefined}
                  className={cn(
                    "text-footnote rounded-control-sm focus-visible:outline-tint block px-3 py-1.5 focus-visible:outline-2",
                    active === item.id
                      ? "bg-tint-fill text-tint font-semibold"
                      : "text-label-secondary hover:bg-fill-4 hover:text-label"
                  )}
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  );
}
