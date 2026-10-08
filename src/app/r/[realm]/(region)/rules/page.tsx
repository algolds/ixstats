"use client";

import { use } from "react";
import Link from "next/link";
import { EditPencil } from "iconoir-react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { buttonVariants } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";

/**
 * The realm's rules, written by its founder or an appearance officer in Manage. Players confirm reading them
 * before they claim a nation here.
 */
export default function RealmRulesPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = use(params);
  const { data: overview } = api.realms.region.overview.useQuery({ slug });
  usePageTitle({ title: overview ? `${overview.realm.name} · Rules` : "Rules" });
  if (!overview) return null;

  const { realm, rules, viewer } = overview;
  const canEdit = viewer.powers.includes("appearance");
  const editHref = `/r/${encodeURIComponent(realm.slug)}/manage#rules`;

  if (!rules)
    return (
      <EmptyState
        title="No rules yet"
        message={
          canEdit
            ? "Write the realm's rules in Manage. Players will confirm reading them before they claim a nation."
            : "This realm has not published any rules."
        }
        action={
          canEdit ? (
            <Link href={editHref} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Write the rules
            </Link>
          ) : undefined
        }
      />
    );

  return (
    <section className="border-separator bg-surface rounded-card border p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-label text-headline">Rules</h2>
          {rules.updatedAt && (
            <p className="text-label-secondary text-footnote">
              Last updated {new Date(rules.updatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        {canEdit && (
          <Link href={editHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <EditPencil aria-hidden="true" />
            Edit
          </Link>
        )}
      </div>
      <div
        className="text-label text-body [&_a]:text-tint [&_h2]:text-title-3 [&_h3]:text-headline [&_h4]:text-headline space-y-3 leading-relaxed [&_a]:underline [&_h2]:mt-4 [&_h3]:mt-3 [&_h4]:mt-4 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
        // Rendered from wikitext and sanitized on save (updateRealmRules).
        dangerouslySetInnerHTML={{ __html: rules.html }}
      />
    </section>
  );
}
