// src/components/wiki-os/reader/CategoryBreadcrumb.tsx
// Shows parent category hierarchy above an article for navigation context.

"use client";

import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { ChevronRight } from "lucide-react";
import { api } from "~/trpc/react";

interface CategoryBreadcrumbProps {
  title: string;
}

export function CategoryBreadcrumb({ title }: CategoryBreadcrumbProps) {
  const { data } = api.wikios.getParentCategories.useQuery(
    { title },
    { staleTime: 300000 } // 5 min
  );

  const categories = data?.categories ?? [];
  if (categories.length === 0) return null;

  // Show at most 3 most relevant categories (filter out maintenance categories)
  const relevant = categories
    .filter(
      (c) =>
        !c.title.startsWith("Pages ") &&
        !c.title.startsWith("Articles ") &&
        !c.title.includes(" with ") &&
        !c.title.startsWith("IXWB") &&
        !c.title.startsWith("All ")
    )
    .slice(0, 3);

  if (relevant.length === 0) return null;

  return (
    <nav className="wikios-breadcrumb" aria-label="Categories">
      {relevant.map((cat, i) => (
        <span key={cat.title} className="wikios-breadcrumb-item">
          {i > 0 && <ChevronRight size={12} className="wikios-breadcrumb-sep" />}
          <Link
            href={withBasePath(
              `/wiki/categories/${encodeURIComponent(cat.title.replace(/ /g, "_"))}`
            )}
            className="wikios-breadcrumb-link"
          >
            {cat.title.replace(/_/g, " ")}
          </Link>
        </span>
      ))}
    </nav>
  );
}
