"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Shield,
  Archive,
  Refresh,
  CheckCircle,
  NavArrowRight,
  Book,
  Clock,
  Xmark as X,
} from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "~/trpc/react";
import { ixstatesHref } from "~/lib/system/wikios-standalone";
import { withBasePath } from "~/lib/base-path";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { Button } from "~/components/ui/button";

interface GovernanceSectionProps {
  searchFilter: string;
}

export function GovernanceSection({ searchFilter }: GovernanceSectionProps) {
  const [selectedTab, setSelectedTab] = useState<"archive" | "logs" | "protection" | null>(null);
  const [restoringSlug, setRestoringSlug] = useState<string | null>(null);

  const query = searchFilter.toLowerCase().trim();
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
    onError: () => {
      setRestoringSlug(null);
    },
  });

  const handleRestore = (title: string, slug: string) => {
    setRestoringSlug(slug);
    restoreMutation.mutate({ title, realm: "ixwiki" });
  };

  const tools = [
    {
      id: "archive",
      title: "Soft-Delete Archive & 1-Click Restoration",
      description: "Inspect deleted lore articles and instantly restore them to published status.",
      legacyAlias: "Special:Undelete",
      icon: Archive,
      badge: `${archivedArticles?.length ?? 0} Archived`,
      color: "border-yellow/20 bg-yellow/10 text-yellow",
    },
    {
      id: "logs",
      title: "System Audit & Event Logs",
      description:
        "Immutable transaction logs tracking page moves, deletions, protection, and sync events.",
      legacyAlias: "Special:Log",
      icon: Book,
      badge: `${auditData?.total ?? 0} Events`,
      color: "border-blue/20 bg-blue/10 text-blue",
    },
    {
      id: "protection",
      title: "Content Protection & Permissions",
      description: "Administer editing lockouts, sysop restrictions, and edit conflict barriers.",
      legacyAlias: "Special:ProtectedPages",
      icon: Shield,
      badge: "Sysop Protected",
      color: "border-green/20 bg-green/10 text-green",
    },
  ];

  const filteredTools = tools.filter(
    (t) =>
      !query ||
      t.title.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.legacyAlias.toLowerCase().includes(query)
  );

  if (filteredTools.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Shield className="text-yellow h-4 w-4" />
        <h3 className="text-label-secondary text-subhead">
          Realm Governance & Audit ({filteredTools.length})
        </h3>
      </div>

      {/* Selector Cards */}
      <RadioCardGroup
        aria-label="Governance tools"
        value={selectedTab}
        onValueChange={(v) => setSelectedTab(v as "archive" | "logs" | "protection")}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <RadioCard
              key={tool.id}
              value={tool.id}
              indicator={false}
              // Pressing the open tool again closes its console.
              onClick={(e) => {
                if (selectedTab === tool.id) {
                  e.preventDefault();
                  setSelectedTab(null);
                }
              }}
              className="group flex-col items-stretch justify-between gap-0 p-4"
            >
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div
                    className={`rounded-control flex h-8 w-8 items-center justify-center border ${tool.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="border-separator bg-fill-3 text-label text-caption rounded-full border px-2 py-0.5">
                    {tool.badge}
                  </span>
                </div>
                <h4 className="text-label group-hover:text-tint text-caption font-semibold">
                  {tool.title}
                </h4>
                <p className="text-label-secondary text-footnote mt-1 line-clamp-2">
                  {tool.description}
                </p>
              </div>

              <div className="border-separator text-label-secondary text-footnote mt-3 flex items-center justify-between border-t pt-2">
                <span className="tabular-nums opacity-60">{tool.legacyAlias}</span>
                <NavArrowRight className="h-3 w-3 opacity-60" />
              </div>
            </RadioCard>
          );
        })}
      </RadioCardGroup>

      {/* Live Governance Drawer (Collapsed by Default) */}
      <AnimatePresence>
        {selectedTab && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
            className="border-separator bg-surface rounded-row shadow-card overflow-hidden border"
          >
            <div className="border-separator bg-fill-4 flex items-center justify-between border-b px-4 py-3">
              <span className="text-label text-caption">
                Active Governance Console:{" "}
                <span className="text-tint font-semibold">
                  {selectedTab === "archive"
                    ? "Archived Articles (Soft-Delete)"
                    : selectedTab === "logs"
                      ? "Audit Log Ledger"
                      : "Content Protection & Permissions"}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-label-secondary text-footnote">
                  Authoritative PostgreSQL Transaction Layer
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close Console"
                  onClick={() => setSelectedTab(null)}
                  title="Close Console"
                  className="text-label-secondary"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="divide-separator max-h-72 divide-y overflow-y-auto p-2">
              {selectedTab === "archive" && (
                <div>
                  {loadingArchived ? (
                    <div className="text-label-secondary text-footnote flex items-center justify-center p-8">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Querying archived records...
                    </div>
                  ) : archivedArticles && archivedArticles.length > 0 ? (
                    <div className="space-y-1">
                      {archivedArticles.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `archive-${idx}`}
                          className="hover:bg-fill-4 rounded-control text-footnote flex items-center justify-between px-3 py-2 transition-colors"
                        >
                          <div>
                            <span className="text-label font-medium">{item.title}</span>
                            {item.summary && (
                              <p className="text-label-secondary text-footnote">{item.summary}</p>
                            )}
                          </div>
                          <Button
                            variant="tinted"
                            size="sm"
                            onClick={() => handleRestore(item.title, item.slug)}
                            disabled={restoringSlug === item.slug}
                          >
                            {restoringSlug === item.slug ? "Restoring..." : "Restore to Published"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-footnote text-green flex flex-col items-center justify-center p-6 text-center">
                      <CheckCircle className="mb-1 h-5 w-5" />
                      <span>No archived or soft-deleted pages in this realm.</span>
                    </div>
                  )}
                </div>
              )}

              {selectedTab === "logs" && (
                <div>
                  {loadingLogs ? (
                    <div className="text-label-secondary text-footnote flex items-center justify-center p-8">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Loading audit logs...
                    </div>
                  ) : auditData && auditData.logs.length > 0 ? (
                    <div className="space-y-1">
                      {auditData.logs.map((log: any, idx: number) => (
                        <div
                          key={log.id || `log-${idx}`}
                          className="hover:bg-fill-4 rounded-control text-footnote flex items-center justify-between px-3 py-2 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="bg-fill-3 text-label-secondary rounded-control-sm text-eyebrow px-2 py-0.5 tabular-nums">
                              {log.action}
                            </span>
                            <span className="text-label font-medium">{log.title}</span>
                            {log.details?.reason && (
                              <span className="text-label-secondary text-footnote">
                                — {log.details.reason}
                              </span>
                            )}
                          </div>
                          <div className="text-label-secondary text-footnote flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-label-secondary text-footnote flex flex-col items-center justify-center p-6 text-center">
                      <span>No recent audit logs recorded.</span>
                    </div>
                  )}
                </div>
              )}

              {selectedTab === "protection" && (
                <div className="text-footnote flex items-center justify-between p-4">
                  <div>
                    <h4 className="text-label font-semibold">Protected Namespaces & Permissions</h4>
                    <p className="text-label-secondary text-footnote">
                      Administer system owner edit locks, sysop barriers, and namespace guardrails.
                    </p>
                  </div>
                  <Link
                    href={ixstatesHref("/admin/wikios-settings")}
                    data-cuelume-press="press"
                    data-cuelume-hover="tick"
                    className="border-tint/40 bg-tint/10 text-tint hover:bg-tint/20 rounded-control text-caption border px-3 py-2 transition-colors active:scale-[0.98]"
                  >
                    Open Sysop Panel
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
