"use client";

import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";

export function RealmUsersTab() {
  const { data: users, isLoading } = api.studio.adminListUsers.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading users...</span>
      </div>
    );
  }

  if (!users?.length) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        No users found.
      </div>
    );
  }

  const withCountry = users.filter((u) => u.country);
  const withoutCountry = users.filter((u) => !u.country);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2">
          <span className="text-xs text-muted-foreground">Assigned</span>
          <div className="text-lg font-bold text-emerald-500">{withCountry.length}</div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2">
          <span className="text-xs text-muted-foreground">Unassigned</span>
          <div className="text-lg font-bold text-amber-500">{withoutCountry.length}</div>
        </div>
      </div>

      {/* Users table */}
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Clerk User ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Membership</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Country</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Realm</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border/30 hover:bg-muted/20">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {user.clerkUserId.slice(0, 20)}...
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                    user.membershipTier === "basic"
                      ? "border-gray-500/20 bg-gray-500/10 text-gray-400"
                      : "border-violet-500/20 bg-violet-500/10 text-violet-500"
                  }`}>
                    {user.membershipTier}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.country ? (
                    <span className="font-medium">{user.country.name}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">No country</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {user.country?.realmId ? (
                    <span className={`text-xs ${user.country.realmId === "default" ? "text-emerald-500" : "text-violet-500"}`}>
                      {user.country.realmId === "default" ? "IxWorld" : user.country.realmId.slice(0, 12)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">N/A</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className={`h-2 w-2 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-500"}`} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
