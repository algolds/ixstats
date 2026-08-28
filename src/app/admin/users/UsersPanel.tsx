"use client";
// src/app/admin/users/UsersPanel.tsx
// Master User Identity, MediaWiki Reconciliation, and Discord Bot Sync Control Center

import { useState } from "react";
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
  Group as Users,
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
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { AdminHeader } from "../_components/AdminHeader";
import { usePageTitle } from "~/hooks/usePageTitle";

export function UsersPanel() {
  usePageTitle({ title: "Admin - User Identity & Accounts Hub" });

  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<
    "identities" | "wiki-reconciliation" | "discord-sync" | "country-claims"
  >("identities");
  const [searchTerm, setSearchTerm] = useState("");

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

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Users}
        title="User Identity & Accounts Hub"
        description="Comprehensive cross-platform identity management: MediaWiki reconciliation, Discord bot sync, nation linkage, and system roles."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="bg-muted/40 border-border/30 h-9 p-1 backdrop-blur-md">
            <TabsTrigger value="identities" className="text-xs">
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Master Identity Matrix
            </TabsTrigger>
            <TabsTrigger value="wiki-reconciliation" className="text-xs">
              <WikiIcon className="mr-1.5 h-3.5 w-3.5" />
              Wiki Reconciliation & Alts
            </TabsTrigger>
            <TabsTrigger value="discord-sync" className="text-xs">
              <DiscordIcon className="mr-1.5 h-3.5 w-3.5" />
              Discord Bot Member Sync
            </TabsTrigger>
            <TabsTrigger value="country-claims" className="text-xs">
              <Crown className="mr-1.5 h-3.5 w-3.5" />
              Country Claims & Tiers
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Search across all identities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-border/30 bg-background/50 h-8 rounded-xl pl-8 text-xs backdrop-blur-md"
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
              className="h-8 gap-1 rounded-xl text-xs"
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
          <div className="border-border/40 bg-card/40 rounded-2xl border p-4 shadow-xs backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-foreground text-sm font-semibold">
                  Registered User Identities
                </h3>
                <p className="text-muted-foreground text-xs">
                  Showing {filteredIdentities?.length ?? 0} registered user profiles with unified
                  cross-platform linkages.
                </p>
              </div>
            </div>

            {identitiesLoading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="divide-border/20 divide-y overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-border/30 border-b pb-2">
                      <th className="py-2.5 font-medium">User / Clerk ID</th>
                      <th className="py-2.5 font-medium">Claimed Nation</th>
                      <th className="py-2.5 font-medium">MediaWiki Account</th>
                      <th className="py-2.5 font-medium">Discord Identity</th>
                      <th className="py-2.5 font-medium">Role & Tier</th>
                      <th className="py-2.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/20 divide-y">
                    {filteredIdentities?.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[10px] font-bold">
                              {u.country?.name
                                ? u.country.name.substring(0, 2).toUpperCase()
                                : "US"}
                            </div>
                            <div>
                              <div className="text-foreground font-mono text-[11px] font-semibold">
                                {u.clerkUserId}
                              </div>
                              <div className="text-muted-foreground text-[10px]">
                                ID: {u.id.substring(0, 10)}...
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3">
                          {u.country ? (
                            <Badge
                              variant="outline"
                              className="border-border/40 bg-background/50 font-medium"
                            >
                              {u.country.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[11px] italic">
                              No nation claimed
                            </span>
                          )}
                        </td>

                        <td className="py-3">
                          {u.wikiUsername ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="secondary"
                                  className="bg-wiki/15 text-wiki border-wiki/30 font-semibold"
                                >
                                  {u.wikiUsername}
                                </Badge>
                                {u.wikiUserId && (
                                  <span className="text-muted-foreground text-[10px]">
                                    #{u.wikiUserId}
                                  </span>
                                )}
                              </div>
                              {u.wikiAlts && u.wikiAlts.length > 0 && (
                                <div className="text-muted-foreground text-[10px]">
                                  Alts:{" "}
                                  <span className="text-foreground">{u.wikiAlts.join(", ")}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Unlinked</span>
                          )}
                        </td>

                        <td className="py-3">
                          {u.discordUsername ? (
                            <div className="space-y-0.5">
                              <Badge
                                variant="secondary"
                                className="bg-discord/15 text-discord border-discord/30 font-medium"
                              >
                                @{u.discordUsername}
                              </Badge>
                              {u.discordUserId && (
                                <div className="text-muted-foreground font-mono text-[9px]">
                                  ID: {u.discordUserId}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Unlinked</span>
                          )}
                        </td>

                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {u.role?.name || "Member"}
                            </Badge>
                            {u.membershipTier === "mycountry_premium" && (
                              <Badge className="border-amber-500/30 bg-amber-500/20 text-[10px] text-amber-500">
                                VIP
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(u.id);
                                setWikiUsernameInput(u.wikiUsername || "");
                                setIsWikiDialogOpen(true);
                              }}
                              className="h-7 px-2 text-[11px]"
                            >
                              Wiki Link
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
                              className="h-7 px-2 text-[11px]"
                            >
                              Discord
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: WIKI RECONCILIATION & ALTS */}
        {/* ================================================================= */}
        <TabsContent value="wiki-reconciliation" className="mt-4 space-y-4">
          <div className="border-border/40 bg-card/40 rounded-2xl border p-4 shadow-xs backdrop-blur-xl">
            <div className="mb-4">
              <h3 className="text-foreground text-sm font-semibold">
                MediaWiki ↔ IxnayID Reconciliation Ledger
              </h3>
              <p className="text-muted-foreground text-xs">
                All 131 MediaWiki accounts cross-referenced with primary nation personas and active
                user profiles.
              </p>
            </div>

            {wikiMatrixLoading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="divide-border/20 divide-y overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-border/30 border-b pb-2">
                      <th className="py-2.5 font-medium">MediaWiki Account</th>
                      <th className="py-2.5 font-medium">Target Nation</th>
                      <th className="py-2.5 font-medium">Status & Confidence</th>
                      <th className="py-2.5 font-medium">Matched IxStates User</th>
                      <th className="py-2.5 font-medium">Notes / Aliases</th>
                      <th className="py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/20 divide-y">
                    {wikiMatrix?.entries?.map((e) => (
                      <tr key={e.wikiUsername} className="hover:bg-muted/20 transition-colors">
                        <td className="text-foreground py-3 font-semibold">{e.wikiUsername}</td>
                        <td className="py-3">
                          <Badge variant="outline" className="border-border/40 font-medium">
                            {e.targetCountry}
                          </Badge>
                        </td>
                        <td className="py-3">
                          {e.status === "ALREADY_LINKED" && (
                            <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <CheckCircle className="h-3 w-3" /> Linked & Verified
                            </Badge>
                          )}
                          {e.status === "ALT_MERGED" && (
                            <Badge className="gap-1 border-blue-500/30 bg-blue-500/20 text-[10px] text-blue-600 dark:text-blue-400">
                              <Sparkles className="h-3 w-3" /> Alt Merged ({e.isAltFor})
                            </Badge>
                          )}
                          {e.status === "READY_TO_LINK" && (
                            <Badge className="gap-1 border-amber-500/30 bg-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400">
                              <WarningCircle className="h-3 w-3" /> Ready to Link
                            </Badge>
                          )}
                          {e.status === "UNMATCHED_USER" && (
                            <Badge variant="outline" className="text-muted-foreground text-[10px]">
                              Awaiting User Claim
                            </Badge>
                          )}
                        </td>
                        <td className="py-3">
                          {e.matchedUser ? (
                            <div>
                              <div className="font-mono text-[11px] font-medium">
                                {e.matchedUser.clerkUserId}
                              </div>
                              <div className="text-muted-foreground text-[10px]">
                                {e.matchedUser.countryName}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px] italic">—</span>
                          )}
                        </td>
                        <td className="text-muted-foreground py-3 text-[11px]">{e.notes || "—"}</td>
                        <td className="py-3 text-right">
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
                              className="h-7 rounded-lg text-[11px]"
                            >
                              1-Click Link
                            </Button>
                          )}
                          {e.status === "ALREADY_LINKED" && e.matchedUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                unlinkWikiMutation.mutate({ userId: e.matchedUser!.id });
                              }}
                              className="text-destructive h-7 text-[11px]"
                            >
                              Unlink
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 3: DISCORD BOT MEMBER SYNC */}
        {/* ================================================================= */}
        <TabsContent value="discord-sync" className="mt-4 space-y-4">
          <div className="border-border/40 bg-card/40 rounded-2xl border p-4 shadow-xs backdrop-blur-xl">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-foreground text-sm font-semibold">
                  Discord Server Member Discovery
                </h3>
                <p className="text-muted-foreground text-xs">
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
                  className="h-8 gap-1.5 rounded-xl text-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-Assign All ({discordSyncData.suggestions.length})
                </Button>
              )}
            </div>

            {discordSyncLoading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : discordSyncData?.error ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400">
                ⚠️ {discordSyncData.error}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Auto Match Suggestions */}
                <div>
                  <h4 className="text-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                    High Confidence Match Candidates ({discordSyncData?.suggestions.length || 0})
                  </h4>
                  {discordSyncData?.suggestions.length === 0 ? (
                    <p className="text-muted-foreground py-2 text-xs italic">
                      No unlinked high-confidence candidates found.
                    </p>
                  ) : (
                    <div className="divide-border/20 border-border/30 bg-background/30 divide-y rounded-xl border p-2">
                      {discordSyncData?.suggestions.map((s) => (
                        <div
                          key={s.discordUserId}
                          className="flex items-center justify-between px-2 py-2.5"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-foreground font-semibold">
                                @{s.discordUsername}
                              </span>
                              {s.discordNick && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Nick: {s.discordNick}
                                </Badge>
                              )}
                              <Badge className="border-emerald-500/30 bg-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400">
                                Match: {s.matchedCountryName}
                              </Badge>
                            </div>
                            <div className="text-muted-foreground text-[10px]">{s.reason}</div>
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
                            className="h-7 rounded-lg text-[11px]"
                          >
                            Accept Link
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 4: COUNTRY CLAIMS & TIERS */}
        {/* ================================================================= */}
        <TabsContent value="country-claims" className="mt-4 space-y-4">
          <div className="border-border/40 bg-card/40 rounded-2xl border p-4 shadow-xs backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-foreground text-sm font-semibold">
                  Country Claims & Player Overrides
                </h3>
                <p className="text-muted-foreground text-xs">
                  Manage direct country assignments and VIP executive privileges.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsAssignDialogOpen(true)}
                className="h-8 gap-1.5 rounded-xl text-xs"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Assign User to Nation
              </Button>
            </div>

            <div className="divide-border/20 divide-y overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-muted-foreground border-border/30 border-b pb-2">
                    <th className="py-2.5 font-medium">Nation</th>
                    <th className="py-2.5 font-medium">Assigned User</th>
                    <th className="py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-border/20 divide-y">
                  {countriesWithUsers?.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="text-foreground py-2.5 font-semibold">{c.name}</td>
                      <td className="py-2.5">
                        {c.user ? (
                          <span className="font-mono text-[11px]">{c.user.clerkUserId}</span>
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">
                            Unclaimed
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {c.user && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              unassignCountryMutation.mutate({
                                userId: c.user!.clerkUserId,
                                countryId: c.id,
                              });
                            }}
                            className="text-destructive h-6 text-[10px]"
                          >
                            Unassign
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Manual Wiki Link Dialog */}
      <Dialog open={isWikiDialogOpen} onOpenChange={setIsWikiDialogOpen}>
        <DialogContent className="border-border/40 bg-card/90 rounded-2xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Link MediaWiki Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-muted-foreground text-xs">
              Enter the canonical MediaWiki username or known alt (e.g. <code>Kir</code>,{" "}
              <code>Carthinova</code>, <code>Urcea</code>).
            </p>
            <Input
              placeholder="MediaWiki Username..."
              value={wikiUsernameInput}
              onChange={(e) => setWikiUsernameInput(e.target.value)}
              className="text-xs"
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
              Save Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Discord Link Dialog */}
      <Dialog open={isDiscordDialogOpen} onOpenChange={setIsDiscordDialogOpen}>
        <DialogContent className="border-border/40 bg-card/90 rounded-2xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Link Discord Identity</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-muted-foreground text-xs">
              Enter the Discord username and numeric snowflake ID.
            </p>
            <Input
              placeholder="Discord Username (e.g. username)..."
              value={discordUsernameInput}
              onChange={(e) => setDiscordUsernameInput(e.target.value)}
              className="text-xs"
            />
            <Input
              placeholder="Discord Snowflake User ID (e.g. 123456789012345678)..."
              value={discordUserIdInput}
              onChange={(e) => setDiscordUserIdInput(e.target.value)}
              className="text-xs"
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
              Save Discord Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Country Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="border-border/40 bg-card/90 rounded-2xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Assign Country to User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {userIdentities?.map((u) => (
                  <SelectItem key={u.id} value={u.clerkUserId} className="text-xs">
                    {u.clerkUserId} {u.country ? `(${u.country.name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select a nation..." />
              </SelectTrigger>
              <SelectContent>
                {countriesWithUsers?.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
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
