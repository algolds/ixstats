"use client";

import React from "react";
import Link from "next/link";
import { Calendar, Sliders, List } from "lucide-react";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";

interface WikiLoreDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  entry:
    | {
        winnerUser?: string | null;
        winnerPage?: string | null;
        winnerScore?: number | null;
        winnerBytes?: number | null;
        runnerUpUser?: string | null;
        runnerUpPage?: string | null;
        runnerUpScore?: number | null;
        runnerUpBytes?: number | null;
        candidates?: Array<{
          user: string;
          page?: string | null;
          bytesAdded?: number;
          score?: number;
        }>;
      }
    | null
    | undefined;
  isAdmin: boolean;
}

export function WikiLoreDayModal({
  isOpen,
  onClose,
  dateStr,
  entry,
  isAdmin,
}: WikiLoreDayModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border/40 bg-card/90 flex max-h-[85vh] max-w-2xl flex-col overflow-hidden rounded-2xl p-6 text-left shadow-2xl backdrop-blur-md">
        <div className="pointer-events-none absolute top-0 right-0 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl" />

        {/* Modal Header */}
        <DialogHeader className="border-border/20 mb-4 border-b pb-4 text-left sm:text-left">
          <DialogTitle className="text-foreground flex items-center gap-2 text-base font-black">
            <Calendar className="h-5 w-5 text-amber-500" />
            Edit Candidates — {dateStr}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Review the daily podium and candidate list for this date
          </DialogDescription>
        </DialogHeader>

        {/* Modal Content */}
        <div className="flex-1 space-y-6 overflow-y-auto pr-1">
          {!entry ? (
            <div className="text-muted-foreground p-8 text-center text-sm italic">
              No scanning data or entries recorded for this date.
            </div>
          ) : (
            <>
              {/* Podium View */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Winner */}
                <div className="flex h-32 flex-col justify-between rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black tracking-wider text-black uppercase">
                      Winner
                    </span>
                    {entry.winnerScore !== null && entry.winnerScore !== undefined && (
                      <span className="font-mono text-xs font-bold text-amber-500">
                        {entry.winnerScore} pts
                      </span>
                    )}
                  </div>
                  {entry.winnerUser ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <UnifiedCountryFlag
                          countryName={entry.winnerUser}
                          size="xs"
                          showTooltip={false}
                        />
                        <h5 className="text-foreground text-sm font-bold">{entry.winnerUser}</h5>
                      </div>
                      {entry.winnerPage && (
                        <Link
                          href={`/wiki/${encodeURIComponent(entry.winnerPage)}`}
                          className="block truncate text-xs text-amber-500 hover:underline"
                        >
                          {entry.winnerPage}
                        </Link>
                      )}
                      {entry.winnerBytes !== null && entry.winnerBytes !== undefined && (
                        <span className="text-muted-foreground block font-mono text-[10px]">
                          +{entry.winnerBytes.toLocaleString()} bytes
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">No Winner Assigned</span>
                  )}
                </div>

                {/* Runner-up */}
                <div className="border-border/40 bg-card/45 flex h-32 flex-col justify-between rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider uppercase">
                      Runner-up
                    </span>
                    {entry.runnerUpScore !== null && entry.runnerUpScore !== undefined && (
                      <span className="text-foreground/80 font-mono text-xs font-bold">
                        {entry.runnerUpScore} pts
                      </span>
                    )}
                  </div>
                  {entry.runnerUpUser ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <UnifiedCountryFlag
                          countryName={entry.runnerUpUser}
                          size="xs"
                          showTooltip={false}
                        />
                        <h5 className="text-foreground text-foreground/90 text-sm font-bold">
                          {entry.runnerUpUser}
                        </h5>
                      </div>
                      {entry.runnerUpPage && (
                        <Link
                          href={`/wiki/${encodeURIComponent(entry.runnerUpPage)}`}
                          className="text-muted-foreground block truncate text-xs hover:underline"
                        >
                          {entry.runnerUpPage}
                        </Link>
                      )}
                      {entry.runnerUpBytes !== null && entry.runnerUpBytes !== undefined && (
                        <span className="text-muted-foreground block font-mono text-[10px]">
                          +{entry.runnerUpBytes.toLocaleString()} bytes
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">
                      No Runner-up Assigned
                    </span>
                  )}
                </div>
              </div>

              {/* Candidates list table */}
              <div className="space-y-2">
                <h5 className="text-foreground flex items-center gap-2 text-sm font-bold">
                  <List className="h-4 w-4 text-amber-500" />
                  Scanned Candidates
                </h5>
                <div className="border-border/30 bg-muted/20 overflow-hidden rounded-xl border backdrop-blur-xs dark:bg-black/15">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 text-muted-foreground border-border/20 border-b text-[10px] font-black tracking-wider uppercase dark:bg-black/30">
                      <tr>
                        <th className="text-muted-foreground p-3 font-semibold">User</th>
                        <th className="text-muted-foreground p-3 font-semibold">Page / Edit</th>
                        <th className="text-muted-foreground p-3 text-right font-semibold">
                          Bytes
                        </th>
                        <th className="text-muted-foreground p-3 text-right font-semibold">
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-border/10 dark:divide-border/20 divide-y">
                      {entry.candidates && entry.candidates.length > 0 ? (
                        entry.candidates.map((cand) => (
                          <tr
                            key={`${cand.user}-${cand.page}`}
                            className="hover:bg-muted/30 transition-colors dark:hover:bg-white/5"
                          >
                            <td className="text-foreground flex items-center gap-2 p-3 font-bold">
                              <UnifiedCountryFlag
                                countryName={cand.user}
                                size="xs"
                                showTooltip={false}
                              />
                              {cand.user}
                            </td>
                            <td className="text-muted-foreground max-w-[200px] truncate p-3">
                              {cand.page ? (
                                <Link
                                  href={`/wiki/${encodeURIComponent(cand.page)}`}
                                  className="font-medium text-amber-600 hover:text-amber-500 hover:underline dark:text-amber-500/80"
                                >
                                  {cand.page}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground italic">No page</span>
                              )}
                            </td>
                            <td className="text-muted-foreground dark:text-muted-foreground/95 p-3 text-right font-mono">
                              {cand.bytesAdded !== undefined
                                ? `+${cand.bytesAdded.toLocaleString()}`
                                : "—"}
                            </td>
                            <td className="text-foreground p-3 text-right font-mono font-bold">
                              {cand.score !== undefined ? Math.round(cand.score) : "—"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-muted-foreground p-4 text-center italic">
                            No candidates found for this date.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="border-border/20 flex items-center justify-between gap-2 border-t pt-4">
                  <div className="text-muted-foreground text-xs">Admin quick controls:</div>
                  <Link href="/admin/wiki?tab=lorewards">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-500/35 text-amber-500 hover:bg-amber-500/10"
                    >
                      <Sliders className="mr-1.5 h-3.5 w-3.5" />
                      Manage in Admin Panel
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
