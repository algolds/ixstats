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
import { soundEffects } from "~/lib/sound/cuelume";
import { withBasePath } from "~/lib/base-path";

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

  const { data: auditData, isLoading: loadingLogs } =
    api.wikios.getAuditLogs.useQuery({ limit: 50 });

  const restoreMutation = api.wikios.restoreArticle.useMutation({
    onSuccess: () => {
      void utils.wikios.getArchivedArticles.invalidate();
      void utils.wikios.getHealthTelemetry.invalidate();
      soundEffects?.bloom?.();
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
      color: "from-amber-500/10 to-orange-500/10 text-amber-400 border-amber-500/20",
    },
    {
      id: "logs",
      title: "System Audit & Event Logs",
      description: "Immutable transaction logs tracking page moves, deletions, protection, and sync events.",
      legacyAlias: "Special:Log",
      icon: Book,
      badge: `${auditData?.total ?? 0} Events`,
      color: "from-blue-500/10 to-indigo-500/10 text-blue-400 border-blue-500/20",
    },
    {
      id: "protection",
      title: "Content Protection & Permissions",
      description: "Administer editing lockouts, sysop restrictions, and edit conflict barriers.",
      legacyAlias: "Special:ProtectedPages",
      icon: Shield,
      badge: "Sysop Protected",
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-400 border-emerald-500/20",
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
        <Shield className="h-4 w-4 text-amber-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Realm Governance & Audit ({filteredTools.length})
        </h3>
      </div>

      {/* Selector Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          const isSelected = selectedTab === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              data-cuelume-press="soft"
              data-cuelume-hover="tick"
              onClick={() => setSelectedTab(selectedTab === tool.id ? null : (tool.id as any))}
              className={`group flex flex-col justify-between rounded-xl border p-4 text-left backdrop-blur-md transition-all duration-200 active:scale-[0.98] ${
                isSelected
                  ? "border-wiki/60 bg-card/90 shadow-md ring-1 ring-wiki/30"
                  : "border-border/40 bg-card/60 hover:border-wiki/30 hover:bg-card/80"
              }`}
            >
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border bg-gradient-to-br ${tool.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="rounded-full border border-border/40 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-foreground">
                    {tool.badge}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-foreground group-hover:text-wiki">
                  {tool.title}
                </h4>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                  {tool.description}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-2 text-[10px] text-muted-foreground">
                <span className="font-mono opacity-60">{tool.legacyAlias}</span>
                <NavArrowRight className="h-3 w-3 opacity-60" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Governance Drawer (Collapsed by Default) */}
      <AnimatePresence>
        {selectedTab && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
            className="overflow-hidden rounded-xl border border-border/40 bg-card/50 backdrop-blur-md shadow-md"
          >
            <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-2.5">
              <span className="text-xs font-medium text-foreground">
                Active Governance Console:{" "}
                <span className="font-semibold text-wiki">
                  {selectedTab === "archive"
                    ? "Archived Articles (Soft-Delete)"
                    : selectedTab === "logs"
                    ? "Audit Log Ledger"
                    : "Content Protection & Permissions"}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Authoritative PostgreSQL Transaction Layer
                </span>
                <button
                  type="button"
                  data-cuelume-press="tap"
                  onClick={() => setSelectedTab(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground active:scale-90"
                  title="Close Console"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-border/20 p-2">
              {selectedTab === "archive" && (
                <div>
                  {loadingArchived ? (
                    <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Querying archived records...
                    </div>
                  ) : archivedArticles && archivedArticles.length > 0 ? (
                    <div className="space-y-1">
                      {archivedArticles.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `archive-${idx}`}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors hover:bg-muted/30"
                        >
                          <div>
                            <span className="font-medium text-foreground">{item.title}</span>
                            {item.summary && (
                              <p className="text-[11px] text-muted-foreground">{item.summary}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            data-cuelume-press="press"
                            data-cuelume-hover="tick"
                            onClick={() => handleRestore(item.title, item.slug)}
                            disabled={restoringSlug === item.slug}
                            className="rounded-lg border border-wiki/40 bg-wiki/10 px-2.5 py-1 text-[11px] font-medium text-wiki transition-colors hover:bg-wiki/20 active:scale-[0.97] disabled:opacity-50"
                          >
                            {restoringSlug === item.slug ? "Restoring..." : "Restore to Published"}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-emerald-400">
                      <CheckCircle className="mb-1 h-5 w-5" />
                      <span>No archived or soft-deleted pages in this realm.</span>
                    </div>
                  )}
                </div>
              )}

              {selectedTab === "logs" && (
                <div>
                  {loadingLogs ? (
                    <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Loading audit logs...
                    </div>
                  ) : auditData && auditData.logs.length > 0 ? (
                    <div className="space-y-1">
                      {auditData.logs.map((log: any, idx: number) => (
                        <div
                          key={log.id || `log-${idx}`}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors hover:bg-muted/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
                              {log.action}
                            </span>
                            <span className="font-medium text-foreground">{log.title}</span>
                            {log.details?.reason && (
                              <span className="text-[11px] text-muted-foreground">
                                — {log.details.reason}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                      <span>No recent audit logs recorded.</span>
                    </div>
                  )}
                </div>
              )}

              {selectedTab === "protection" && (
                <div className="flex items-center justify-between p-4 text-xs">
                  <div>
                    <h4 className="font-semibold text-foreground">Protected Namespaces & Permissions</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Administer system owner edit locks, sysop barriers, and namespace guardrails.
                    </p>
                  </div>
                  <Link
                    href={withBasePath("/admin/wikios-settings")}
                    data-cuelume-press="press"
                    data-cuelume-hover="tick"
                    className="rounded-lg border border-wiki/40 bg-wiki/10 px-3 py-1.5 text-xs font-medium text-wiki transition-colors hover:bg-wiki/20 active:scale-95"
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
