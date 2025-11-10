// src/app/admin/_components/UserManagement.tsx
"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Checkbox } from "~/components/ui/checkbox";
import { Textarea } from "~/components/ui/textarea";
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
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Users,
  Unlink,
  Link as LinkIcon,
  Crown,
  User,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Shield,
  Plus,
  Edit,
  Trash2,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { toast } from "sonner";

interface UserManagementProps {
  className?: string;
}

export function UserManagement({ className }: UserManagementProps) {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showUserAssignment, setShowUserAssignment] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Role form state
  const [roleForm, setRoleForm] = useState({
    name: "",
    displayName: "",
    description: "",
    level: 100,
    permissionIds: [] as string[],
  });

  const [userAssignment, setUserAssignment] = useState({
    clerkUserId: "",
    roleId: "",
  });

  // API queries
  const {
    data: usersWithCountries,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = api.admin.listUsersWithCountries.useQuery();

  const {
    data: countriesWithUsers,
    isLoading: countriesLoading,
    refetch: refetchCountries,
  } = api.admin.listCountriesWithUsers.useQuery();

  // Role management queries
  const {
    data: roles,
    isLoading: rolesLoading,
    refetch: refetchRoles,
  } = api.roles.getRoles.useQuery();
  const { data: permissions, isLoading: permissionsLoading } = api.roles.getPermissions.useQuery();
  const { data: usersData, refetch: refetchRoleUsers } = api.roles.getUsersWithRoles.useQuery({
    search: userSearchTerm,
    roleId: selectedRole === "all" ? undefined : selectedRole || undefined,
  });

  // API mutations
  const assignUserMutation = api.admin.assignUserToCountry.useMutation({
    onSuccess: () => {
      toast.success("User assigned to country successfully");
      refetchUsers();
      refetchCountries();
      setIsAssignDialogOpen(false);
      setSelectedUser("");
      setSelectedCountry("");
    },
    onError: (error) => {
      toast.error(`Failed to assign user: ${error.message}`);
    },
  });

  const unassignUserMutation = api.admin.unassignUserFromCountry.useMutation({
    onSuccess: () => {
      toast.success("User unlinked from country successfully");
      refetchUsers();
      refetchCountries();
    },
    onError: (error) => {
      toast.error(`Failed to unlink user: ${error.message}`);
    },
  });

  // Role mutations
  const initializeSystem = api.roles.initializeRoleSystem.useMutation({
    onSuccess: () => {
      refetchRoles();
      toast.success("Role system initialized successfully");
    },
    onError: (error) => {
      toast.error(`Failed to initialize: ${error.message}`);
    },
  });

  const createRole = api.roles.createRole.useMutation({
    onSuccess: () => {
      setShowCreateRole(false);
      setRoleForm({
        name: "",
        displayName: "",
        description: "",
        level: 100,
        permissionIds: [],
      });
      refetchRoles();
      toast.success("Role created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create role: ${error.message}`);
    },
  });

  const assignRole = api.roles.assignUserRole.useMutation({
    onSuccess: () => {
      setShowUserAssignment(false);
      setUserAssignment({ clerkUserId: "", roleId: "" });
      refetchRoleUsers();
      toast.success("Role assigned successfully");
    },
    onError: (error) => {
      toast.error(`Failed to assign role: ${error.message}`);
    },
  });

  const removeRole = api.roles.removeUserRole.useMutation({
    onSuccess: () => {
      refetchRoleUsers();
      toast.success("Role removed successfully");
    },
    onError: (error) => {
      toast.error(`Failed to remove role: ${error.message}`);
    },
  });

  const updateMembershipTier = api.users.updateMembershipTier.useMutation({
    onSuccess: (data) => {
      refetchUsers();
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(`Failed to update membership: ${error.message}`);
    },
  });

  const handleTogglePremium = (clerkUserId: string, currentTier: string) => {
    const newTier = currentTier === "mycountry_premium" ? "basic" : "mycountry_premium";
    updateMembershipTier.mutate({
      userId: clerkUserId,
      tier: newTier as "basic" | "mycountry_premium",
    });
  };

  const handleAssignUser = () => {
    if (!selectedUser || !selectedCountry) {
      toast.error("Please select both a user and a country");
      return;
    }

    assignUserMutation.mutate({
      userId: selectedUser,
      countryId: selectedCountry,
    });
  };

  const handleUnlinkUser = (userId: string, countryId: string) => {
    unassignUserMutation.mutate({
      userId,
      countryId,
    });
  };

  const handleCreateRole = () => {
    createRole.mutate(roleForm);
  };

  const handleAssignRole = () => {
    assignRole.mutate(userAssignment);
  };

  const handleRemoveUserRole = (clerkUserId: string) => {
    removeRole.mutate({ clerkUserId });
  };

  const getRoleColor = (level: number) => {
    if (level <= 0) return "bg-purple-100 text-purple-800 border-purple-200";
    if (level <= 10) return "bg-red-100 text-red-800 border-red-200";
    if (level <= 20) return "bg-blue-100 text-blue-800 border-blue-200";
    if (level <= 30) return "bg-green-100 text-green-800 border-green-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const unlinkedUsers = usersWithCountries?.filter((user) => !user.country) || [];
  const linkedUsers = usersWithCountries?.filter((user) => user.country) || [];
  const unclaimedCountries = countriesWithUsers?.filter((country) => !country.user) || [];

  if (usersLoading || countriesLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User & Role Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User & Role Management
          </CardTitle>

          {(!roles || roles.length === 0) && (
            <Button
              onClick={() => initializeSystem.mutate()}
              disabled={initializeSystem.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {initializeSystem.isPending ? "Initializing..." : "Initialize Role System"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users & Countries
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Roles & Permissions
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Role Assignments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {usersWithCountries?.length || 0}
                </div>
                <div className="text-sm text-blue-600/80 dark:text-blue-400/80">Total Users</div>
              </div>
              <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {linkedUsers.length}
                </div>
                <div className="text-sm text-green-600/80 dark:text-green-400/80">Linked Users</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {unlinkedUsers.length}
                </div>
                <div className="text-sm text-amber-600/80 dark:text-amber-400/80">
                  Unlinked Users
                </div>
              </div>
              <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-950/30">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {unclaimedCountries.length}
                </div>
                <div className="text-sm text-purple-600/80 dark:text-purple-400/80">
                  Unclaimed Countries
                </div>
              </div>
            </div>

            {/* Assign User to Country */}
            <div className="border-t pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Assign User to Country</h3>
                <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Assign User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign User to Country</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="user-select">Select User</Label>
                        <Select value={selectedUser} onValueChange={setSelectedUser}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a user..." />
                          </SelectTrigger>
                          <SelectContent>
                            {usersWithCountries?.map((user) => (
                              <SelectItem key={user.id} value={user.clerkUserId}>
                                {user.clerkUserId} {user.country && "(Currently linked)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="country-select">Select Country</Label>
                        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a country..." />
                          </SelectTrigger>
                          <SelectContent>
                            {countriesWithUsers?.map((country) => (
                              <SelectItem key={country.id} value={country.id}>
                                {country.name} {country.user && "(Currently claimed)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAssignUser} disabled={assignUserMutation.isPending}>
                        {assignUserMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Assign
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Linked Users */}
            <div className="border-t pt-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Linked Users ({linkedUsers.length})
              </h3>
              <div className="space-y-2">
                {linkedUsers.length === 0 ? (
                  <p className="text-muted-foreground">
                    No users are currently linked to countries.
                  </p>
                ) : (
                  linkedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-950/30"
                    >
                      <div className="flex flex-1 items-center gap-3">
                        <User className="h-4 w-4 text-green-600" />
                        <div className="flex-1">
                          <div className="font-medium">{user.clerkUserId}</div>
                          <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Crown className="h-3 w-3" />
                            <span>{user.country?.name}</span>
                            <Badge
                              variant={
                                user.membershipTier === "mycountry_premium" ? "default" : "outline"
                              }
                              className={
                                user.membershipTier === "mycountry_premium"
                                  ? "bg-purple-600 text-white"
                                  : ""
                              }
                            >
                              {user.membershipTier === "mycountry_premium" ? "Premium" : "Basic"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <label className="cursor-pointer text-sm font-medium">Premium</label>
                          <Switch
                            checked={user.membershipTier === "mycountry_premium"}
                            onCheckedChange={() =>
                              handleTogglePremium(user.clerkUserId, user.membershipTier || "basic")
                            }
                            disabled={updateMembershipTier.isPending}
                          />
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger className="ring-offset-background focus-visible:ring-ring bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
                            <Unlink className="mr-2 h-4 w-4" />
                            Unlink
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Unlink User from Country</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to unlink <strong>{user.clerkUserId}</strong>{" "}
                                from <strong>{user.country?.name}</strong>? This action will remove
                                their access to country-specific features.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogClose>Cancel</AlertDialogClose>
                              <AlertDialogClose
                                onClick={() =>
                                  user.country &&
                                  handleUnlinkUser(user.clerkUserId, user.country.id)
                                }
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={unassignUserMutation.isPending}
                              >
                                {unassignUserMutation.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Unlink className="mr-2 h-4 w-4" />
                                )}
                                Unlink
                              </AlertDialogClose>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Unlinked Users */}
            <div className="border-t pt-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Unlinked Users ({unlinkedUsers.length})
              </h3>
              <div className="space-y-2">
                {unlinkedUsers.length === 0 ? (
                  <p className="text-muted-foreground">All users are linked to countries.</p>
                ) : (
                  unlinkedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30"
                    >
                      <div className="flex flex-1 items-center gap-3">
                        <User className="h-4 w-4 text-amber-600" />
                        <div className="flex-1">
                          <div className="font-medium">{user.clerkUserId}</div>
                          <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <span>Not linked to any country</span>
                            <Badge
                              variant={
                                user.membershipTier === "mycountry_premium" ? "default" : "outline"
                              }
                              className={
                                user.membershipTier === "mycountry_premium"
                                  ? "bg-purple-600 text-white"
                                  : ""
                              }
                            >
                              {user.membershipTier === "mycountry_premium" ? "Premium" : "Basic"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <label className="cursor-pointer text-sm font-medium">Premium</label>
                          <Switch
                            checked={user.membershipTier === "mycountry_premium"}
                            onCheckedChange={() =>
                              handleTogglePremium(user.clerkUserId, user.membershipTier || "basic")
                            }
                            disabled={updateMembershipTier.isPending}
                          />
                        </div>
                        <Badge variant="outline" className="border-amber-600 text-amber-600">
                          Unlinked
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">System Roles</h3>
                <p className="text-muted-foreground text-sm">Manage roles and their permissions</p>
              </div>
              <Dialog open={showCreateRole} onOpenChange={setShowCreateRole}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Role
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Role</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Role Name</label>
                        <Input
                          value={roleForm.name}
                          onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                          placeholder="e.g., moderator"
                          pattern="^[a-z_]+$"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Lowercase letters and underscores only
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Display Name</label>
                        <Input
                          value={roleForm.displayName}
                          onChange={(e) =>
                            setRoleForm({ ...roleForm, displayName: e.target.value })
                          }
                          placeholder="e.g., Content Moderator"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Priority Level</label>
                      <Input
                        type="number"
                        value={roleForm.level}
                        onChange={(e) =>
                          setRoleForm({ ...roleForm, level: parseInt(e.target.value) })
                        }
                        min={0}
                        max={1000}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Lower numbers = higher priority (0 = highest)
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={roleForm.description}
                        onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                        placeholder="Brief description of the role's responsibilities"
                      />
                    </div>

                    {permissions && (
                      <div>
                        <label className="text-sm font-medium">Permissions</label>
                        <div className="max-h-60 overflow-y-auto rounded-lg border p-4">
                          {Object.entries(permissions).map(([category, categoryPermissions]) => (
                            <div key={category} className="mb-4">
                              <h4 className="mb-2 font-medium text-gray-800 capitalize">
                                {category}
                              </h4>
                              <div className="space-y-2">
                                {categoryPermissions.map((permission: any) => (
                                  <div key={permission.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={permission.id}
                                      checked={roleForm.permissionIds.includes(permission.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setRoleForm({
                                            ...roleForm,
                                            permissionIds: [
                                              ...roleForm.permissionIds,
                                              permission.id,
                                            ],
                                          });
                                        } else {
                                          setRoleForm({
                                            ...roleForm,
                                            permissionIds: roleForm.permissionIds.filter(
                                              (id) => id !== permission.id
                                            ),
                                          });
                                        }
                                      }}
                                    />
                                    <label htmlFor={permission.id} className="text-sm">
                                      {permission.displayName}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCreateRole(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateRole} disabled={createRole.isPending}>
                      {createRole.isPending ? "Creating..." : "Create Role"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Permissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles?.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{role.displayName}</div>
                        <div className="text-sm text-gray-500">{role.name}</div>
                        {role.description && (
                          <div className="mt-1 text-xs text-gray-400">{role.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(role.level)}>Level {role.level}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{role.userCount} users</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{role.permissionCount} permissions</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="assignments" className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">User Role Assignments</h3>
                <p className="text-muted-foreground text-sm">Assign and manage user roles</p>
              </div>
              <Dialog open={showUserAssignment} onOpenChange={setShowUserAssignment}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Assign Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Role to User</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div>
                      <label className="text-sm font-medium">User ID (Clerk)</label>
                      <Input
                        value={userAssignment.clerkUserId}
                        onChange={(e) =>
                          setUserAssignment({ ...userAssignment, clerkUserId: e.target.value })
                        }
                        placeholder="Enter Clerk User ID"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Role</label>
                      <Select
                        value={userAssignment.roleId}
                        onValueChange={(value) =>
                          setUserAssignment({ ...userAssignment, roleId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles?.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.displayName} (Level {role.level})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowUserAssignment(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAssignRole} disabled={assignRole.isPending}>
                      {assignRole.isPending ? "Assigning..." : "Assign Role"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles?.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Premium</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersData?.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-sm">{user.clerkUserId}</TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge className={getRoleColor(user.role.level)}>
                          {user.role.displayName}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">No role</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.country ? (
                        <span className="text-sm">{user.country.name}</span>
                      ) : (
                        <span className="text-gray-400">No country</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.membershipTier === "mycountry_premium"}
                          onCheckedChange={() =>
                            handleTogglePremium(user.clerkUserId, user.membershipTier || "basic")
                          }
                          disabled={updateMembershipTier.isPending}
                        />
                        <Badge
                          variant={
                            user.membershipTier === "mycountry_premium" ? "default" : "outline"
                          }
                          className={
                            user.membershipTier === "mycountry_premium"
                              ? "bg-purple-600 text-white"
                              : ""
                          }
                        >
                          {user.membershipTier === "mycountry_premium" ? "Premium" : "Basic"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.role && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveUserRole(user.clerkUserId)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove Role
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
