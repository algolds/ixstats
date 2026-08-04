"use client";

import { useMemo } from "react";
import { Globe2, Shield, Landmark, Target, ArrowUpRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "~/components/ui/sheet";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";

/** A v2 drill-down. Phase 1 ships the shell + infrastructure; deep content lands in Phase 3. */
export type V2Drill =
  | { kind: "relations" | "defense" | "politics" }
  | { kind: "intent"; intentId: string }
  | null;

const DRILL_META: Record<
  "relations" | "defense" | "politics",
  { title: string; icon: typeof Globe2; accent: string; blurb: string }
> = {
  relations: {
    title: "Foreign Relations",
    icon: Globe2,
    accent: "text-cyan-400",
    blurb: "Embassies, treaties and foreign-policy stance. Diplomatic action surfaces here.",
  },
  defense: {
    title: "National Security",
    icon: Shield,
    accent: "text-red-400",
    blurb: "Defense posture, threat assessment and readiness. Defense directives land here.",
  },
  politics: {
    title: "Governance Configuration",
    icon: Landmark,
    accent: "text-purple-400",
    blurb: "Parties, legislature and electoral config — your nation's declared political reality.",
  },
};

const TIER_BADGE: Record<string, string> = {
  measured: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20",
  moderate: "text-amber-300 bg-amber-500/10 border-amber-400/20",
  extreme: "text-red-300 bg-red-500/10 border-red-400/20",
};

function PhaseThreeScaffold({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{blurb}</p>
      <FacetCard depth={1} className="border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
          <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-foreground/80 text-sm font-semibold">Depth surface</p>
        <p className="text-muted-foreground mt-1 text-xs">
          The full {title.toLowerCase()} drill-down arrives in Phase 3. Existing relations, defense
          and politics surfaces remain available from the legacy nav for now.
        </p>
      </FacetCard>
    </div>
  );
}

function IntentDetail({ countryId, intentId }: { countryId: string; intentId: string }) {
  const tree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const items = useMemo(() => tree.data ?? [], [tree.data]);
  const intent = useMemo(() => items.find((i: any) => i.id === intentId), [items, intentId]);
  const children = useMemo(() => items.filter((i: any) => i.parentId === intentId), [items, intentId]);

  if (!intent) {
    return (
      <p className="text-muted-foreground text-sm">This directive could not be loaded.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase",
              TIER_BADGE[intent.tier] || "bg-slate-500/10 text-slate-400 border-slate-500/20"
            )}
          >
            {intent.tier}
          </span>
          <span className="text-muted-foreground/60 text-[10px] font-medium capitalize">
            {intent.category}
          </span>
        </div>
        <h3 className="text-foreground mt-2 text-lg font-bold leading-tight">{intent.goal}</h3>
        <p className="text-muted-foreground mt-1 text-xs capitalize">
          Status: {intent.status ?? "active"}
        </p>
      </div>

      {children.length > 0 && (
        <div>
          <h4 className="text-muted-foreground mb-2 text-[10px] font-bold tracking-widest uppercase">
            Follow-ups
          </h4>
          <div className="space-y-2">
            {children.map((kid: any) => (
              <div
                key={kid.id}
                className="rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2 text-sm text-foreground/85"
              >
                {kid.goal}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function V2DrillSheets({
  drill,
  onClose,
  countryId,
}: {
  drill: V2Drill;
  onClose: () => void;
  countryId: string;
}) {
  const open = drill !== null;

  const kindKind = drill === null ? "relations" : drill.kind;
  const meta = kindKind === "intent" ? null : DRILL_META[kindKind];

  const title =
    drill === null ? "" : drill.kind === "intent" ? "Directive Detail" : meta?.title ?? "";
  const Icon = drill === null ? Target : drill.kind === "intent" ? Target : meta?.icon ?? Target;
  const accent = drill === null ? "text-amber-400" : meta?.accent ?? "text-amber-400";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="border-border bg-background/95 w-full overflow-y-auto backdrop-blur-xl sm:max-w-md">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Icon className={cn("h-4 w-4", accent)} />
            {title}
          </SheetTitle>
          {drill && drill.kind !== "intent" && (
            <SheetDescription className="text-muted-foreground text-xs">
              {meta?.blurb}
            </SheetDescription>
          )}
        </SheetHeader>

        {drill === null ? null : drill.kind === "intent" ? (
          <IntentDetail countryId={countryId} intentId={drill.intentId} />
        ) : (
          <PhaseThreeScaffold title={meta?.title ?? ""} blurb={meta?.blurb ?? ""} />
        )}
      </SheetContent>
    </Sheet>
  );
}