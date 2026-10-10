import Link from "next/link";
import { categoryHref } from "~/lib/thinkpages-forum/links";

/**
 * The realm's boards as a horizontal chip row, for phones, where the rail is only a sheet (Facet exception 2). The
 * row scrolls inside itself, so it never widens the page.
 */
export function BoardChips({
  slug,
  boards,
}: {
  slug: string;
  boards: ReadonlyArray<{ key: string; name: string }>;
}) {
  if (boards.length === 0) return null;
  return (
    <nav
      aria-label="Boards"
      className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1"
    >
      {boards.map((board) => (
        <Link
          key={board.key}
          href={categoryHref({ key: board.key, realm: { slug } })}
          className="bg-fill-3 hover:bg-fill-4 text-callout focus-visible:outline-tint inline-flex shrink-0 items-center rounded-full px-3 py-1.5 whitespace-nowrap focus-visible:outline-2 pointer-coarse:min-h-11"
        >
          {board.name}
        </Link>
      ))}
    </nav>
  );
}
