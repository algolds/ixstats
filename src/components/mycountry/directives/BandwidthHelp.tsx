"use client";

import React from "react";
import Link from "next/link";
import { HelpCircle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

/**
 * Executive bandwidth is the player-facing name for civil service capacity (`execBandwidth*` in code):
 * how much work the government can carry at once.
 */
export interface BandwidthState {
  capacity: number;
  used: number;
  available: number;
  overCapacity: boolean;
  breakdown?: {
    governmentStaff: number;
    recon: number;
    policies: number;
    directives: number;
    delegatedIssues: number;
  } | null;
}

type BreakdownKey = keyof NonNullable<BandwidthState["breakdown"]>;

/** What draws on bandwidth, in the order the bar stacks them. */
export const BANDWIDTH_USES: ReadonlyArray<{
  key: BreakdownKey;
  label: string;
  note: string;
  swatch: string;
}> = [
  {
    key: "governmentStaff",
    label: "Government staff",
    note: "Your government components",
    swatch: "bg-chart-1",
  },
  { key: "policies", label: "Policies", note: "Every policy in effect", swatch: "bg-chart-2" },
  {
    key: "directives",
    label: "Directives",
    note: "During their execution week",
    swatch: "bg-chart-3",
  },
  { key: "recon", label: "Recon meetings", note: "While in progress", swatch: "bg-chart-4" },
  {
    key: "delegatedIssues",
    label: "Delegated issues",
    note: "For 5 IxTime days",
    swatch: "bg-chart-5",
  },
];

export function hasBandwidth(state: BandwidthState | null | undefined): state is BandwidthState {
  return !!state && Number.isFinite(state.capacity) && state.capacity > 0;
}

/** Used bandwidth as a bar stacked by what uses it; full and red when over capacity. */
export function BandwidthBar({ state, className }: { state: BandwidthState; className?: string }) {
  const b = state.breakdown;
  const label = `${Math.round(state.used)} of ${Math.round(state.capacity)} bandwidth in use`;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(state.capacity)}
      aria-valuenow={Math.round(state.used)}
      className={cn("bg-fill-3 flex h-1.5 overflow-hidden rounded-full", className)}
    >
      {state.overCapacity || !b ? (
        <div
          className={state.overCapacity ? "bg-destructive w-full" : "bg-tint"}
          style={
            state.overCapacity ? undefined : { width: `${(state.used / state.capacity) * 100}%` }
          }
        />
      ) : (
        BANDWIDTH_USES.map((u) =>
          b[u.key] > 0 ? (
            <div
              key={u.key}
              className={u.swatch}
              style={{ width: `${(b[u.key] / state.capacity) * 100}%` }}
            />
          ) : null
        )
      )}
    </div>
  );
}

/**
 * A help button that explains executive bandwidth, with the country's live breakdown if given.
 * `trigger` replaces the help button (e.g. a whole stat band that opens the breakdown).
 */
export function BandwidthHelp({
  state,
  trigger,
}: {
  state?: BandwidthState | null;
  trigger?: React.ReactElement;
}) {
  const known = hasBandwidth(state);
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="About executive bandwidth"
            className="text-label-tertiary hover:text-label -my-1 max-sm:size-11"
          >
            <HelpCircle />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div className="space-y-1">
          <h4 className="text-headline text-label">Executive bandwidth</h4>
          <p className="text-callout text-label-secondary">
            How much work your government can carry at once. It grows with your population and
            government effectiveness.
          </p>
        </div>
        {known && (
          <div className="space-y-2">
            <p className="text-footnote text-label tabular-nums">
              {Math.round(state.used)} of {Math.round(state.capacity)} in use
              {state.overCapacity ? " · over capacity" : ""}
            </p>
            <BandwidthBar state={state} />
          </div>
        )}
        <ul className="divide-separator divide-y">
          {BANDWIDTH_USES.map((u) => (
            <li key={u.key} className="text-footnote flex items-center gap-2 py-2">
              <span className={cn("size-2 shrink-0 rounded-full", u.swatch)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="text-label">{u.label}</span>
                <span className="text-label-secondary"> · {u.note}</span>
              </span>
              {known && state.breakdown && (
                <span className="text-label tabular-nums">
                  {Math.round(state.breakdown[u.key])}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-footnote text-label-secondary">
          Completing or abandoning a directive frees its bandwidth early. Going over doesn&rsquo;t
          block you, but recon and policy previews become less reliable.
        </p>
        <Link
          href="/help/mycountry/executive#executive-bandwidth"
          className="text-footnote text-tint inline-block underline-offset-2 hover:underline"
        >
          How bandwidth works
        </Link>
      </PopoverContent>
    </Popover>
  );
}
