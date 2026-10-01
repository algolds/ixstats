// src/components/wiki-os/reader/MissingPage.tsx
// What a page that does not exist shows, as MediaWiki words it: the title as the heading, "There is
// currently no text in this page", a link to create it (only for a reader who may), and a link to search
// for the title. No hooks and no client-only state: the 404's first HTML carries all of it.

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { withBasePath } from "~/lib/base-path";

export interface MissingPageProps {
  /** The title as the heading shows it. */
  title: string;
  /** `?action=edit&redlink=1` of the page, or null when the viewer may not create it. */
  createHref: string | null;
  /** The search for the title. */
  searchHref: string;
}

export function MissingPage({ title, createHref, searchHref }: MissingPageProps) {
  return (
    <section aria-labelledby="wikios-missing-title">
      <h1 id="wikios-missing-title" className="wikios-article-title">
        {title}
      </h1>
      <div className="wikios-error facet-hierarchy-child rounded-lg p-6">
        <p className="text-foreground text-sm">There is currently no text in this page.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          You can search for this title in other pages
          {createHref ? ", or create the page yourself." : "."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {createHref && (
            <Button asChild size="sm">
              <Link href={withBasePath(createHref)}>Create this page</Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href={withBasePath(searchHref)}>Search for this title</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
