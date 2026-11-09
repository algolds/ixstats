"use client";
// src/app/admin/user-roles/UserRolesPanel.tsx
// Role Definitions, Permissions Configuration & User Role Assignment

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
import {
  Shield,
  Search,
  Sparks as Sparkles,
  Group as Users,
  Mail,
  EditPencil,
  Trash,
  Plus,
  Key,
} from "iconoir-react";
import { Switch } from "~/components/ui/switch";
import { useNotify } from "~/hooks/useNotify";
import { useAbility, Can } from "~/components/providers/AbilityProvider";
import { PageHeader } from "~/components/shell/PageHeader";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card } from "~/components/ui/card";
import { RoleEditorDialog, type EditableRole } from "./RoleEditorDialog";

/** Which dialog is open, and the role it acts on (none for invite or a new role). */
interface PanelDialog {
  open: "none" | "invite" | "editor" | "delete";
  role: EditableRole | null;
}

function getLevelBadgeClass(level: number): string {
  if (level === 0) return "border-red/30 bg-red/10 text-footnote text-red";
  if (level <= 10) return "border-teal/30 bg-teal/10 text-footnote text-teal";
  if (level <= 20) return "border-purple/30 bg-purple/10 text-footnote text-purple";
  if (level <= 30) return "border-amber/30 bg-amber/10 text-footnote text-amber";
  return "text-footnote";
}

export function UserRolesPanel() {
  usePageTitle({ title: "Admin - User Roles & Invitations" });

  const notify = useNotify();
  const ability = useAbility();

  // One dialog at a time; the role outlives a close so the closing dialog keeps its content
  const [dialog, setDialog] = useState<PanelDialog>({ open: "none", role: null });
  const closeDialog = () => setDialog((d) => ({ ...d, open: "none" }));

  // Search & Filter states
  const [roleSearchTerm, setRoleSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");

  const [inviteForm, setInviteForm] = useState({
    emailAddress: "",
    reservedNationName: "",
    role: "user" as "admin" | "user" | "owner",
  });

  // Queries
  const {
    data: roles,
    isLoading: rolesLoading,
    refetch: refetchRoles,
  } = api.roles.getRoles.useQuery();

  const {
    data: usersWithCountries,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = api.admin.listUsersWithCountries.useQuery();

  // Mutations
  const assignUserRoleMutation = api.roles.assignUserRole.useMutation({
    onSuccess: () => {
      notify.success("Role Assigned", "User role assignment has been updated.");
      void refetchUsers();
      void refetchRoles();
    },
    onError: (error) => {
      notify.error("Assignment Failed", error.message || "Failed to assign role.");
    },
  });

  const deleteRoleMutation = api.roles.deleteRole.useMutation({
    onSuccess: () => {
      notify.success("Role Deleted", "The role has been removed.");
      closeDialog();
      void refetchRoles();
    },
    onError: (error) => {
      notify.error("Deletion Failed", error.message || "Failed to delete role.");
    },
  });

  const inviteUserMutation = api.admin.inviteUserToBypassWaitlist.useMutation({
    onSuccess: (result) => {
      notify.success("Success", result.message || "Invitation sent successfully");
      closeDialog();
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

  const handleOpenCreateRole = () => {
    setDialog({ open: "editor", role: null });
  };

  const handleOpenEditRole = (role: EditableRole) => {
    setDialog({ open: "editor", role });
  };

  const filteredRoles = roles?.filter((r) => {
    if (!roleSearchTerm) return true;
    const q = roleSearchTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.displayName.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  const filteredUsers = usersWithCountries?.filter((user) => {
    // Role filter
    if (userRoleFilter !== "all") {
      if (userRoleFilter === "unassigned") {
        if (user.role) return false;
      } else if (user.role?.id !== userRoleFilter && user.role?.name !== userRoleFilter) {
        return false;
      }
    }

    // Text search filter
    if (!userSearchTerm) return true;
    const q = userSearchTerm.toLowerCase();
    return (
      user.clerkUserId.toLowerCase().includes(q) ||
      (user.country?.name && user.country.name.toLowerCase().includes(q)) ||
      (user.role?.displayName && user.role.displayName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles and permissions"
        subtitle="Role hierarchy, permission profiles, user assignments and account elevation."
      />

      <Tabs defaultValue="roles" className="w-full">
        <TabsList className="bg-fill-3 flex w-full max-w-xl justify-start gap-1 rounded-full p-1">
          <TabsTrigger
            value="roles"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Shield className="text-teal h-4 w-4" />
            Role definitions
          </TabsTrigger>
          <TabsTrigger
            value="assignments"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Key className="text-amber h-4 w-4" />
            User role assignment
          </TabsTrigger>
          <TabsTrigger
            value="memberships"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Users className="text-purple h-4 w-4" />
            Account elevation
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ROLE DEFINITIONS & CONFIGURATION */}
        <TabsContent value="roles" className="mt-4 space-y-4 focus-visible:outline-none">
          <Card className="space-y-4 p-5">
            <div className="border-separator flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-label text-caption">Configured system & custom roles</h3>
                <p className="text-label-secondary text-footnote mt-0.5">
                  Hierarchy levels, user counts, and attached permission profiles
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Can I="manage" a="Role">
                  <Button size="sm" onClick={handleOpenCreateRole}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create Role
                  </Button>
                  <Dialog
                    open={dialog.open === "invite"}
                    onOpenChange={(open) =>
                      open ? setDialog((d) => ({ ...d, open: "invite" })) : closeDialog()
                    }
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
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
                        <Button variant="outline" size="sm" onClick={closeDialog}>
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
            </div>

            {/* Role search */}
            <div className="relative max-w-sm">
              <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Filter roles..."
                value={roleSearchTerm}
                onChange={(e) => setRoleSearchTerm(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
              />
            </div>

            {/* Role cards */}
            <div className="space-y-3">
              {rolesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="rounded-row h-24 w-full" />
                  ))}
                </div>
              ) : !filteredRoles || filteredRoles.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-label-secondary text-footnote">No roles match the filter.</p>
                </Card>
              ) : (
                filteredRoles.map((role) => (
                  <div
                    key={role.id}
                    className="border-separator bg-fill-2 hover:border-separator rounded-row flex flex-col justify-between gap-4 border p-4 transition-colors md:flex-row md:items-start"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-label text-caption font-semibold">
                          {role.displayName}
                        </span>
                        <code className="text-label-secondary text-footnote bg-fill-3 rounded px-1.5 py-0.5 font-mono">
                          {role.name}
                        </code>
                        <Badge variant="outline" className={getLevelBadgeClass(role.level)}>
                          Level {role.level}
                        </Badge>
                        {role.isSystem && (
                          <Badge
                            variant="outline"
                            className="border-teal/30 bg-teal/10 text-footnote text-teal"
                          >
                            System
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-footnote">
                          {role.userCount} {role.userCount === 1 ? "user" : "users"}
                        </Badge>
                      </div>

                      <p className="text-label-secondary text-footnote">
                        {role.description || "No description configured."}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-label-tertiary text-footnote mr-1">
                          Permissions ({role.permissionCount}):
                        </span>
                        {role.permissions.length === 0 ? (
                          <span className="text-label-tertiary text-footnote italic">
                            No granular permissions attached
                          </span>
                        ) : (
                          <>
                            {role.permissions.slice(0, 6).map((perm) => (
                              <Badge
                                key={perm.id}
                                variant="outline"
                                className="text-label-secondary text-caption px-1.5 py-0 font-mono"
                              >
                                {perm.name}
                              </Badge>
                            ))}
                            {role.permissions.length > 6 && (
                              <Badge variant="outline" className="text-caption px-1.5 py-0">
                                +{role.permissions.length - 6} more
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Can I="manage" a="Role">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() =>
                            handleOpenEditRole({
                              id: role.id,
                              name: role.name,
                              displayName: role.displayName,
                              description: role.description,
                              level: role.level,
                              isSystem: role.isSystem,
                              permissions: role.permissions,
                            })
                          }
                        >
                          <EditPencil className="h-3.5 w-3.5" />
                          Edit Role
                        </Button>
                        {!role.isSystem && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 h-8 gap-1.5"
                            onClick={() =>
                              setDialog({
                                open: "delete",
                                role: {
                                  id: role.id,
                                  name: role.name,
                                  displayName: role.displayName,
                                  description: role.description,
                                  level: role.level,
                                  isSystem: role.isSystem,
                                  permissions: role.permissions,
                                },
                              })
                            }
                          >
                            <Trash className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        )}
                      </Can>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: USER ROLE ASSIGNMENT */}
        <TabsContent value="assignments" className="mt-4 space-y-4 focus-visible:outline-none">
          <Card className="space-y-4 p-5">
            <div className="border-separator flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-label text-caption">User role assignments</h3>
                <p className="text-label-secondary text-footnote mt-0.5">
                  Assign administrative, moderation, and gameplay roles to players
                </p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Search user ID, nation, or role..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-label-secondary text-footnote">Filter by role:</span>
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger size="sm" className="w-44">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="unassigned">Unassigned (None)</SelectItem>
                    {roles?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.displayName} (Level {r.level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Users list */}
            <div className="space-y-2">
              {usersLoading || rolesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="rounded-row h-16 w-full" />
                  ))}
                </div>
              ) : !filteredUsers || filteredUsers.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-label-secondary text-footnote">
                    No accounts match the criteria.
                  </p>
                </Card>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="border-separator bg-fill-2 hover:border-separator rounded-row flex flex-col justify-between gap-3 border p-4 transition-colors md:flex-row md:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-label text-caption font-mono">
                          {user.clerkUserId}
                        </span>
                        {user.role ? (
                          <Badge variant="outline" className={getLevelBadgeClass(user.role.level)}>
                            {user.role.displayName}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-label-tertiary text-footnote">
                            No Role Assigned
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            user.membershipTier === "mycountry_premium"
                              ? "border-purple/30 bg-purple/10 text-footnote text-purple"
                              : "text-footnote"
                          }
                        >
                          {user.membershipTier === "mycountry_premium" ? "Premium" : "Basic"}
                        </Badge>
                      </div>
                      <span className="text-label-secondary text-footnote mt-0.5 block">
                        {user.country ? `Nation: ${user.country.name}` : "No Claimed Nation"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-label-secondary text-footnote shrink-0">Role:</span>
                      <Select
                        value={user.role?.id || "none"}
                        onValueChange={(newRoleId) =>
                          assignUserRoleMutation.mutate({
                            clerkUserId: user.clerkUserId,
                            roleId: newRoleId === "none" ? null : newRoleId,
                          })
                        }
                        disabled={
                          assignUserRoleMutation.isPending || !ability.can("manage", "User")
                        }
                      >
                        <SelectTrigger size="sm" className="w-48">
                          <SelectValue placeholder="Select role..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-label-tertiary">None (Unassigned)</span>
                          </SelectItem>
                          {roles?.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.displayName} (L{r.level})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* TAB 3: ACCOUNT ELEVATION / MEMBERSHIP TIERS */}
        <TabsContent value="memberships" className="mt-4 space-y-4 focus-visible:outline-none">
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Search accounts..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
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
              filteredUsers.map((user) => (
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

      {/* Role Editor Dialog */}
      <RoleEditorDialog
        open={dialog.open === "editor"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        role={dialog.role}
        onSuccess={() => void refetchRoles()}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={dialog.open === "delete"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
          </DialogHeader>
          <p className="text-label-secondary text-footnote py-2">
            Are you sure you want to delete role &ldquo;{dialog.role?.displayName}&rdquo;? This
            action cannot be undone. Roles assigned to active users cannot be deleted.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={closeDialog}
              disabled={deleteRoleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (dialog.role) {
                  deleteRoleMutation.mutate({ roleId: dialog.role.id });
                }
              }}
              disabled={deleteRoleMutation.isPending}
            >
              {deleteRoleMutation.isPending ? "Deleting..." : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
