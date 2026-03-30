"use client";

import { api } from "~/trpc/react";
import { Loader2, Globe, Lock } from "lucide-react";

export function TemplatesTab() {
  const { data: templates, isLoading } = api.studio.adminListTemplates.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading templates...</span>
      </div>
    );
  }

  if (!templates?.length) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        No world templates found. Templates are created when a generated world is committed to a realm.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created By</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Visibility</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Seed</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tpl) => {
              const meta = tpl.metadata as { seed?: number; generatedAt?: string } | null;
              return (
                <tr key={tpl.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{tpl.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {tpl.createdBy === "system" ? "system" : (tpl.createdBy?.slice(0, 16) ?? "—") + "..."}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {tpl.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {tpl.isPublic ? "Public" : "Private"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {meta?.seed ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(tpl.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
