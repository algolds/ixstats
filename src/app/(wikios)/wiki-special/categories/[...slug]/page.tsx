// src/app/(wikios)/wiki-special/categories/[...slug]/page.tsx
// WikiOS Category Browser — shows category members and subcategories
"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";

export default function CategoryPage() {
  const params = useParams<{ slug: string[] }>();
  const category = params.slug.join("/").replace(/_/g, " ");

  // Fetch subcategories
  const { data: subcatData } = api.wikios.getCategoryMembers.useQuery(
    { category, limit: 100, type: "subcat" },
    { staleTime: 60_000 }
  );

  // Fetch pages
  const { data: pageData, isLoading } = api.wikios.getCategoryMembers.useQuery(
    { category, limit: 100, type: "page" },
    { staleTime: 60_000 }
  );

  const subcategories = subcatData?.members ?? [];
  const pages = pageData?.members ?? [];

  return (
    <WikiOSLayout title={`Category:${category}`}>
      <div className="wikios-special-page">
        {isLoading && (
          <div className="wikios-loading" style={{ minHeight: 200 }}>
            <div className="wikios-loading-spinner" />
          </div>
        )}

        {/* Subcategories */}
        {subcategories.length > 0 && (
          <section className="wikios-cat-section">
            <h2 className="wikios-cat-section-title">Subcategories</h2>
            <ul className="wikios-cat-list wikios-cat-list--grid">
              {subcategories.map((m) => {
                const name = m.title.replace(/^Category:/, "");
                return (
                  <li key={m.title}>
                    <Link
                      href={withBasePath(`/wiki-special/categories/${encodeURIComponent(name.replace(/ /g, "_"))}`)}
                      className="wikios-cat-subcat-link"
                    >
                      {name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Pages */}
        {pages.length > 0 && (
          <section className="wikios-cat-section">
            <h2 className="wikios-cat-section-title">
              Pages in category ({pages.length})
            </h2>
            <ul className="wikios-cat-list wikios-cat-list--grid">
              {pages.map((m) => (
                <li key={m.title}>
                  <Link
                    href={withBasePath(`/w/${encodeURIComponent(m.title.replace(/ /g, "_"))}`)}
                  >
                    {m.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!isLoading && pages.length === 0 && subcategories.length === 0 && (
          <p className="text-zinc-400">This category is empty.</p>
        )}
      </div>
    </WikiOSLayout>
  );
}
