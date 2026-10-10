"use client";

import { useRouter } from "next/navigation";
import { Sort } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { sortHref, THREAD_SORTS, type ThreadSort } from "~/lib/thinkpages-forum/thread-sort";

const SORT_LABELS: Record<ThreadSort, string> = {
  latest: "Latest activity",
  newest: "Newest threads",
  replies: "Most replies",
};

/** The sort as a header menu, for phones, where the table has no column headers to sort by. */
export function SortMenu({ basePath, sort }: { basePath: string; sort: ThreadSort }) {
  const router = useRouter();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="md:hidden">
          <Sort aria-hidden />
          Sort
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={sort}
          onValueChange={(next) => {
            const chosen = THREAD_SORTS.find((s) => s === next);
            if (chosen) router.push(sortHref(basePath, chosen));
          }}
        >
          {THREAD_SORTS.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {SORT_LABELS[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
