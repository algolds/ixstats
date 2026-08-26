// src/components/wiki-os/reader/CategoryBreadcrumb.tsx
// Shows parent category hierarchy above an article for navigation context.

"use client";

import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { NavArrowRight as ChevronRight } from "iconoir-react";
import { api } from "~/trpc/react";

interface CategoryBreadcrumbProps {
  title: string;
}

export function CategoryBreadcrumb({ title }: CategoryBreadcrumbProps) {
  const { data } = api.wikios.getParentCategories.useQuery(
    { title },
    { staleTime: 300000 } // 5 min
  );

  const rawCategories = data?.categories ?? [];
  if (!Array.isArray(rawCategories) || rawCategories.length === 0) return null;

  // Normalize to string titles safely whether backend returns string[] or object[]
  const stringCategories = rawCategories
    .map((c: any) => {
      if (typeof c === "string") return c;
      if (c && typeof c.title === "string") return c.title;
      if (c && typeof c.name === "string") return c.name;
      if (c && typeof c.slug === "string") return c.slug;
      return "";
    })
    .filter(Boolean);

  // Show at most 3 most relevant categories (filter out maintenance categories)
  const relevant = stringCategories
    .filter(
      (catTitle) =>
        !catTitle.startsWith("Pages ") &&
        !catTitle.startsWith("Articles ") &&
        !catTitle.includes(" with ") &&
        !catTitle.startsWith("IXWB") &&
        !catTitle.startsWith("All ") &&
        !catTitle.includes("http:") &&
        !catTitle.includes("https:")
    )
    .slice(0, 3);

  if (relevant.length === 0) return null;

  return (
    <nav className="wikios-breadcrumb" aria-label="Categories">
      {relevant.map((catTitle, i) => (
        <span key={catTitle} className="wikios-breadcrumb-item">
          {i > 0 && <ChevronRight className="h-3 w-3 wikios-breadcrumb-sep" />}
          <Link
            href={withBasePath(
              `/wiki/categories/${encodeURIComponent(catTitle.replace(/ /g, "_"))}`
            )}
            className="wikios-breadcrumb-link"
          >
            {catTitle.replace(/_/g, " ")}
          </Link>
        </span>
      ))}
    </nav>
  );
}
