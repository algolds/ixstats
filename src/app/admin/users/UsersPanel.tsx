"use client";
// src/app/admin/users/UsersPanel.tsx
// Master User Identity, MediaWiki Reconciliation, and Discord Bot Sync Control Center

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Link as LinkIcon,
  Search,
  Sparks as Sparkles,
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

export function UsersPanel() {
  usePageTitle({ title: "Admin - User Identity & Accounts Hub" });

  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<
    "identities" | "wiki-reconciliation" | "discord-sync" | "country-claims"
  >("identities");
  const [searchTerm, setSearchTerm] = useState("");

  // Impersonation state
  const [activePlayAs, setActivePlayAs] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkPlayAs = () => {
      const current = localStorage.getItem("ixstats.play_as_user");
      setActivePlayAs(current);
    };
    checkPlayAs();
    window.addEventListener("storage", checkPlayAs);
    window.addEventListener("ixstats-play-as-change", checkPlayAs);
    return () => {
      window.removeEventListener("storage", checkPlayAs);
      window.removeEventListener("ixstats-play-as-change", checkPlayAs);
    };
  }, []);

  const handleStartPlayAs = (clerkUserId: string, nationName?: string | null) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ixstats.play_as_user", clerkUserId);
    window.dispatchEvent(new Event("ixstats-play-as-change"));
    setActivePlayAs(clerkUserId);
    notify.success(
      "Impersonation Active",
      `Now playing as ${nationName ? `${nationName} (${clerkUserId})` : clerkUserId}. All tRPC queries & Halo will mirror this user.`
    );
  };

  const handleStopPlayAs = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("ixstats.play_as_user");
    window.dispatchEvent(new Event("ixstats-play-as-change"));
    setActivePlayAs(null);
    notify.info("Impersonation Stopped", "Restored administrative identity.");
  };

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

  // Mutations
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

  const _unlinkDiscordMutation = api.admin.unlinkUserDiscord.useMutation({
    onSuccess: () => {
      notify.success("Success", "Discord account unlinked");
      void refetchIdentities();
      void refetchDiscordSync();
    },
    onError: (err) => notify.error("Error", err.message || "Failed to unlink Discord account"),
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

  const _updateMembershipTier = api.users.updateMembershipTier.useMutation({
    onSuccess: () => {
      notify.success("Success", "Updated membership tier");
      void refetchIdentities();
    },
    onError: (err) => notify.error("Error", err.message || "Failed to update membership tier"),
  });

  // Filtered identities
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

      {/* Active Impersonation Session Banner */}
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

        {/* ================================================================= */}
        {/* TAB 1: MASTER IDENTITY MATRIX */}
        {/* ================================================================= */}
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

        {/* ================================================================= */}
        {/* TAB 2: WIKI RECONCILIATION & ALTS */}
        {/* ================================================================= */}
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
                            <Sparkles className="h-3 w-3" /> Alt Merged ({e.isAltFor})
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

        {/* ================================================================= */}
        {/* TAB 3: DISCORD BOT MEMBER SYNC */}
        {/* ================================================================= */}
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
                {/* Auto Match Suggestions */}
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
                              {s.discordNick && (
                                <Badge variant="default">Nick: {s.discordNick}</Badge>
                              )}
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

        {/* ================================================================= */}
        {/* TAB 4: COUNTRY CLAIMS & TIERS */}
        {/* ================================================================= */}
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
      </Tabs>

      {/* Manual Wiki Link Dialog */}
      <Dialog open={isWikiDialogOpen} onOpenChange={setIsWikiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link MediaWiki Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-label-secondary text-footnote">
              Enter the canonical MediaWiki username or known alt (e.g. <code>Kir</code>,{" "}
              <code>Carthinova</code>, <code>Urcea</code>).
            </p>
            <Input
              placeholder="MediaWiki Username..."
              value={wikiUsernameInput}
              onChange={(e) => setWikiUsernameInput(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsWikiDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!wikiUsernameInput) return;
                linkWikiMutation.mutate({
                  userId: selectedUser,
                  wikiUsername: wikiUsernameInput,
                });
              }}
              disabled={linkWikiMutation.isPending}
            >
              Save link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Discord Link Dialog */}
      <Dialog open={isDiscordDialogOpen} onOpenChange={setIsDiscordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Discord identity</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-label-secondary text-footnote">
              Enter the Discord username and numeric snowflake ID.
            </p>
            <Input
              placeholder="Discord Username (e.g. username)..."
              value={discordUsernameInput}
              onChange={(e) => setDiscordUsernameInput(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
            />
            <Input
              placeholder="Discord Snowflake User ID (e.g. 123456789012345678)..."
              value={discordUserIdInput}
              onChange={(e) => setDiscordUserIdInput(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsDiscordDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!discordUsernameInput || !discordUserIdInput) return;
                linkDiscordMutation.mutate({
                  userId: selectedUser,
                  discordUsername: discordUsernameInput,
                  discordUserId: discordUserIdInput,
                });
              }}
              disabled={linkDiscordMutation.isPending}
            >
              Save Discord link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Country Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign country to user</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {userIdentities?.map((u) => (
                  <SelectItem key={u.id} value={u.clerkUserId} className="text-footnote">
                    {u.clerkUserId} {u.country ? `(${u.country.name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Select a nation..." />
              </SelectTrigger>
              <SelectContent>
                {countriesWithUsers?.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-footnote">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!selectedUser || !selectedCountry) return;
                assignCountryMutation.mutate({
                  userId: selectedUser,
                  countryId: selectedCountry,
                });
              }}
              disabled={assignCountryMutation.isPending}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
