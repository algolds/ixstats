"use client";

import { api } from "~/trpc/react";
import { SystemRestart as Loader2 } from "iconoir-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4">Clerk User ID</TableHead>
            <TableHead className="px-4">Membership</TableHead>
            <TableHead className="px-4">Country</TableHead>
            <TableHead className="px-4">Realm</TableHead>
            <TableHead className="px-4">Status</TableHead>
            <TableHead className="px-4">Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="text-label-secondary text-footnote px-4 font-mono">
                {user.clerkUserId.slice(0, 20)}...
              </TableCell>
              <TableCell className="px-4">
                <span
                  className={`text-caption rounded-full border px-2 py-0.5 ${
                    user.membershipTier === "basic"
                      ? "border-separator bg-fill-3 text-label-secondary"
                      : "border-purple/20 bg-purple/10 text-purple"
                  }`}
                >
                  {user.membershipTier}
                </span>
              </TableCell>
              <TableCell className="px-4">
                {user.country ? (
                  <span className="font-medium">{user.country.name}</span>
                ) : (
                  <span className="text-label-tertiary text-footnote">No country</span>
                )}
              </TableCell>
              <TableCell className="px-4">
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
              </TableCell>
              <TableCell className="px-4">
                <div className={`h-2 w-2 rounded-full ${user.isActive ? "bg-green" : "bg-red"}`} />
              </TableCell>
              <TableCell className="text-label-secondary text-footnote px-4">
                {new Date(user.createdAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
