// src/app/admin/users/page.tsx
// User management, roles & permissions, notifications
"use client";
export const dynamic = "force-dynamic";

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { UserManagement } from "../_components/UserManagement";
import { CountryAdminPanel } from "../_components/CountryAdminPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Users } from "lucide-react";

export default function UsersPage() {
  usePageTitle({ title: "Admin - Users & Roles" });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Users}
        title="Users & Roles"
        description="User management, country assignments, roles, and notifications"
      />

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-4 w-full justify-start">
          <TabsTrigger value="users">Users & Countries</TabsTrigger>
          <TabsTrigger value="country-admin">Country Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="country-admin">
          <CountryAdminPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
