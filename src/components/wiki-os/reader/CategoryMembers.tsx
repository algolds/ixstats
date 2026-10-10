// MediaWiki's category page body: the members of a category in sort-key order, split into
// subcategories, pages and files, 200 to a page, with a link to the next page (`?from=`). Plain
// markup, rendered on the server so crawlers follow every member link.

import Link from "next/link";
import type { CategoryCursor, CategoryMember } from "~/lib/wiki-os/core/category-service";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

const SUBCATEGORY_NAMESPACE = 14;
const FILE_NAMESPACE = 6;

function href(title: string): string {
  const canon = canonicalizeTitle(title);
  return `/wiki/${canon?.urlPath ?? encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function MemberList({
  heading,
  members,
  label,
}: {
  heading: string;
  members: CategoryMember[];
  label: (title: string) => string;
}) {
  if (members.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-foreground mb-2 text-sm font-bold">{heading}</h2>
      <ul className="columns-1 gap-6 text-sm sm:columns-2 lg:columns-3">
        {members.map((member) => (
          <li key={member.title} className="break-inside-avoid py-0.5">
            <Link href={href(member.title)} className="hover:text-wiki" prefetch={false}>
              {label(member.title)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface CategoryMembersProps {
  /** The category's canonical title ("Category:Countries"). */
  title: string;
  members: CategoryMember[];
  /** Every member of the category, not only the ones on this page. */
  total: number;
  /** The `?from=` of this page ("" on the first). */
  from: string;
  /** The cursor of the next page (`?from=<sort key>&after=<title>`), or null at the end. */
  next: CategoryCursor | null;
}

export function CategoryMembers({ title, members, total, from, next }: CategoryMembersProps) {
  const subcategories = members.filter((m) => m.namespace === SUBCATEGORY_NAMESPACE);
  const files = members.filter((m) => m.namespace === FILE_NAMESPACE);
  const pages = members.filter(
    (m) => m.namespace !== SUBCATEGORY_NAMESPACE && m.namespace !== FILE_NAMESPACE
  );
  const base = href(title);

  if (total === 0) {
    return (
      <p className="text-muted-foreground mt-6 text-sm">This category currently has no members.</p>
    );
  }

  return (
    <div className="wikios-category-members mt-8 border-t border-white/10 pt-4">
      <p className="text-muted-foreground text-xs">
        {members.length < total
          ? `Showing ${members.length.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} members`
          : `${total.toLocaleString("en-US")} ${total === 1 ? "member" : "members"}`}
        {from ? `, starting at “${from}”` : ""}.
      </p>
      <MemberList
        heading="Subcategories"
        members={subcategories}
        label={(t) => t.replace(/^Category:/, "")}
      />
      <MemberList
        heading={`Pages in category “${title.replace(/^Category:/, "")}”`}
        members={pages}
        label={(t) => t}
      />
      <MemberList heading="Media in this category" members={files} label={(t) => t} />
      <nav aria-label="Category pages" className="mt-6 flex gap-4 text-sm">
        {from && (
          <Link href={base} className="hover:text-wiki" prefetch={false}>
            First page
          </Link>
        )}
        {next && (
          <Link
            href={`${base}?${new URLSearchParams({ from: next.sortKey, after: next.title })}`}
            className="hover:text-wiki"
            prefetch={false}
            rel="next"
          >
            Next page
          </Link>
        )}
      </nav>
    </div>
  );
}
