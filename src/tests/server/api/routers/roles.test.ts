/** @jest-environment node */

jest.mock("~/lib/cache", () => ({
  ...jest.requireActual<object>("~/lib/cache"),
  globalCache: {
    delete: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
  },
  invalidateCache: jest.fn(),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { rolesRouter } from "~/server/api/routers/roles";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(rolesRouter);
let db: MemoryPrisma;

const asCaller = (authUserId: string, role: { name: string; level: number }) =>
  createCaller(
    createMockRouterContext({
      auth: { userId: authUserId },
      user: { id: `db_${authUserId}`, clerkUserId: authUserId, role },
      db,
    }) as never
  );

const systemOwner = () => asCaller("user_owner", { name: "owner", level: 0 });
const admin = () => asCaller("admin_1", { name: "admin", level: 10 });
const staff = () => asCaller("staff_1", { name: "staff", level: 20 });

beforeEach(async () => {
  db = createMemoryPrisma();

  // Create permissions
  await db.permission.create({
    data: {
      id: "perm_system_config",
      name: "system.config",
      displayName: "System Configuration",
      category: "system",
      isSystem: true,
    },
  });
  await db.permission.create({
    data: {
      id: "perm_user_manage",
      name: "user.manage",
      displayName: "Manage Users",
      category: "user",
      isSystem: true,
    },
  });
  await db.permission.create({
    data: {
      id: "perm_labs_access",
      name: "labs.access",
      displayName: "Access Labs",
      category: "labs",
      isSystem: true,
    },
  });

  // Create base roles
  const ownerRole = await db.role.create({
    data: {
      id: "role_owner",
      name: "owner",
      displayName: "System Owner",
      description: "Full system access",
      level: 0,
      isSystem: true,
      isActive: true,
    },
  });
  const adminRole = await db.role.create({
    data: {
      id: "role_admin",
      name: "admin",
      displayName: "Administrator",
      description: "Administrative access",
      level: 10,
      isSystem: true,
      isActive: true,
    },
  });
  const userRole = await db.role.create({
    data: {
      id: "role_user",
      name: "user",
      displayName: "Standard Player",
      description: "Basic player permissions",
      level: 100,
      isSystem: true,
      isActive: true,
    },
  });

  // Attach permissions to owner
  await db.rolePermission.create({
    data: {
      id: "rp_1",
      roleId: ownerRole.id,
      permissionId: "perm_system_config",
    },
  });
  await db.rolePermission.create({
    data: {
      id: "rp_2",
      roleId: ownerRole.id,
      permissionId: "perm_user_manage",
    },
  });

  // Create users
  await db.user.create({
    data: {
      id: "db_user_owner",
      clerkUserId: "user_owner",
      roleId: ownerRole.id,
    },
  });
  await db.user.create({
    data: {
      id: "db_admin_1",
      clerkUserId: "admin_1",
      roleId: adminRole.id,
    },
  });
  await db.user.create({
    data: {
      id: "db_player_1",
      clerkUserId: "player_1",
      roleId: userRole.id,
    },
  });
});

describe("roles router", () => {
  describe("getRoles & getPermissions", () => {
    it("returns active roles with permissions and user counts", async () => {
      const caller = admin();
      const roles = await caller.getRoles();

      expect(roles).toHaveLength(3);
      const owner = roles.find((r) => r.name === "owner");
      expect(owner).toBeDefined();
      expect(owner?.displayName).toBe("System Owner");
      expect(owner?.level).toBe(0);
      expect(owner?.userCount).toBe(1);
      expect(owner?.permissions).toHaveLength(2);
      expect(owner?.permissions.map((p) => p.name)).toContain("system.config");
    });

    it("returns permissions grouped by category", async () => {
      const caller = admin();
      const permsByCategory = await caller.getPermissions();

      expect(permsByCategory).toHaveProperty("system");
      expect(permsByCategory).toHaveProperty("user");
      expect(permsByCategory).toHaveProperty("labs");
      expect(permsByCategory.system[0].name).toBe("system.config");
    });
  });

  describe("createRole", () => {
    it("creates a custom role with permissions and writes audit log", async () => {
      await db.rolePermission.create({
        data: { id: "rp_admin_um", roleId: "role_admin", permissionId: "perm_user_manage" },
      });
      const caller = admin();
      const result = await caller.createRole({
        name: "moderator",
        displayName: "Moderator",
        description: "Content moderation",
        level: 30,
        permissionIds: ["perm_user_manage"],
      });

      expect(result.success).toBe(true);
      expect(result.roleId).toBeDefined();

      const created = await db.role.findUnique({
        where: { id: result.roleId },
        include: { rolePermissions: true },
      });
      expect(created?.name).toBe("moderator");
      expect(created?.level).toBe(30);
      expect(created?.isSystem).toBe(false);
      expect(created?.rolePermissions).toHaveLength(1);
    });

    it("prevents creating role with duplicate name or level", async () => {
      const caller = admin();
      await expect(
        caller.createRole({
          name: "admin",
          displayName: "Admin Duplicate",
          level: 15,
        })
      ).rejects.toThrow(/already exists/i);

      await expect(
        caller.createRole({
          name: "custom_level_ten",
          displayName: "Level Conflict",
          level: 10,
        })
      ).rejects.toThrow(/already exists/i);
    });

    it("prevents non-owners from creating roles with level higher than their own", async () => {
      const caller = staff(); // level 20
      await expect(
        caller.createRole({
          name: "high_role",
          displayName: "High Role",
          level: 5, // higher privilege than staff (level 20)
        })
      ).rejects.toThrow(/higher privileges/i);
    });
  });

  describe("updateRole", () => {
    it("updates role display name, description, and permissions", async () => {
      await db.rolePermission.create({
        data: { id: "rp_admin_labs", roleId: "role_admin", permissionId: "perm_labs_access" },
      });
      const caller = admin();
      const updated = await caller.updateRole({
        roleId: "role_user",
        displayName: "Registered Member",
        description: "Verified community player",
        permissionIds: ["perm_labs_access"],
      });

      expect(updated.success).toBe(true);

      const role = await db.role.findUnique({
        where: { id: "role_user" },
        include: { rolePermissions: true },
      });
      expect(role?.displayName).toBe("Registered Member");
      expect(role?.description).toBe("Verified community player");
      expect(role?.rolePermissions).toHaveLength(1);
      expect(role?.rolePermissions[0].permissionId).toBe("perm_labs_access");
    });

    it("prevents non-system owners from modifying owner role", async () => {
      const caller = admin();
      await expect(
        caller.updateRole({
          roleId: "role_owner",
          displayName: "Hacked Owner",
        })
      ).rejects.toThrow(/cannot modify owner role/i);
    });
  });

  describe("deleteRole", () => {
    it("refuses to delete system roles", async () => {
      const caller = admin();
      await expect(
        caller.deleteRole({
          roleId: "role_user",
        })
      ).rejects.toThrow(/system roles cannot be deleted/i);
    });

    it("refuses to delete a role assigned to users", async () => {
      const customRole = await db.role.create({
        data: {
          id: "role_custom",
          name: "custom",
          displayName: "Custom Role",
          level: 50,
          isSystem: false,
        },
      });

      // Assign to player_1
      await db.user.update({
        where: { clerkUserId: "player_1" },
        data: { roleId: customRole.id },
      });

      const caller = admin();
      await expect(
        caller.deleteRole({
          roleId: customRole.id,
        })
      ).rejects.toThrow(/assigned to active users/i);
    });

    it("deletes unused non-system role", async () => {
      const customRole = await db.role.create({
        data: {
          id: "role_unused",
          name: "unused",
          displayName: "Unused Role",
          level: 60,
          isSystem: false,
        },
      });

      const caller = admin();
      const res = await caller.deleteRole({ roleId: customRole.id });
      expect(res.success).toBe(true);

      const found = await db.role.findUnique({ where: { id: customRole.id } });
      expect(found).toBeNull();
    });
  });

  describe("assignUserRole", () => {
    it("assigns role to user and creates admin audit log", async () => {
      const caller = admin();
      const res = await caller.assignUserRole({
        clerkUserId: "player_1",
        roleId: "role_admin",
      });

      expect(res.success).toBe(true);

      const user = await db.user.findUnique({
        where: { clerkUserId: "player_1" },
      });
      expect(user?.roleId).toBe("role_admin");

      const auditLog = await db.adminAuditLog.findFirst({
        where: { action: "USER_ROLE_ASSIGNED" },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.targetName).toBe("player_1");
    });

    it("prevents non-owners from assigning level 0 (owner) role", async () => {
      const caller = admin(); // level 10
      await expect(
        caller.assignUserRole({
          clerkUserId: "player_1",
          roleId: "role_owner", // level 0
        })
      ).rejects.toThrow(/higher privileges/i);
    });

    it("allows system owner to assign any role", async () => {
      const caller = systemOwner();
      const res = await caller.assignUserRole({
        clerkUserId: "player_1",
        roleId: "role_owner",
      });
      expect(res.success).toBe(true);

      const user = await db.user.findUnique({
        where: { clerkUserId: "player_1" },
      });
      expect(user?.roleId).toBe("role_owner");
    });

    it("prevents non-owners from modifying a system owner's role", async () => {
      const caller = admin();
      await expect(
        caller.assignUserRole({
          clerkUserId: "user_owner",
          roleId: "role_user",
        })
      ).rejects.toThrow(/cannot modify roles for system owners/i);
    });
  });

  describe("getUsersWithRoles", () => {
    it("lists users with their role and claimed country", async () => {
      const caller = admin();
      const result = await caller.getUsersWithRoles({
        search: "player",
      });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].clerkUserId).toBe("player_1");
      expect(result.users[0].role?.name).toBe("user");
    });
  });

  describe("rank checks", () => {
    it("refuses staff editing a role that outranks them", async () => {
      await expect(
        staff().updateRole({ roleId: "role_admin", displayName: "Demoted" })
      ).rejects.toThrow(/at or above your own rank/i);
    });

    it("refuses staff deactivating the admin role", async () => {
      await expect(
        staff().updateRole({ roleId: "role_admin", isActive: false })
      ).rejects.toThrow(/at or above your own rank/i);
    });

    it("refuses an admin editing its own role", async () => {
      await expect(
        admin().updateRole({ roleId: "role_admin", displayName: "Self Edit" })
      ).rejects.toThrow(/at or above your own rank/i);
    });

    it("refuses deleting custom roles at or above the caller and allows lower ones", async () => {
      await db.role.create({
        data: { id: "role_c5", name: "c5", displayName: "C5", level: 5, isSystem: false },
      });
      await db.role.create({
        data: { id: "role_c20", name: "c20", displayName: "C20", level: 20, isSystem: false },
      });
      await db.role.create({
        data: { id: "role_c50", name: "c50", displayName: "C50", level: 50, isSystem: false },
      });
      await expect(admin().deleteRole({ roleId: "role_c5" })).rejects.toThrow(
        /at or above your own rank/i
      );
      await expect(admin().deleteRole({ roleId: "role_admin" })).rejects.toThrow(
        /at or above your own rank/i
      );
      await expect(staff().deleteRole({ roleId: "role_c20" })).rejects.toThrow(
        /at or above your own rank/i
      );
      const res = await admin().deleteRole({ roleId: "role_c50" });
      expect(res.success).toBe(true);
    });

    it("refuses reassigning a user whose current role outranks the caller", async () => {
      await expect(
        staff().assignUserRole({ clerkUserId: "admin_1", roleId: "role_user" })
      ).rejects.toThrow(/at or above your own rank/i);
    });

    it("refuses removing the role of a user who outranks the caller", async () => {
      await expect(
        staff().assignUserRole({ clerkUserId: "admin_1", roleId: null })
      ).rejects.toThrow(/at or above your own rank/i);
    });

    it("refuses granting permissions the caller's role does not hold", async () => {
      await expect(
        admin().updateRole({ roleId: "role_user", permissionIds: ["perm_system_config"] })
      ).rejects.toThrow(/only grant permissions/i);
    });

    it("lets the system owner edit the admin role and grant any permission", async () => {
      const res = await systemOwner().updateRole({
        roleId: "role_admin",
        displayName: "Senior Admin",
        permissionIds: ["perm_system_config", "perm_labs_access"],
      });
      expect(res.success).toBe(true);
      const role = await db.role.findUnique({
        where: { id: "role_admin" },
        include: { rolePermissions: true },
      });
      expect(role?.displayName).toBe("Senior Admin");
      expect(role?.rolePermissions).toHaveLength(2);
    });

    it("refuses creating a role with permissions the caller does not hold", async () => {
      await expect(
        admin().createRole({
          name: "sneaky",
          displayName: "Sneaky",
          level: 15,
          permissionIds: ["perm_system_config"],
        })
      ).rejects.toThrow(/only grant permissions/i);
    });
  });
});
