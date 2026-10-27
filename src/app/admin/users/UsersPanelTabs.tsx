"use client";
// The Discord sync and country claims tabs of UsersPanel.tsx (the panel owns queries and mutations).

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { TabsContent } from "~/components/ui/tabs";
import { Link as LinkIcon, Sparks as Sparkles, Play } from "iconoir-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";

import type { RouterOutputs } from "~/trpc/react";

type ApplyAutoAssignments = ReturnType<typeof api.admin.applyDiscordAutoAssignments.useMutation>;
type LinkDiscord = ReturnType<typeof api.admin.linkUserDiscord.useMutation>;
type UnassignCountry = ReturnType<typeof api.admin.unassignUserFromCountry.useMutation>;

export function DiscordSyncTab({
  discordSyncData,
  discordSyncLoading,
  applyDiscordAutoAssignments,
  linkDiscordMutation,
}: {
  discordSyncData: RouterOutputs["admin"]["syncDiscordGuildMembers"] | undefined;
  discordSyncLoading: boolean;
  applyDiscordAutoAssignments: ApplyAutoAssignments;
  linkDiscordMutation: LinkDiscord;
}) {
  return (
    <TabsContent value="discord-sync" className="mt-4 space-y-4">
      <Card className="p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-label text-headline">Discord server member discovery</h3>
            <p className="text-label-secondary text-footnote">
              Queries Ixnay Discord guild via bot token, parses server nicknames like{" "}
              <code>[Urcea] John</code>, and matches them to nations.
            </p>
          </div>

          {discordSyncData?.suggestions && discordSyncData.suggestions.length > 0 && (
            <Button
              size="sm"
              onClick={() => {
                const assignments = discordSyncData.suggestions.map((s) => ({
                  userId: s.matchedUserId,
                  discordUserId: s.discordUserId,
                  discordUsername: s.discordUsername,
                }));
                applyDiscordAutoAssignments.mutate({ assignments });
              }}
              disabled={applyDiscordAutoAssignments.isPending}
              className="gap-2"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto-Assign All ({discordSyncData.suggestions.length})
            </Button>
          )}
        </div>

        {discordSyncLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="rounded-row h-14 w-full" />
            ))}
          </div>
        ) : discordSyncData?.error ? (
          <div className="rounded-row border-yellow/30 bg-yellow/10 text-footnote text-yellow border p-4">
            ⚠️ {discordSyncData.error}
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h4 className="text-label text-subhead mb-2">
                High Confidence Match Candidates ({discordSyncData?.suggestions.length || 0})
              </h4>
              {discordSyncData?.suggestions.length === 0 ? (
                <p className="text-label-secondary text-footnote py-2 italic">
                  No unlinked high-confidence candidates found.
                </p>
              ) : (
                <div className="divide-separator border-separator bg-fill-3 rounded-row divide-y border p-2">
                  {discordSyncData?.suggestions.map((s) => (
                    <div
                      key={s.discordUserId}
                      className="flex items-center justify-between px-2 py-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-label font-semibold">@{s.discordUsername}</span>
                          {s.discordNick && <Badge variant="default">Nick: {s.discordNick}</Badge>}
                          <Badge variant="success">Match: {s.matchedCountryName}</Badge>
                        </div>
                        <div className="text-label-secondary text-footnote">{s.reason}</div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          linkDiscordMutation.mutate({
                            userId: s.matchedUserId,
                            discordUserId: s.discordUserId,
                            discordUsername: s.discordUsername,
                          });
                        }}
                      >
                        Accept link
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </TabsContent>
  );
}

export function CountryClaimsTab({
  countriesWithUsers,
  activePlayAs,
  handleStartPlayAs,
  handleStopPlayAs,
  setIsAssignDialogOpen,
  unassignCountryMutation,
}: {
  countriesWithUsers: RouterOutputs["admin"]["listCountriesWithUsers"] | undefined;
  activePlayAs: string | null;
  handleStartPlayAs: (clerkUserId: string, nationName?: string | null) => void;
  handleStopPlayAs: () => void;
  setIsAssignDialogOpen: (open: boolean) => void;
  unassignCountryMutation: UnassignCountry;
}) {
  return (
    <TabsContent value="country-claims" className="mt-4 space-y-4">
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-label text-headline">Country claims & player overrides</h3>
            <p className="text-label-secondary text-footnote">
              Manage direct country assignments and VIP executive privileges.
            </p>
          </div>
          <Button size="sm" onClick={() => setIsAssignDialogOpen(true)} className="gap-2">
            <LinkIcon className="h-3.5 w-3.5" />
            Assign user to nation
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nation</TableHead>
              <TableHead>Assigned user</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {countriesWithUsers?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-label font-semibold">{c.name}</TableCell>
                <TableCell>
                  {c.user ? (
                    <span className="text-footnote font-mono">{c.user.clerkUserId}</span>
                  ) : (
                    <span className="text-label-secondary text-footnote italic">Unclaimed</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {c.user && (
                    <div className="flex items-center justify-end gap-2">
                      {activePlayAs === c.user.clerkUserId ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleStopPlayAs}
                          className="gap-1"
                        >
                          Active (Stop)
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartPlayAs(c.user!.clerkUserId, c.name)}
                          className="gap-1"
                        >
                          <Play className="text-tint h-2.5 w-2.5 fill-current" />
                          Play as
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          unassignCountryMutation.mutate({
                            userId: c.user!.clerkUserId,
                            countryId: c.id,
                          });
                        }}
                        className="text-destructive"
                      >
                        Unassign
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </TabsContent>
  );
}
