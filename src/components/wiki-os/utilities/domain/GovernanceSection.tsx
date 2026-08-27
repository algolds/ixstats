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

  const { data: auditData, isLoading: loadingLogs } = api.wikios.getAuditLogs.useQuery({
    limit: 50,
  });

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
      description:
        "Immutable transaction logs tracking page moves, deletions, protection, and sync events.",
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
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
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
                  ? "border-wiki/60 bg-card/90 ring-wiki/30 shadow-md ring-1"
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
                  <span className="border-border/40 bg-secondary/50 text-foreground rounded-full border px-2 py-0.5 text-[10px] font-medium">
                    {tool.badge}
                  </span>
                </div>
                <h4 className="text-foreground group-hover:text-wiki text-xs font-semibold">
                  {tool.title}
                </h4>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px]">
                  {tool.description}
                </p>
              </div>

              <div className="border-border/30 text-muted-foreground mt-3 flex items-center justify-between border-t pt-2 text-[10px]">
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
            className="border-border/40 bg-card/50 overflow-hidden rounded-xl border shadow-md backdrop-blur-md"
          >
            <div className="border-border/40 bg-muted/20 flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-foreground text-xs font-medium">
                Active Governance Console:{" "}
                <span className="text-wiki font-semibold">
                  {selectedTab === "archive"
                    ? "Archived Articles (Soft-Delete)"
                    : selectedTab === "logs"
                      ? "Audit Log Ledger"
                      : "Content Protection & Permissions"}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[11px]">
                  Authoritative PostgreSQL Transaction Layer
                </span>
                <button
                  type="button"
                  data-cuelume-press="tap"
                  onClick={() => setSelectedTab(null)}
                  className="text-muted-foreground hover:bg-muted/40 hover:text-foreground rounded-md p-1 active:scale-90"
                  title="Close Console"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="divide-border/20 max-h-72 divide-y overflow-y-auto p-2">
              {selectedTab === "archive" && (
                <div>
                  {loadingArchived ? (
                    <div className="text-muted-foreground flex items-center justify-center p-8 text-xs">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Querying archived records...
                    </div>
                  ) : archivedArticles && archivedArticles.length > 0 ? (
                    <div className="space-y-1">
                      {archivedArticles.map((item: any, idx: number) => (
                        <div
                          key={item.id || item.slug || `archive-${idx}`}
                          className="hover:bg-muted/30 flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors"
                        >
                          <div>
                            <span className="text-foreground font-medium">{item.title}</span>
                            {item.summary && (
                              <p className="text-muted-foreground text-[11px]">{item.summary}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            data-cuelume-press="press"
                            data-cuelume-hover="tick"
                            onClick={() => handleRestore(item.title, item.slug)}
                            disabled={restoringSlug === item.slug}
                            className="border-wiki/40 bg-wiki/10 text-wiki hover:bg-wiki/20 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors active:scale-[0.97] disabled:opacity-50"
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
                    <div className="text-muted-foreground flex items-center justify-center p-8 text-xs">
                      <Refresh className="mr-2 h-4 w-4 animate-spin" /> Loading audit logs...
                    </div>
                  ) : auditData && auditData.logs.length > 0 ? (
                    <div className="space-y-1">
                      {auditData.logs.map((log: any, idx: number) => (
                        <div
                          key={log.id || `log-${idx}`}
                          className="hover:bg-muted/30 flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] uppercase">
                              {log.action}
                            </span>
                            <span className="text-foreground font-medium">{log.title}</span>
                            {log.details?.reason && (
                              <span className="text-muted-foreground text-[11px]">
                                — {log.details.reason}
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground flex flex-col items-center justify-center p-6 text-center text-xs">
                      <span>No recent audit logs recorded.</span>
                    </div>
                  )}
                </div>
              )}

              {selectedTab === "protection" && (
                <div className="flex items-center justify-between p-4 text-xs">
                  <div>
                    <h4 className="text-foreground font-semibold">
                      Protected Namespaces & Permissions
                    </h4>
                    <p className="text-muted-foreground text-[11px]">
                      Administer system owner edit locks, sysop barriers, and namespace guardrails.
                    </p>
                  </div>
                  <Link
                    href={withBasePath("/admin/wikios-settings")}
                    data-cuelume-press="press"
                    data-cuelume-hover="tick"
                    className="border-wiki/40 bg-wiki/10 text-wiki hover:bg-wiki/20 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors active:scale-95"
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
