"use client";
// src/app/admin/user-roles/RoleEditorDialog.tsx
// Dialog for creating and editing roles and configuring their attached permissions

import { useState, useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { useNotify } from "~/hooks/useNotify";
import { Key, Shield } from "iconoir-react";

export interface EditableRole {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  level: number;
  isSystem: boolean;
  permissions: Array<{ id: string; name: string }>;
}

interface RoleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: EditableRole | null;
  onSuccess?: () => void;
}

export function RoleEditorDialog({
  open,
  onOpenChange,
  role,
  onSuccess,
}: RoleEditorDialogProps) {
  const notify = useNotify();
  const isEditing = Boolean(role);

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<number>(50);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());

  const { data: permissionsByCategory, isLoading: permissionsLoading } =
    api.roles.getPermissions.useQuery(undefined, {
      enabled: open,
    });

  // Populate form on open or role change
  useEffect(() => {
    if (role) {
      setName(role.name);
      setDisplayName(role.displayName);
      setDescription(role.description || "");
      setLevel(role.level);
      setSelectedPermissionIds(new Set(role.permissions.map((p) => p.id)));
    } else {
      setName("");
      setDisplayName("");
      setDescription("");
      setLevel(50);
      setSelectedPermissionIds(new Set());
    }
  }, [role, open]);

  const createRoleMutation = api.roles.createRole.useMutation({
    onSuccess: () => {
      notify.success("Role Created", `Role '${displayName}' has been successfully created.`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      notify.error("Creation Failed", err.message || "Failed to create role");
    },
  });

  const updateRoleMutation = api.roles.updateRole.useMutation({
    onSuccess: () => {
      notify.success("Role Updated", `Role '${displayName}' has been successfully updated.`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      notify.error("Update Failed", err.message || "Failed to update role");
    },
  });

  const isPending = createRoleMutation.isPending || updateRoleMutation.isPending;

  const handleTogglePermission = (permissionId: string) => {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const handleToggleCategory = (categoryPerms: Array<{ id: string }>) => {
    const allSelected = categoryPerms.every((p) => selectedPermissionIds.has(p.id));
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      for (const p of categoryPerms) {
        if (allSelected) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      notify.error("Validation Error", "Display name is required");
      return;
    }

    if (!isEditing) {
      const trimmedName = name.trim().toLowerCase();
      if (!trimmedName || !/^[a-z_]+$/.test(trimmedName)) {
        notify.error(
          "Validation Error",
          "Role identifier must be lowercase letters and underscores only"
        );
        return;
      }

      createRoleMutation.mutate({
        name: trimmedName,
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        level,
        permissionIds: Array.from(selectedPermissionIds),
      });
    } else if (role) {
      updateRoleMutation.mutate({
        roleId: role.id,
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        level: role.isSystem && role.level === 0 ? undefined : level,
        permissionIds: Array.from(selectedPermissionIds),
      });
    }
  };

  const totalPermissions = useMemo(() => {
    if (!permissionsByCategory) return 0;
    return Object.values(permissionsByCategory).reduce((acc, list) => acc + list.length, 0);
  }, [permissionsByCategory]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="text-teal h-5 w-5" />
            <DialogTitle>{isEditing ? `Edit Role: ${role?.displayName}` : "Create System Role"}</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-label text-caption">Role Identifier (System name)</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. game_moderator"
                disabled={isEditing}
                className="font-mono rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
              <p className="text-label-tertiary text-footnote">
                Lowercase letters and underscores only. Unique identifier.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-label text-caption">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Game Moderator"
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
              <p className="text-label-tertiary text-footnote">Human-readable role name shown in UI.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-label text-caption">Hierarchy Level (0 - 1000)</label>
              <Input
                type="number"
                min={0}
                max={1000}
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value, 10) || 0)}
                disabled={isEditing && role?.isSystem && role?.level === 0}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
              <p className="text-label-tertiary text-footnote">
                Lower level = higher authority. Owner is 0, Admin is 10, Staff is 20, User is 100.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-label text-caption">Role Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of duties and permissions"
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>
          </div>

          <div className="border-separator space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-label text-caption flex items-center gap-2">
                  <Key className="text-amber h-4 w-4" />
                  Assigned Permissions
                </h4>
                <p className="text-label-secondary text-footnote mt-0.5">
                  Select capabilities granted to accounts holding this role (
                  {selectedPermissionIds.size} of {totalPermissions} selected).
                </p>
              </div>
            </div>

            {permissionsLoading ? (
              <p className="text-label-tertiary text-footnote py-4">Loading system permissions...</p>
            ) : !permissionsByCategory || Object.keys(permissionsByCategory).length === 0 ? (
              <p className="text-label-tertiary text-footnote py-4">No permissions registered in system.</p>
            ) : (
              <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
                {Object.entries(permissionsByCategory).map(([category, perms]) => {
                  const allCatSelected = perms.every((p) => selectedPermissionIds.has(p.id));

                  return (
                    <div
                      key={category}
                      className="border-separator bg-fill-2 rounded-row space-y-2 border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-label text-caption font-semibold capitalize">
                            {category} permissions
                          </span>
                          <Badge variant="outline" className="text-footnote">
                            {perms.filter((p) => selectedPermissionIds.has(p.id)).length} / {perms.length}
                          </Badge>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-footnote h-6 px-2"
                          onClick={() => handleToggleCategory(perms)}
                        >
                          {allCatSelected ? "Deselect All" : "Select All"}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                        {perms.map((perm) => {
                          const checked = selectedPermissionIds.has(perm.id);
                          return (
                            <label
                              key={perm.id}
                              className="hover:bg-fill-3 flex cursor-pointer items-start gap-2.5 rounded p-1.5 transition-colors"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => handleTogglePermission(perm.id)}
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="text-label text-footnote block font-medium">
                                  {perm.displayName}
                                </span>
                                <code className="text-label-tertiary text-footnote block font-mono">
                                  {perm.name}
                                </code>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="border-separator border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
