"use client";

import { api } from "~/trpc/react";
import { SystemRestart as Loader2 } from "iconoir-react";

export function RealmUsersTab() {
  const { data: users, isLoading } = api.realms.adminListUsers.useQuery();

  if (isLoading) {
    return (
      <div className="text-label-secondary flex items-center justify-center gap-2 py-16">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-body">Loading users...</span>
      </div>
    );
  }

  if (!users?.length) {
    return <div className="text-label-secondary py-16 text-center">No users found.</div>;
  }

  const withCountry = users.filter((u) => u.country);
  const withoutCountry = users.filter((u) => !u.country);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex gap-4">
        <div className="rounded-control border-green/20 bg-green/5 border px-4 py-2">
          <span className="text-label-secondary text-footnote">Assigned</span>
          <div className="text-title-3 text-green">{withCountry.length}</div>
        </div>
        <div className="rounded-control border-yellow/20 bg-yellow/5 border px-4 py-2">
          <span className="text-label-secondary text-footnote">Unassigned</span>
          <div className="text-title-3 text-yellow">{withoutCountry.length}</div>
        </div>
      </div>

      {/* Users table */}
      <div className="border-separator rounded-row overflow-x-auto border">
        <table className="text-body w-full tabular-nums">
          <thead>
            <tr className="border-separator bg-fill-4 border-b">
              <th className="text-label-secondary px-4 py-3 text-left font-medium">
                Clerk User ID
              </th>
              <th className="text-label-secondary px-4 py-3 text-left font-medium">Membership</th>
              <th className="text-label-secondary px-4 py-3 text-left font-medium">Country</th>
              <th className="text-label-secondary px-4 py-3 text-left font-medium">Realm</th>
              <th className="text-label-secondary px-4 py-3 text-left font-medium">Status</th>
              <th className="text-label-secondary px-4 py-3 text-left font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-separator hover:bg-fill-4 border-b">
                <td className="text-label-secondary text-footnote px-4 py-3 font-mono">
                  {user.clerkUserId.slice(0, 20)}...
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-caption rounded-full border px-2 py-0.5 ${
                      user.membershipTier === "basic"
                        ? "border-separator bg-fill-3 text-label-secondary"
                        : "border-purple/20 bg-purple/10 text-purple"
                    }`}
                  >
                    {user.membershipTier}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.country ? (
                    <span className="font-medium">{user.country.name}</span>
                  ) : (
                    <span className="text-label-tertiary text-footnote">No country</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {user.country?.realmId ? (
                    <span
                      className={`text-footnote ${user.country.realmId === "default" ? "text-green" : "text-purple"}`}
                    >
                      {user.country.realmId === "default"
                        ? "IxWorld"
                        : user.country.realmId.slice(0, 12)}
                    </span>
                  ) : (
                    <span className="text-label-tertiary text-footnote">N/A</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div
                    className={`h-2 w-2 rounded-full ${user.isActive ? "bg-green" : "bg-red"}`}
                  />
                </td>
                <td className="text-label-secondary text-footnote px-4 py-3">
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
