"use client";

import React from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";

export function CategoriesBar({ categories }: { categories: string[] }) {
  const visible = categories.filter(
    (cat) =>
      !cat.startsWith("Pages_") &&
      !cat.startsWith("Articles_") &&
      !cat.includes("_with_") &&
      !cat.startsWith("IXWB")
  );
  if (visible.length === 0) return null;

  return (
    <footer className="wikios-categories">
      <span className="wikios-categories-label">Categories:</span>
      <ul className="wikios-categories-list">
        {visible.map((cat) => (
          <li key={cat}>
            <Link
              href={withBasePath(`/wiki/categories/${encodeURIComponent(cat.replace(/ /g, "_"))}`)}
              className="wikios-category-link"
            >
              {cat.replace(/_/g, " ")}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}
