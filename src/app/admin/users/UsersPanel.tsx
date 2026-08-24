// src/app/admin/users/UsersPanel.tsx
// User Directory and Country Linkage Management
"use client";

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
  Group as Users,
  LinkSlash as Unlink,
  Link as LinkIcon,
  User,
  Search,
  Sparks as Sparkles,
} from "iconoir-react";
import { Switch } from "~/components/ui/switch";
import { useNotify } from "~/hooks/useNotify";
import { useAbility, Can } from "~/components/providers/AbilityProvider";
import { AdminHeader } from "../_components/AdminHeader";
import { usePageTitle } from "~/hooks/usePageTitle";

export function UsersPanel() {
  usePageTitle({ title: "Admin - User Management" });

  const notify = useNotify();
  const ability = useAbility();
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: usersWithCountries,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = api.admin.listUsersWithCountries.useQuery();

  const {
    data: countriesWithUsers,
    refetch: refetchCountries,
  } = api.admin.listCountriesWithUsers.useQuery();

  const assignUserMutation = api.admin.assignUserToCountry.useMutation({
    onSuccess: () => {
      notify.success("Success", "User successfully linked to country");
      void refetchUsers();
      void refetchCountries();
      setIsAssignDialogOpen(false);
      setSelectedUser("");
      setSelectedCountry("");
    },
    onError: (error: { message?: string }) => {
      notify.error("Error", error.message || "Failed to link user");
    },
  });

  const unassignUserMutation = api.admin.unassignUserFromCountry.useMutation({
    onSuccess: () => {
      notify.success("Success", "User successfully unlinked from country");
      void refetchUsers();
      void refetchCountries();
    },
    onError: (error: { message?: string }) => {
      notify.error("Error", error.message || "Failed to unlink user");
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

  const handleAssignUser = () => {
    if (!selectedUser || !selectedCountry) {
      notify.error("Error", "Please select both a user and a country");
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

  const handleTogglePremium = (userId: string, currentTier: string) => {
    const newTier = currentTier === "mycountry_premium" ? "basic" : "mycountry_premium";
    updateMembershipTier.mutate({
      userId,
      tier: newTier,
    });
  };

  const filteredUsers = usersWithCountries?.filter((user) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.clerkUserId.toLowerCase().includes(search) ||
      user.country?.name.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Users}
        title="User & Country Management"
        description="Bind user accounts to nations, toggle executive membership tiers, and manage player access."
      />

      {/* Filter Rail & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search users or countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 rounded-xl border-border/30 bg-background/50 pl-8 text-xs backdrop-blur-md"
          />
        </div>

        <Can I="manage" a="User">
          <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform">
                <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                Link User to Country
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-border/30 bg-card/95 backdrop-blur-md">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold">Link User Account to Country</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <label className="text-foreground text-xs font-medium">Select User</label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="h-8 rounded-xl border-border/30 bg-background/50 text-xs">
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {usersWithCountries?.map((user) => (
                        <SelectItem key={user.id} value={user.clerkUserId}>
                          {user.clerkUserId} {user.country ? `(${user.country.name})` : "(Unlinked)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-foreground text-xs font-medium">Select Country</label>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger className="h-8 rounded-xl border-border/30 bg-background/50 text-xs">
                      <SelectValue placeholder="Choose a country..." />
                    </SelectTrigger>
                    <SelectContent>
                      {countriesWithUsers?.map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          {country.name} {country.user ? `(${country.user.clerkUserId})` : "(Available)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAssignDialogOpen(false)}
                  className="h-8 rounded-xl px-3 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAssignUser}
                  disabled={assignUserMutation.isPending || !selectedUser || !selectedCountry}
                  className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98]"
                >
                  {assignUserMutation.isPending ? "Linking..." : "Link User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      {/* User Directory */}
      <div className="space-y-2.5">
        {usersLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : !filteredUsers || filteredUsers.length === 0 ? (
          <div className="rounded-2xl border border-border/30 bg-card/25 p-8 text-center backdrop-blur-md">
            <p className="text-muted-foreground text-xs">No users found matching query.</p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs flex flex-col justify-between gap-3 sm:flex-row sm:items-center hover:border-border/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-foreground text-xs font-bold font-mono">{user.clerkUserId}</div>
                  <div className="text-muted-foreground flex items-center gap-2 text-[11px] mt-0.5">
                    {user.country ? (
                      <span>Linked to <strong className="text-foreground">{user.country.name}</strong></span>
                    ) : (
                      <span className="text-amber-400 font-medium">Unlinked</span>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        user.membershipTier === "mycountry_premium"
                          ? "border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10px]"
                          : "text-[10px]"
                      }
                    >
                      {user.membershipTier === "mycountry_premium" ? "Premium" : "Basic"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-2">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-muted-foreground text-xs">Premium</span>
                  <Switch
                    checked={user.membershipTier === "mycountry_premium"}
                    onCheckedChange={() =>
                      handleTogglePremium(user.clerkUserId, user.membershipTier || "basic")
                    }
                    disabled={updateMembershipTier.isPending || !ability.can("manage", "User")}
                    className="scale-90"
                  />
                </div>

                {user.country && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUnlinkUser(user.clerkUserId, user.country!.id)}
                    className="h-7 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98] rounded-lg px-2.5"
                  >
                    <Unlink className="mr-1 h-3.5 w-3.5" />
                    Unlink
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default UsersPanel;
