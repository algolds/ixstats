"use client";
// src/app/admin/user-roles/UserRolesPanel.tsx
// Role Definitions & VIP Invitation Management

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
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
  DialogTrigger,
  DialogFooter,
} from "~/components/ui/dialog";
import { Shield, Search, Sparks as Sparkles, Group as Users, Mail } from "iconoir-react";
import { Switch } from "~/components/ui/switch";
import { useNotify } from "~/hooks/useNotify";
import { useAbility, Can } from "~/components/providers/AbilityProvider";
import { PageHeader } from "~/components/shell/PageHeader";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card } from "~/components/ui/card";

const SYSTEM_ROLES = [
  {
    name: "owner",
    displayName: "System Owner",
    level: 0,
    description:
      "Unrestricted root platform superadmin privileges across all realms and databases.",
    permissions: "Full Read/Write, God-Mode, Schema Evolution, Bypass Limits",
  },
  {
    name: "admin",
    displayName: "Platform Administrator",
    level: 10,
    description: "Admin panel access, nation moderation, policy calibration, and user bindings.",
    permissions: "Admin Access, Nation Calibration, Issue Resolution, Moderator Tools",
  },
  {
    name: "user",
    displayName: "Standard Player",
    level: 100,
    description: "Standard gameplay simulation capabilities within assigned nation realm.",
    permissions: "Executive Dashboard, Diplomacy, Domestic Policies, Vault Actions",
  },
];

export function UserRolesPanel() {
  usePageTitle({ title: "Admin - User Roles & Invitations" });

  const notify = useNotify();
  const ability = useAbility();
  const [searchTerm, setSearchTerm] = useState("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    emailAddress: "",
    reservedNationName: "",
    role: "user" as "admin" | "user" | "owner",
  });

  const {
    data: usersWithCountries,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = api.admin.listUsersWithCountries.useQuery();

  const inviteUserMutation = api.admin.inviteUserToBypassWaitlist.useMutation({
    onSuccess: (result) => {
      notify.success("Success", result.message || "Invitation sent successfully");
      setShowInviteDialog(false);
      setInviteForm({
        emailAddress: "",
        reservedNationName: "",
        role: "user",
      });
    },
    onError: (error: { message?: string }) => {
      notify.error("Error", error.message || "Failed to send invitation");
    },
  });

  const updateMembershipTier = api.users.updateMembershipTier.useMutation({
    onSuccess: () => {
      notify.success("Success", "Updated membership tier");
      void refetchUsers();
    },
    onError: (error: { message?: string }) => {
      notify.error("Error", error.message || "Failed to update membership tier");
    },
  });

  const handleSendInvite = () => {
    if (!inviteForm.emailAddress || !inviteForm.reservedNationName) {
      notify.error("Validation Error", "Email address and reserved nation name are required");
      return;
    }
    inviteUserMutation.mutate(inviteForm);
  };

  const filteredUsers = usersWithCountries?.filter((user) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      user.clerkUserId.toLowerCase().includes(q) || user.country?.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles and permissions"
        subtitle="Role hierarchy, VIP invitations and membership elevation audit."
      />

      <Tabs defaultValue="roles" className="w-full">
        <TabsList className="bg-fill-3 flex w-full max-w-md justify-start gap-1 rounded-full p-1">
          <TabsTrigger
            value="roles"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Shield className="text-teal h-4 w-4" />
            System roles
          </TabsTrigger>
          <TabsTrigger
            value="memberships"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Users className="text-purple h-4 w-4" />
            Account elevation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-4 space-y-4 focus-visible:outline-none">
          <Card className="space-y-4 p-5">
            <div className="border-separator flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-label text-caption">Configured system roles</h3>
                <p className="text-label-secondary text-footnote mt-0.5">
                  Hierarchy levels and attached permission profiles
                </p>
              </div>
              <Can I="manage" a="Role">
                <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Mail className="mr-2 h-3.5 w-3.5" />
                      Invite VIP / Role
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Send waitlist bypass invitation</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                      <div className="space-y-2">
                        <label className="text-label text-caption">Email address</label>
                        <Input
                          type="email"
                          value={inviteForm.emailAddress}
                          onChange={(e) =>
                            setInviteForm({ ...inviteForm, emailAddress: e.target.value })
                          }
                          placeholder="player@domain.com"
                          className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-label text-caption">Reserved nation name</label>
                        <Input
                          value={inviteForm.reservedNationName}
                          onChange={(e) =>
                            setInviteForm({ ...inviteForm, reservedNationName: e.target.value })
                          }
                          placeholder="Kingdom of Solaria"
                          className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-label text-caption">Initial role</label>
                        <Select
                          value={inviteForm.role}
                          onValueChange={(val: "admin" | "user" | "owner") =>
                            setInviteForm({ ...inviteForm, role: val })
                          }
                        >
                          <SelectTrigger size="sm">
                            <SelectValue placeholder="Choose a role..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Standard Player (User)</SelectItem>
                            <SelectItem value="admin">Administrator (Admin)</SelectItem>
                            <SelectItem value="owner">System Owner (Owner)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowInviteDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSendInvite}
                        disabled={
                          inviteUserMutation.isPending ||
                          !inviteForm.emailAddress ||
                          !inviteForm.reservedNationName
                        }
                      >
                        {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Can>
            </div>

            <div className="space-y-2">
              {SYSTEM_ROLES.map((role) => (
                <div
                  key={role.name}
                  className="border-separator bg-fill-3 hover:border-separator rounded-row flex flex-col justify-between gap-2 border p-4 transition-colors sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-label text-caption">{role.displayName}</span>
                      <Badge
                        variant="outline"
                        className={
                          role.level === 0
                            ? "border-red/30 bg-red/10 text-footnote text-red"
                            : role.level === 10
                              ? "border-teal/30 bg-teal/10 text-footnote text-teal"
                              : "text-footnote"
                        }
                      >
                        Level {role.level}
                      </Badge>
                    </div>
                    <p className="text-label-secondary text-footnote mt-0.5">{role.description}</p>
                    <p className="text-label-secondary text-footnote mt-0.5 tabular-nums">
                      Permissions: {role.permissions}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="memberships" className="mt-4 space-y-4 focus-visible:outline-none">
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            {usersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="rounded-row h-14 w-full" />
                ))}
              </div>
            ) : !filteredUsers || filteredUsers.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-label-secondary text-footnote">No accounts found.</p>
              </Card>
            ) : (
              filteredUsers?.map((user) => (
                <Card
                  key={user.id}
                  className="hover:border-separator flex items-center justify-between p-4 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-label text-caption font-mono">{user.clerkUserId}</span>
                      <Badge
                        variant="outline"
                        className={
                          user.membershipTier === "mycountry_premium"
                            ? "border-purple/30 bg-purple/10 text-footnote text-purple"
                            : "text-footnote"
                        }
                      >
                        {user.membershipTier === "mycountry_premium"
                          ? "Executive Premium"
                          : "Basic Player"}
                      </Badge>
                    </div>
                    <span className="text-label-secondary text-footnote mt-0.5 block">
                      {user.country ? `Nation: ${user.country.name}` : "No Claimed Nation"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Sparkles className="text-purple h-3.5 w-3.5" />
                    <span className="text-label-secondary text-footnote">Premium</span>
                    <Switch
                      checked={user.membershipTier === "mycountry_premium"}
                      onCheckedChange={() =>
                        updateMembershipTier.mutate({
                          userId: user.clerkUserId,
                          tier:
                            user.membershipTier === "mycountry_premium"
                              ? "basic"
                              : "mycountry_premium",
                        })
                      }
                      disabled={updateMembershipTier.isPending || !ability.can("manage", "User")}
                      className="scale-90"
                    />
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
