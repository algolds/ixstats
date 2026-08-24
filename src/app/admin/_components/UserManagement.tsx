// src/app/admin/_components/UserManagement.tsx
// Dispatcher for User Directory and System Roles
"use client";

import { UsersPanel } from "../users/UsersPanel";
import { UserRolesPanel } from "../user-roles/UserRolesPanel";

interface UserManagementProps {
  className?: string;
  mode?: "users" | "roles";
}

export function UserManagement({ mode = "users" }: UserManagementProps) {
  if (mode === "roles") {
    return <UserRolesPanel />;
  }
  return <UsersPanel />;
}

export default UserManagement;
