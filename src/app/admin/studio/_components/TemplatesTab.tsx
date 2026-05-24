"use client";

import { api } from "~/trpc/react";
import { Loader2, Globe, Lock } from "lucide-react";

export function TemplatesTab() {
  const { data: templates, isLoading } = api.studio.adminListTemplates.useQuery();

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-16">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading templates...</span>
      </div>
    );
  }

  if (!templates?.length) {
    return (
      <div className="text-muted-foreground py-16 text-center">
        No world templates found. Templates are created when a generated world is committed to a
        realm.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-border/50 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border/50 bg-muted/30 border-b">
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Name</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Created By</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Visibility</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Seed</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tpl) => {
              const meta = tpl.metadata as { seed?: number; generatedAt?: string } | null;
              return (
                <tr key={tpl.id} className="border-border/30 hover:bg-muted/20 border-b">
                  <td className="px-4 py-3 font-medium">{tpl.name}</td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {tpl.createdBy === "system"
                      ? "system"
                      : (tpl.createdBy?.slice(0, 16) ?? "—") + "..."}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                      {tpl.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {tpl.isPublic ? "Public" : "Private"}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {meta?.seed ?? "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
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
