"use client";
// Master User Identity, MediaWiki Reconciliation, and Discord Bot Sync Control Center

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Search,
  Book as WikiIcon,
  ChatBubble as DiscordIcon,
  CheckCircle,
  WarningCircle,
  RefreshDouble,
  Shield,
  Crown,
  Play,
  LogOut,
  Globe,
  Dashboard as LayoutDashboard,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { PageHeader } from "~/components/shell/PageHeader";
import { usePageTitle } from "~/hooks/usePageTitle";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";
import { AssignCountryDialog, LinkDiscordDialog, LinkWikiDialog } from "./UsersPanelDialogs";
import { CountryClaimsTab, DiscordSyncTab } from "./UsersPanelTabs";
import { usePlayAs } from "./usePlayAs";

export function UsersPanel() {
  usePageTitle({ title: "Admin - User Identity & Accounts Hub" });

  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<
    "identities" | "wiki-reconciliation" | "discord-sync" | "country-claims"
  >("identities");
  const [searchTerm, setSearchTerm] = useState("");

  const { activePlayAs, handleStartPlayAs, handleStopPlayAs } = usePlayAs();

  // Modals state
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [wikiUsernameInput, setWikiUsernameInput] = useState("");
  const [discordUsernameInput, setDiscordUsernameInput] = useState("");
  const [discordUserIdInput, setDiscordUserIdInput] = useState("");
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isWikiDialogOpen, setIsWikiDialogOpen] = useState(false);
  const [isDiscordDialogOpen, setIsDiscordDialogOpen] = useState(false);

  // Queries
  const {
    data: userIdentities,
    isLoading: identitiesLoading,
    refetch: refetchIdentities,
  } = api.admin.listUserIdentities.useQuery();

  const {
    data: wikiMatrix,
    isLoading: wikiMatrixLoading,
    refetch: refetchWikiMatrix,
  } = api.admin.listMediaWikiReconciliationMatrix.useQuery();

  const {
    data: discordSyncData,
    isLoading: discordSyncLoading,
    refetch: refetchDiscordSync,
  } = api.admin.syncDiscordGuildMembers.useQuery(undefined, {
    enabled: activeTab === "discord-sync",
  });

  const { data: countriesWithUsers, refetch: refetchCountries } =
    api.admin.listCountriesWithUsers.useQuery();

  const linkWikiMutation = api.admin.linkUserWiki.useMutation({
    onSuccess: () => {
      notify.success("Success", "MediaWiki account successfully linked");
      void refetchIdentities();
      void refetchWikiMatrix();
      setIsWikiDialogOpen(false);
      setWikiUsernameInput("");
    },
    onError: (err) => notify.error("Error", err.message || "Failed to link Wiki account"),
  });

  const unlinkWikiMutation = api.admin.unlinkUserWiki.useMutation({
    onSuccess: () => {
      notify.success("Success", "MediaWiki account unlinked");
      void refetchIdentities();
      void refetchWikiMatrix();
    },
    onError: (err) => notify.error("Error", err.message || "Failed to unlink Wiki account"),
  });

  const linkDiscordMutation = api.admin.linkUserDiscord.useMutation({
    onSuccess: () => {
      notify.success("Success", "Discord account successfully linked");
      void refetchIdentities();
      void refetchDiscordSync();
      setIsDiscordDialogOpen(false);
      setDiscordUsernameInput("");
      setDiscordUserIdInput("");
    },
    onError: (err) => notify.error("Error", err.message || "Failed to link Discord account"),
  });

  const applyDiscordAutoAssignments = api.admin.applyDiscordAutoAssignments.useMutation({
    onSuccess: (res) => {
      notify.success(
        "Applied Auto-Assignments",
        `Successfully linked ${res.appliedCount} Discord accounts.`
      );
      void refetchIdentities();
      void refetchDiscordSync();
    },
    onError: (err) =>
      notify.error("Error", err.message || "Failed to auto-assign Discord accounts"),
  });

  const assignCountryMutation = api.admin.assignUserToCountry.useMutation({
    onSuccess: () => {
      notify.success("Success", "User linked to country");
      void refetchIdentities();
      void refetchCountries();
      setIsAssignDialogOpen(false);
    },
    onError: (err) => notify.error("Error", err.message || "Failed to link country"),
  });

  const unassignCountryMutation = api.admin.unassignUserFromCountry.useMutation({
    onSuccess: () => {
      notify.success("Success", "User unlinked from country");
      void refetchIdentities();
      void refetchCountries();
    },
    onError: (err) => notify.error("Error", err.message || "Failed to unlink country"),
  });

  const filteredIdentities = userIdentities?.filter((user) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.clerkUserId.toLowerCase().includes(search) ||
      (user.country?.name || "").toLowerCase().includes(search) ||
      (user.wikiUsername || "").toLowerCase().includes(search) ||
      (user.discordUsername || "").toLowerCase().includes(search) ||
      (user.forumUsername || "").toLowerCase().includes(search)
    );
  });

  const activeImpersonatedIdentity = userIdentities?.find((u) => u.clerkUserId === activePlayAs);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users and accounts"
        subtitle="MediaWiki reconciliation, Discord sync, nation links and system roles."
      />

      {activePlayAs && (
        <div className="rounded-card border-red/40 bg-red/10 flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="bg-red absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
              <span className="bg-red relative inline-flex h-3 w-3 rounded-full"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-eyebrow text-red">Active admin impersonation session</span>
                <Badge variant="destructive">Playing as</Badge>
              </div>
              <p className="text-footnote text-label mt-0.5">
                Simulating user identity:{" "}
                <strong className="text-red font-semibold tabular-nums">{activePlayAs}</strong>
                {activeImpersonatedIdentity?.country?.name && (
                  <span className="text-label-secondary">
                    {" "}
                    (claimed nation:{" "}
                    <strong className="text-label">
                      {activeImpersonatedIdentity.country.name}
                    </strong>
                    )
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="gap-2"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Open dashboard
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = "/mycountry";
              }}
              className="gap-2"
            >
              <Globe className="h-3.5 w-3.5" />
              Open MyCountry
            </Button>
            <Button variant="destructive" size="sm" onClick={handleStopPlayAs} className="gap-2">
              <LogOut className="h-3.5 w-3.5" />
              Stop impersonation
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="bg-fill-3 border-separator h-9 p-1">
            <TabsTrigger value="identities" className="text-footnote">
              <Shield className="mr-2 h-3.5 w-3.5" />
              Master identity matrix
            </TabsTrigger>
            <TabsTrigger value="wiki-reconciliation" className="text-footnote">
              <WikiIcon className="mr-2 h-3.5 w-3.5" />
              Wiki reconciliation & alts
            </TabsTrigger>
            <TabsTrigger value="discord-sync" className="text-footnote">
              <DiscordIcon className="mr-2 h-3.5 w-3.5" />
              Discord bot member sync
            </TabsTrigger>
            <TabsTrigger value="country-claims" className="text-footnote">
              <Crown className="mr-2 h-3.5 w-3.5" />
              Country claims & tiers
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Search across all identities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchIdentities();
                void refetchWikiMatrix();
                if (activeTab === "discord-sync") void refetchDiscordSync();
              }}
              className="gap-1"
            >
              <RefreshDouble className="h-3.5 w-3.5" />
              Sync
            </Button>
          </div>
        </div>

        {/* TAB 1: MASTER IDENTITY MATRIX */}
        <TabsContent value="identities" className="mt-4 space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-label text-headline">Registered user identities</h3>
                <p className="text-label-secondary text-footnote">
                  Showing {filteredIdentities?.length ?? 0} registered user profiles with unified
                  cross-platform linkages.
                </p>
              </div>
            </div>

            {identitiesLoading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="rounded-row h-14 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User / Clerk ID</TableHead>
                    <TableHead>Claimed nation</TableHead>
                    <TableHead>MediaWiki Account</TableHead>
                    <TableHead>Discord identity</TableHead>
                    <TableHead>Role & tier</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIdentities?.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="bg-tint-fill text-tint rounded-control text-caption flex h-7 w-7 items-center justify-center font-mono">
                            {u.country?.name ? u.country.name.substring(0, 2).toUpperCase() : "US"}
                          </div>
                          <div>
                            <div className="text-label text-caption font-mono">{u.clerkUserId}</div>
                            <div className="text-label-secondary text-footnote">
                              ID: {u.id.substring(0, 10)}...
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {u.country ? (
                          <Badge
                            variant="outline"
                            className="border-separator bg-fill-3 font-medium"
                          >
                            {u.country.name}
                          </Badge>
                        ) : (
                          <span className="text-label-secondary text-footnote italic">
                            No nation claimed
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        {u.wikiUsername ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="default"
                                className="bg-wiki/15 text-wiki border-wiki/30 font-semibold"
                              >
                                {u.wikiUsername}
                              </Badge>
                              {u.wikiUserId && (
                                <span className="text-label-secondary text-footnote">
                                  #{u.wikiUserId}
                                </span>
                              )}
                            </div>
                            {u.wikiAlts && u.wikiAlts.length > 0 && (
                              <div className="text-label-secondary text-footnote">
                                Alts: <span className="text-label">{u.wikiAlts.join(", ")}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-label-secondary text-footnote">Unlinked</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {u.discordUsername ? (
                          <div className="space-y-0.5">
                            <Badge
                              variant="default"
                              className="bg-discord/15 text-discord border-discord/30 font-medium"
                            >
                              @{u.discordUsername}
                            </Badge>
                            {u.discordUserId && (
                              <div className="text-label-secondary text-footnote font-mono">
                                ID: {u.discordUserId}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-label-secondary text-footnote">Unlinked</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {u.role?.name || "Member"}
                          </Badge>
                          {u.membershipTier === "mycountry_premium" && (
                            <Badge variant="warning">VIP</Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {activePlayAs === u.clerkUserId ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleStopPlayAs}
                              className="gap-1"
                            >
                              <span className="bg-red h-1.5 w-1.5 rounded-full" />
                              Active (Stop)
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartPlayAs(u.clerkUserId, u.country?.name)}
                              className="gap-1"
                            >
                              <Play className="text-tint h-3 w-3 fill-current" />
                              Play as
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u.id);
                              setWikiUsernameInput(u.wikiUsername || "");
                              setIsWikiDialogOpen(true);
                            }}
                          >
                            Wiki link
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u.id);
                              setDiscordUsernameInput(u.discordUsername || "");
                              setDiscordUserIdInput(u.discordUserId || "");
                              setIsDiscordDialogOpen(true);
                            }}
                          >
                            Discord
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* TAB 2: WIKI RECONCILIATION & ALTS */}
        <TabsContent value="wiki-reconciliation" className="mt-4 space-y-4">
          <Card className="p-4">
            <div className="mb-4">
              <h3 className="text-label text-headline">
                MediaWiki ↔ IxnayID Reconciliation Ledger
              </h3>
              <p className="text-label-secondary text-footnote">
                All 131 MediaWiki accounts cross-referenced with primary nation personas and active
                user profiles.
              </p>
            </div>

            {wikiMatrixLoading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="rounded-row h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MediaWiki Account</TableHead>
                    <TableHead>Target nation</TableHead>
                    <TableHead>Status & confidence</TableHead>
                    <TableHead>Matched IxStates User</TableHead>
                    <TableHead>Notes / Aliases</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wikiMatrix?.entries?.map((e) => (
                    <TableRow key={e.wikiUsername}>
                      <TableCell className="text-label font-semibold">{e.wikiUsername}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-separator font-medium">
                          {e.targetCountry}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {e.status === "ALREADY_LINKED" && (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle className="h-3 w-3" /> Linked & verified
                          </Badge>
                        )}
                        {e.status === "ALT_MERGED" && (
                          <Badge variant="info" className="gap-1">
                            Alt Merged ({e.isAltFor})
                          </Badge>
                        )}
                        {e.status === "READY_TO_LINK" && (
                          <Badge variant="warning" className="gap-1">
                            <WarningCircle className="h-3 w-3" /> Ready to link
                          </Badge>
                        )}
                        {e.status === "UNMATCHED_USER" && (
                          <Badge variant="outline" className="text-label-secondary">
                            Awaiting user claim
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {e.matchedUser ? (
                          <div>
                            <div className="text-caption font-mono">
                              {e.matchedUser.clerkUserId}
                            </div>
                            <div className="text-label-secondary text-footnote">
                              {e.matchedUser.countryName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-label-secondary text-footnote italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-label-secondary text-footnote min-w-48 whitespace-normal">
                        {e.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {e.matchedUser &&
                            (activePlayAs === e.matchedUser.clerkUserId ? (
                              <Button variant="destructive" size="sm" onClick={handleStopPlayAs}>
                                Active (Stop)
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleStartPlayAs(
                                    e.matchedUser!.clerkUserId,
                                    e.matchedUser!.countryName
                                  )
                                }
                                className="gap-1"
                                title={`Play as ${e.matchedUser.clerkUserId}`}
                              >
                                <Play className="text-tint h-2.5 w-2.5 fill-current" />
                                Play as
                              </Button>
                            ))}
                          {e.matchedUser && e.status === "READY_TO_LINK" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                linkWikiMutation.mutate({
                                  userId: e.matchedUser!.id,
                                  wikiUsername: e.wikiUsername,
                                });
                              }}
                              disabled={linkWikiMutation.isPending}
                            >
                              1-Click Link
                            </Button>
                          )}
                          {e.status === "ALREADY_LINKED" && e.matchedUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                unlinkWikiMutation.mutate({
                                  userId: e.matchedUser!.id,
                                  source: "ixwiki",
                                });
                              }}
                              className="text-destructive"
                            >
                              Unlink
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <DiscordSyncTab
          discordSyncData={discordSyncData}
          discordSyncLoading={discordSyncLoading}
          applyDiscordAutoAssignments={applyDiscordAutoAssignments}
          linkDiscordMutation={linkDiscordMutation}
        />

        <CountryClaimsTab
          countriesWithUsers={countriesWithUsers}
          activePlayAs={activePlayAs}
          handleStartPlayAs={handleStartPlayAs}
          handleStopPlayAs={handleStopPlayAs}
          setIsAssignDialogOpen={setIsAssignDialogOpen}
          unassignCountryMutation={unassignCountryMutation}
        />
      </Tabs>

      <LinkWikiDialog
        open={isWikiDialogOpen}
        onOpenChange={setIsWikiDialogOpen}
        username={wikiUsernameInput}
        onUsernameChange={setWikiUsernameInput}
        pending={linkWikiMutation.isPending}
        onSubmit={() => {
          if (!wikiUsernameInput) return;
          linkWikiMutation.mutate({ userId: selectedUser, wikiUsername: wikiUsernameInput });
        }}
      />

      <LinkDiscordDialog
        open={isDiscordDialogOpen}
        onOpenChange={setIsDiscordDialogOpen}
        username={discordUsernameInput}
        onUsernameChange={setDiscordUsernameInput}
        discordUserId={discordUserIdInput}
        onDiscordUserIdChange={setDiscordUserIdInput}
        pending={linkDiscordMutation.isPending}
        onSubmit={() => {
          if (!discordUsernameInput || !discordUserIdInput) return;
          linkDiscordMutation.mutate({
            userId: selectedUser,
            discordUsername: discordUsernameInput,
            discordUserId: discordUserIdInput,
          });
        }}
      />

      <AssignCountryDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        userOptions={
          userIdentities?.map(
            (u) =>
              [u.clerkUserId, `${u.clerkUserId} ${u.country ? `(${u.country.name})` : ""}`] as const
          ) ?? []
        }
        selectedUser={selectedUser}
        onSelectedUserChange={setSelectedUser}
        countryOptions={countriesWithUsers?.map((c) => [c.id, c.name] as const) ?? []}
        selectedCountry={selectedCountry}
        onSelectedCountryChange={setSelectedCountry}
        pending={assignCountryMutation.isPending}
        onSubmit={() => {
          if (!selectedUser || !selectedCountry) return;
          assignCountryMutation.mutate({ userId: selectedUser, countryId: selectedCountry });
        }}
      />
    </div>
  );
}
