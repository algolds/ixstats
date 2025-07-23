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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "~/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
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
  Users, 
  Unlink, 
  Link as LinkIcon, 
  Crown, 
  User,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface UserManagementProps {
  className?: string;
}

export function UserManagement({ className }: UserManagementProps) {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  // API queries
  const { 
    data: usersWithCountries, 
    isLoading: usersLoading, 
    refetch: refetchUsers 
  } = api.admin.listUsersWithCountries.useQuery();

  const { 
    data: countriesWithUsers, 
    isLoading: countriesLoading, 
    refetch: refetchCountries 
  } = api.admin.listCountriesWithUsers.useQuery();

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

  const handleUnlinkUser = (userId: string, countryId: string, userName: string, countryName: string) => {
    unassignUserMutation.mutate({
      userId,
      countryId,
    });
  };

  const unlinkedUsers = usersWithCountries?.filter(user => !user.country) || [];
  const linkedUsers = usersWithCountries?.filter(user => user.country) || [];
  const unclaimedCountries = countriesWithUsers?.filter(country => !country.user) || [];

  if (usersLoading || countriesLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User & Country Management
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
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User & Country Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {usersWithCountries?.length || 0}
            </div>
            <div className="text-sm text-blue-600/80 dark:text-blue-400/80">
              Total Users
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {linkedUsers.length}
            </div>
            <div className="text-sm text-green-600/80 dark:text-green-400/80">
              Linked Users
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {unlinkedUsers.length}
            </div>
            <div className="text-sm text-amber-600/80 dark:text-amber-400/80">
              Unlinked Users
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg">
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Assign User to Country</h3>
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <LinkIcon className="h-4 w-4 mr-2" />
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
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAssignDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAssignUser}
                      disabled={assignUserMutation.isPending}
                    >
                      {assignUserMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Assign
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Linked Users */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Linked Users ({linkedUsers.length})
          </h3>
          <div className="space-y-2">
            {linkedUsers.length === 0 ? (
              <p className="text-muted-foreground">No users are currently linked to countries.</p>
            ) : (
              linkedUsers.map((user) => (
                <div 
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="font-medium">{user.clerkUserId}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Crown className="h-3 w-3" />
                        {user.country?.name}
                      </div>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger>
                      <Button variant="destructive" size="sm">
                        <Unlink className="h-4 w-4 mr-2" />
                        Unlink
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Unlink User from Country</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to unlink <strong>{user.clerkUserId}</strong> from <strong>{user.country?.name}</strong>? 
                          This action will remove their access to country-specific features.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogClose>Cancel</AlertDialogClose>
                        <AlertDialogClose
                          onClick={() => user.country && handleUnlinkUser(
                            user.clerkUserId, 
                            user.country.id, 
                            user.clerkUserId, 
                            user.country.name
                          )}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {unassignUserMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Unlink className="h-4 w-4 mr-2" />
                          )}
                          Unlink
                        </AlertDialogClose>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Unlinked Users */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
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
                  className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-amber-600" />
                    <div>
                      <div className="font-medium">{user.clerkUserId}</div>
                      <div className="text-sm text-muted-foreground">
                        Not linked to any country
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-600">
                    Unlinked
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Unclaimed Countries */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-500" />
            Unclaimed Countries ({unclaimedCountries.length})
          </h3>
          <div className="grid gap-2 max-h-48 overflow-y-auto">
            {unclaimedCountries.length === 0 ? (
              <p className="text-muted-foreground">All countries are claimed by users.</p>
            ) : (
              unclaimedCountries.slice(0, 10).map((country) => (
                <div 
                  key={country.id}
                  className="flex items-center gap-3 p-2 bg-purple-50 dark:bg-purple-950/30 rounded"
                >
                  <MapPin className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">{country.name}</span>
                  <Badge variant="outline" className="text-purple-600 border-purple-600 ml-auto">
                    Available
                  </Badge>
                </div>
              ))
            )}
            {unclaimedCountries.length > 10 && (
              <div className="text-sm text-muted-foreground text-center py-2">
                ... and {unclaimedCountries.length - 10} more countries
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}