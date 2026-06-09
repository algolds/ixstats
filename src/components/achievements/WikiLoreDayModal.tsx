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
  entry: {
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
  } | null | undefined;
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
      <DialogContent className="max-w-2xl border-border/40 bg-card/90 rounded-2xl shadow-2xl p-6 backdrop-blur-md overflow-hidden max-h-[85vh] flex flex-col text-left">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <DialogHeader className="border-b border-border/20 pb-4 mb-4 text-left sm:text-left">
          <DialogTitle className="text-foreground text-base font-black flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            Edit Candidates — {dateStr}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Review the daily podium and candidate list for this date
          </DialogDescription>
        </DialogHeader>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {!entry ? (
            <div className="p-8 text-center text-muted-foreground italic text-sm">
              No scanning data or entries recorded for this date.
            </div>
          ) : (
            <>
              {/* Podium View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Winner */}
                <div className="border border-amber-500/25 bg-amber-500/5 rounded-xl p-4 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black bg-amber-500 text-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Winner
                    </span>
                    {entry.winnerScore !== null && entry.winnerScore !== undefined && (
                      <span className="text-xs font-mono font-bold text-amber-500">
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
                        <h5 className="font-bold text-foreground text-sm">{entry.winnerUser}</h5>
                      </div>
                      {entry.winnerPage && (
                        <Link
                          href={`/w/${encodeURIComponent(entry.winnerPage)}`}
                          className="text-xs text-amber-500 hover:underline block truncate"
                        >
                          {entry.winnerPage}
                        </Link>
                      )}
                      {entry.winnerBytes !== null && entry.winnerBytes !== undefined && (
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          +{entry.winnerBytes.toLocaleString()} bytes
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No Winner Assigned</span>
                  )}
                </div>

                {/* Runner-up */}
                <div className="border border-border/40 bg-card/45 rounded-xl p-4 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black bg-muted text-muted-foreground px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Runner-up
                    </span>
                    {entry.runnerUpScore !== null && entry.runnerUpScore !== undefined && (
                      <span className="text-xs font-mono font-bold text-foreground/80">
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
                        <h5 className="font-bold text-foreground text-sm text-foreground/90">
                          {entry.runnerUpUser}
                        </h5>
                      </div>
                      {entry.runnerUpPage && (
                        <Link
                          href={`/w/${encodeURIComponent(entry.runnerUpPage)}`}
                          className="text-xs text-muted-foreground hover:underline block truncate"
                        >
                          {entry.runnerUpPage}
                        </Link>
                      )}
                      {entry.runnerUpBytes !== null && entry.runnerUpBytes !== undefined && (
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          +{entry.runnerUpBytes.toLocaleString()} bytes
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      No Runner-up Assigned
                    </span>
                  )}
                </div>
              </div>

              {/* Candidates list table */}
              <div className="space-y-2">
                <h5 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <List className="w-4 h-4 text-amber-500" />
                  Scanned Candidates
                </h5>
                <div className="border border-border/30 rounded-xl overflow-hidden bg-muted/20 dark:bg-black/15 backdrop-blur-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 dark:bg-black/30 text-muted-foreground text-[10px] font-black uppercase tracking-wider border-b border-border/20">
                      <tr>
                        <th className="p-3 font-semibold text-muted-foreground">User</th>
                        <th className="p-3 font-semibold text-muted-foreground">Page / Edit</th>
                        <th className="p-3 text-right font-semibold text-muted-foreground">Bytes</th>
                        <th className="p-3 text-right font-semibold text-muted-foreground">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10 dark:divide-border/20">
                      {entry.candidates && entry.candidates.length > 0 ? (
                        entry.candidates.map((cand) => (
                          <tr
                            key={`${cand.user}-${cand.page}`}
                            className="hover:bg-muted/30 dark:hover:bg-white/5 transition-colors"
                          >
                            <td className="p-3 font-bold flex items-center gap-2 text-foreground">
                              <UnifiedCountryFlag
                                countryName={cand.user}
                                size="xs"
                                showTooltip={false}
                              />
                              {cand.user}
                            </td>
                            <td className="p-3 truncate max-w-[200px] text-muted-foreground">
                              {cand.page ? (
                                <Link
                                  href={`/w/${encodeURIComponent(cand.page)}`}
                                  className="text-amber-600 dark:text-amber-500/80 hover:underline hover:text-amber-500 font-medium"
                                >
                                  {cand.page}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground italic">No page</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-muted-foreground dark:text-muted-foreground/95">
                              {cand.bytesAdded !== undefined
                                ? `+${cand.bytesAdded.toLocaleString()}`
                                : "—"}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-foreground">
                              {cand.score !== undefined ? Math.round(cand.score) : "—"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-muted-foreground italic">
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
                <div className="border-t border-border/20 pt-4 flex justify-between items-center gap-2">
                  <div className="text-xs text-muted-foreground">Admin quick controls:</div>
                  <Link href="/admin/wiki?tab=lorewards">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-500/35 hover:bg-amber-500/10 text-amber-500"
                    >
                      <Sliders className="w-3.5 h-3.5 mr-1.5" />
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
