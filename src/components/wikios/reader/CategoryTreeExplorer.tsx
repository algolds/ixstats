// src/components/wikios/reader/CategoryTreeExplorer.tsx
// Expandable lazy-loaded category tree for WikiOS.

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface CategoryNodeProps {
  title: string;
  fullTitle: string;
  depth: number;
}

function CategoryNode({ title, fullTitle, depth }: CategoryNodeProps) {
  const [expanded, setExpanded] = useState(false);

  const treeQuery = api.wikios.getCategoryTree.useQuery(
    { category: fullTitle, depth: 1 },
    { enabled: expanded, staleTime: 300000 }
  );

  const pagesQuery = api.wikios.getCategoryMembers.useQuery(
    { category: title, limit: 20, type: "page" },
    { enabled: expanded, staleTime: 300000 }
  );

  const toggle = useCallback(() => setExpanded((e) => !e), []);

  const subcats = treeQuery.data?.subcategories ?? [];
  const pages = pagesQuery.data?.members ?? [];
  const totalPages = treeQuery.data?.totalPages ?? 0;
  const totalSubcats = treeQuery.data?.totalSubcats ?? 0;

  return (
    <div className="wikios-tree-node" style={{ marginLeft: depth * 16 }}>
      <button onClick={toggle} className="wikios-tree-toggle">
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {expanded ? (
          <FolderOpen size={14} className="wikios-tree-icon" />
        ) : (
          <Folder size={14} className="wikios-tree-icon" />
        )}
        <Link
          href={withBasePath(
            `/w/special/categories/${encodeURIComponent(title.replace(/ /g, "_"))}`
          )}
          className="wikios-tree-label"
          onClick={(e) => e.stopPropagation()}
        >
          {title.replace(/_/g, " ")}
        </Link>
        <span className="wikios-tree-count">
          {totalPages > 0 && `${totalPages}p`}
          {totalSubcats > 0 && ` ${totalSubcats}c`}
        </span>
      </button>

      {expanded && (
        <div className="wikios-tree-children">
          {treeQuery.isLoading && (
            <div className="wikios-tree-loading" style={{ marginLeft: (depth + 1) * 16 }}>
              Loading...
            </div>
          )}

          {/* Subcategories */}
          {subcats.map((sc) => (
            <CategoryNode
              key={sc.fullTitle}
              title={sc.title}
              fullTitle={sc.fullTitle}
              depth={depth + 1}
            />
          ))}

          {/* Pages */}
          {pages.map((page) => (
            <div
              key={page.title}
              className="wikios-tree-page"
              style={{ marginLeft: (depth + 1) * 16 }}
            >
              <FileText size={12} className="wikios-tree-icon-page" />
              <Link
                href={withBasePath(
                  `/w/${encodeURIComponent(page.title.replace(/ /g, "_"))}`
                )}
                className="wikios-tree-page-link"
              >
                {page.title.replace(/_/g, " ")}
              </Link>
            </div>
          ))}

          {expanded && !treeQuery.isLoading && subcats.length === 0 && pages.length === 0 && (
            <div
              className="wikios-tree-empty"
              style={{ marginLeft: (depth + 1) * 16 }}
            >
              Empty category
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CategoryTreeExplorerProps {
  rootCategory: string;
  className?: string;
}

export function CategoryTreeExplorer({ rootCategory, className }: CategoryTreeExplorerProps) {
  const treeQuery = api.wikios.getCategoryTree.useQuery(
    { category: rootCategory, depth: 1 },
    { staleTime: 300000 }
  );

  return (
    <div className={cn("wikios-tree-explorer", className)}>
      <h3 className="wikios-tree-root-title">
        <Folder size={16} />
        {rootCategory.replace(/_/g, " ")}
      </h3>

      {treeQuery.isLoading && (
        <div className="wikios-tree-loading">Loading category tree...</div>
      )}

      {treeQuery.data?.subcategories.map((sc) => (
        <CategoryNode
          key={sc.fullTitle}
          title={sc.title}
          fullTitle={sc.fullTitle}
          depth={0}
        />
      ))}
    </div>
  );
}
