"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Shield, Archive, Book, Clock } from "iconoir-react";
import { api } from "~/trpc/react";
import { ixstatesLinkHref } from "~/lib/system/wikios-standalone";
import { Button } from "~/components/ui/button";
import {
  InspectorEmpty,
  InspectorList,
  InspectorLoading,
  InspectorRow,
  InspectorSection,
  type InspectorTool,
} from "./InspectorSection";

const PANEL_TITLES: Record<string, string> = {
  archive: "Archived Articles (Soft-Delete)",
  logs: "Audit log ledger",
  protection: "Content protection & permissions",
};

const TOOLS: Omit<InspectorTool, "badge">[] = [
  {
    id: "archive",
    title: "Soft-Delete Archive & 1-Click Restoration",
    description: "Inspect deleted lore articles and instantly restore them to published status.",
    legacyAlias: "Special:Undelete",
    icon: Archive,
    color: "border-yellow/20 bg-yellow/10 text-yellow",
  },
  {
    id: "logs",
    title: "System audit & event logs",
    description:
      "Immutable transaction logs tracking page moves, deletions, protection, and sync events.",
    legacyAlias: "Special:Log",
    icon: Book,
    color: "border-blue/20 bg-blue/10 text-blue",
  },
  {
    id: "protection",
    title: "Content protection & permissions",
    description: "Administer editing lockouts, sysop restrictions, and edit conflict barriers.",
    legacyAlias: "Special:ProtectedPages",
    icon: Shield,
    color: "border-green/20 bg-green/10 text-green",
  },
];

export function GovernanceSection({ searchFilter }: { searchFilter: string }) {
  const [restoringSlug, setRestoringSlug] = useState<string | null>(null);
  const utils = api.useUtils();

  const { data: archivedArticles, isLoading: loadingArchived } =
    api.wikios.getArchivedArticles.useQuery({ limit: 50 });
  const { data: auditData, isLoading: loadingLogs } = api.wikios.getAuditLogs.useQuery({
    limit: 50,
  });

  const restoreMutation = api.wikios.restoreArticle.useMutation({
    onSuccess: () => {
      void utils.wikios.getArchivedArticles.invalidate();
      void utils.wikios.getHealthTelemetry.invalidate();
      setRestoringSlug(null);
    },
    onError: () => setRestoringSlug(null),
  });

  const handleRestore = (title: string, slug: string) => {
    setRestoringSlug(slug);
    restoreMutation.mutate({ title, realm: "ixwiki" });
  };

  const tools = [
    { ...TOOLS[0]!, badge: `${archivedArticles?.length ?? 0} Archived` },
    { ...TOOLS[1]!, badge: `${auditData?.total ?? 0} Events` },
    { ...TOOLS[2]!, badge: "Sysop protected" },
  ];

  const archivePanel = () => {
    if (loadingArchived) return <InspectorLoading>Querying archived records...</InspectorLoading>;
    if (!archivedArticles?.length) {
      return <InspectorEmpty>No archived or soft-deleted pages in this realm.</InspectorEmpty>;
    }
    return (
      <InspectorList>
        {archivedArticles.map((item, idx) => (
          <InspectorRow key={item.id || item.slug || `archive-${idx}`}>
            <div>
              <span className="text-label font-medium">{item.title}</span>
              {item.summary && <p className="text-label-secondary text-footnote">{item.summary}</p>}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleRestore(item.title, item.slug)}
              disabled={restoringSlug === item.slug}
            >
              {restoringSlug === item.slug ? "Restoring..." : "Restore to published"}
            </Button>
          </InspectorRow>
        ))}
      </InspectorList>
    );
  };

  const logsPanel = () => {
    if (loadingLogs) return <InspectorLoading>Loading audit logs...</InspectorLoading>;
    if (!auditData?.logs.length) {
      return <InspectorEmpty ok={false}>No recent audit logs recorded.</InspectorEmpty>;
    }
    return (
      <InspectorList>
        {auditData.logs.map((log: any, idx: number) => (
          <InspectorRow key={log.id || `log-${idx}`}>
            <div className="flex items-center gap-2">
              <span className="bg-fill-3 text-label-secondary rounded-control-sm text-eyebrow px-2 py-0.5 tabular-nums">
                {log.action}
              </span>
              <span className="text-label font-medium">{log.title}</span>
              {log.details?.reason && (
                <span className="text-label-secondary text-footnote">— {log.details.reason}</span>
              )}
            </div>
            <div className="text-label-secondary text-footnote flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
            </div>
          </InspectorRow>
        ))}
      </InspectorList>
    );
  };

  const protectionPanel = () => (
    <div className="text-footnote flex items-center justify-between p-4">
      <div>
        <h4 className="text-label font-semibold">Protected namespaces & permissions</h4>
        <p className="text-label-secondary text-footnote">
          Administer system owner edit locks, sysop barriers, and namespace guardrails.
        </p>
      </div>
      <Link
        href={ixstatesLinkHref("/admin/wikios-settings")}
        data-cuelume-press="press"
        data-cuelume-hover="tick"
        className="border-tint/40 bg-tint/10 text-tint hover:bg-tint/20 rounded-control text-caption border px-3 py-2 transition-colors"
      >
        Open Sysop panel
      </Link>
    </div>
  );

  const panels: Record<string, () => ReactNode> = {
    archive: archivePanel,
    logs: logsPanel,
    protection: protectionPanel,
  };

  return (
    <InspectorSection
      searchFilter={searchFilter}
      heading="Realm Governance & Audit"
      headingIcon={<Shield className="text-yellow h-4 w-4" />}
      ariaLabel="Governance tools"
      tools={tools}
      gridClass="sm:grid-cols-3"
      roomy
      panelLabel="Active Governance Console"
      panelCaption="Authoritative PostgreSQL transaction layer"
      closeLabel="Close console"
      panelTitle={(id) => PANEL_TITLES[id] ?? ""}
      renderPanel={(id) => panels[id]?.()}
    />
  );
}
