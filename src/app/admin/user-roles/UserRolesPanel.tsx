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
import { AdminHeader } from "../_components/AdminHeader";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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
      <AdminHeader
        icon={Shield}
        title="Role & Permission Systems"
        description="System roles hierarchy, VIP player invitations, and membership elevation auditing."
      />

      <Tabs defaultValue="roles" className="w-full">
        <TabsList className="bg-card/40 border-border/40 flex w-full max-w-md justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger
            value="roles"
            className="flex flex-1 items-center justify-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Shield className="h-4 w-4 text-cyan-400" />
            System Roles
          </TabsTrigger>
          <TabsTrigger
            value="memberships"
            className="flex flex-1 items-center justify-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Users className="h-4 w-4 text-purple-400" />
            Account Elevation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-4 space-y-4 focus-visible:outline-none">
          <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
            <div className="border-border/20 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-foreground text-xs font-bold">Configured System Roles</h3>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  Hierarchy levels and attached permission profiles
                </p>
              </div>
              <Can I="manage" a="Role">
                <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="h-8 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
                    >
                      <Mail className="mr-1.5 h-3.5 w-3.5" />
                      Invite VIP / Role
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border-border/30 bg-card/95 max-h-[85vh] max-w-md overflow-y-auto rounded-2xl backdrop-blur-md">
                    <DialogHeader>
                      <DialogTitle className="text-sm font-bold">
                        Send Waitlist Bypass Invitation
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                      <div className="space-y-1.5">
                        <label className="text-foreground text-xs font-medium">Email Address</label>
                        <Input
                          type="email"
                          value={inviteForm.emailAddress}
                          onChange={(e) =>
                            setInviteForm({ ...inviteForm, emailAddress: e.target.value })
                          }
                          placeholder="player@domain.com"
                          className="border-border/30 bg-background/50 h-8 rounded-xl text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-foreground text-xs font-medium">
                          Reserved Nation Name
                        </label>
                        <Input
                          value={inviteForm.reservedNationName}
                          onChange={(e) =>
                            setInviteForm({ ...inviteForm, reservedNationName: e.target.value })
                          }
                          placeholder="Kingdom of Solaria"
                          className="border-border/30 bg-background/50 h-8 rounded-xl text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-foreground text-xs font-medium">Initial Role</label>
                        <Select
                          value={inviteForm.role}
                          onValueChange={(val: "admin" | "user" | "owner") =>
                            setInviteForm({ ...inviteForm, role: val })
                          }
                        >
                          <SelectTrigger className="border-border/30 bg-background/50 h-8 rounded-xl text-xs">
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
                        className="h-8 rounded-xl px-3 text-xs"
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
                        className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98]"
                      >
                        {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Can>
            </div>

            <div className="space-y-2.5">
              {SYSTEM_ROLES.map((role) => (
                <div
                  key={role.name}
                  className="border-border/20 bg-background/30 hover:border-border/40 flex flex-col justify-between gap-2 rounded-xl border p-3.5 transition-colors sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-xs font-bold">{role.displayName}</span>
                      <Badge
                        variant="outline"
                        className={
                          role.level === 0
                            ? "border-red-500/30 bg-red-500/10 text-[10px] text-red-400"
                            : role.level === 10
                              ? "border-cyan-500/30 bg-cyan-500/10 text-[10px] text-cyan-400"
                              : "text-[10px]"
                        }
                      >
                        Level {role.level}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">{role.description}</p>
                    <p className="text-muted-foreground/70 mt-0.5 font-mono text-[10px]">
                      Permissions: {role.permissions}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="memberships" className="mt-4 space-y-4 focus-visible:outline-none">
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-border/30 bg-background/50 h-8 rounded-xl pl-8 text-xs backdrop-blur-md"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {usersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : !filteredUsers || filteredUsers.length === 0 ? (
              <div className="border-border/30 bg-card/25 rounded-2xl border p-8 text-center backdrop-blur-md">
                <p className="text-muted-foreground text-xs">No accounts found.</p>
              </div>
            ) : (
              filteredUsers?.map((user) => (
                <div
                  key={user.id}
                  className="border-border/30 bg-card/25 hover:border-border/50 flex items-center justify-between rounded-2xl border p-3.5 shadow-xs backdrop-blur-md transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-mono text-xs font-semibold">
                        {user.clerkUserId}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          user.membershipTier === "mycountry_premium"
                            ? "border-purple-500/30 bg-purple-500/10 text-[10px] text-purple-400"
                            : "text-[10px]"
                        }
                      >
                        {user.membershipTier === "mycountry_premium"
                          ? "Executive Premium"
                          : "Basic Player"}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground mt-0.5 block text-[11px]">
                      {user.country ? `Nation: ${user.country.name}` : "No Claimed Nation"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-muted-foreground text-xs">Premium</span>
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
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default UserRolesPanel;
