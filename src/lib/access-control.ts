// Access Control System for IxStats Private Preview
// Manages user permissions, roles, and feature access

export enum UserRole {
  GUEST = "guest",
  USER = "user", 
  COUNTRY_OWNER = "country_owner",
  MODERATOR = "moderator",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin"
}

export enum Permission {
  // Country Management
  VIEW_COUNTRY = "view_country",
  EDIT_COUNTRY = "edit_country",
  MANAGE_COUNTRY = "manage_country",
  
  // Economic Data
  VIEW_ECONOMIC_DATA = "view_economic_data",
  EDIT_ECONOMIC_DATA = "edit_economic_data",
  VIEW_HISTORICAL_DATA = "view_historical_data",
  EXPORT_DATA = "export_data",
  
  // Analytics and Modeling
  VIEW_ANALYTICS = "view_analytics",
  ADVANCED_ANALYTICS = "advanced_analytics",
  CREATE_SCENARIOS = "create_scenarios",
  PREDICTIVE_MODELING = "predictive_modeling",
  
  // DM Controls
  CREATE_DM_INPUT = "create_dm_input",
  MANAGE_DM_INPUTS = "manage_dm_inputs",
  GLOBAL_DM_INPUT = "global_dm_input",
  
  // System Administration
  VIEW_ADMIN_PANEL = "view_admin_panel",
  MANAGE_USERS = "manage_users",
  SYSTEM_CONFIG = "system_config",
  VIEW_SYSTEM_LOGS = "view_system_logs",
  DATABASE_ACCESS = "database_access",
  
  // Premium Features
  PREMIUM_ANALYTICS = "premium_analytics",
  AI_ADVISOR = "ai_advisor",
  PREMIUM_EXPORTS = "premium_exports",
  
  // SDI/ECI Features
  VIEW_SDI = "view_sdi",
  MANAGE_SDI = "manage_sdi",
  VIEW_ECI = "view_eci",
  MANAGE_ECI = "manage_eci"
}

export interface UserAccessProfile {
  userId: string;
  role: UserRole;
  countryId?: string;
  permissions: Permission[];
  features: {
    isPremium: boolean;
    hasSdiAccess: boolean;
    hasEciAccess: boolean;
    canCreateCountries: boolean;
  };
  limits: {
    maxScenarios: number;
    maxExportsPerDay: number;
    maxDmInputsPerMonth: number;
  };
}

export class AccessControlManager {
  private static readonly ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    [UserRole.GUEST]: [
      Permission.VIEW_COUNTRY,
      Permission.VIEW_ECONOMIC_DATA,
    ],
    
    [UserRole.USER]: [
      Permission.VIEW_COUNTRY,
      Permission.VIEW_ECONOMIC_DATA,
      Permission.VIEW_HISTORICAL_DATA,
      Permission.VIEW_ANALYTICS,
      Permission.EXPORT_DATA,
    ],
    
    [UserRole.COUNTRY_OWNER]: [
      Permission.VIEW_COUNTRY,
      Permission.EDIT_COUNTRY,
      Permission.MANAGE_COUNTRY,
      Permission.VIEW_ECONOMIC_DATA,
      Permission.EDIT_ECONOMIC_DATA,
      Permission.VIEW_HISTORICAL_DATA,
      Permission.VIEW_ANALYTICS,
      Permission.ADVANCED_ANALYTICS,
      Permission.CREATE_SCENARIOS,
      Permission.EXPORT_DATA,
      Permission.CREATE_DM_INPUT,
    ],
    
    [UserRole.MODERATOR]: [
      // All country owner permissions plus
      ...AccessControlManager.getRolePermissions(UserRole.COUNTRY_OWNER),
      Permission.MANAGE_DM_INPUTS,
      Permission.VIEW_SDI,
      Permission.VIEW_ECI,
      Permission.VIEW_ADMIN_PANEL,
      Permission.VIEW_SYSTEM_LOGS,
    ],
    
    [UserRole.ADMIN]: [
      // All moderator permissions plus
      ...AccessControlManager.getRolePermissions(UserRole.MODERATOR),
      Permission.GLOBAL_DM_INPUT,
      Permission.MANAGE_USERS,
      Permission.SYSTEM_CONFIG,
      Permission.MANAGE_SDI,
      Permission.MANAGE_ECI,
      Permission.PREDICTIVE_MODELING,
      Permission.DATABASE_ACCESS,
    ],
    
    [UserRole.SUPER_ADMIN]: [
      // All permissions
      ...Object.values(Permission)
    ]
  };

  // Production safety check
  private static readonly IS_PRODUCTION = process.env.NODE_ENV === 'production';

  private static readonly PREVIEW_USERS: Record<string, UserAccessProfile> = {
    // Super Admin for full system access
    "admin_preview": {
      userId: "admin_preview",
      role: UserRole.SUPER_ADMIN,
      permissions: AccessControlManager.getRolePermissions(UserRole.SUPER_ADMIN),
      features: {
        isPremium: true,
        hasSdiAccess: true,
        hasEciAccess: true,
        canCreateCountries: true
      },
      limits: {
        maxScenarios: 100,
        maxExportsPerDay: 1000,
        maxDmInputsPerMonth: 500
      }
    },
    
    // Demo admin with moderate privileges
    "demo_admin": {
      userId: "demo_admin",
      role: UserRole.ADMIN,
      permissions: AccessControlManager.getRolePermissions(UserRole.ADMIN),
      features: {
        isPremium: true,
        hasSdiAccess: true,
        hasEciAccess: true,
        canCreateCountries: true
      },
      limits: {
        maxScenarios: 50,
        maxExportsPerDay: 200,
        maxDmInputsPerMonth: 100
      }
    },
    
    // Demo moderator
    "demo_moderator": {
      userId: "demo_moderator",
      role: UserRole.MODERATOR,
      permissions: AccessControlManager.getRolePermissions(UserRole.MODERATOR),
      features: {
        isPremium: true,
        hasSdiAccess: true,
        hasEciAccess: false,
        canCreateCountries: false
      },
      limits: {
        maxScenarios: 25,
        maxExportsPerDay: 50,
        maxDmInputsPerMonth: 20
      }
    }
  };

  /**
   * Get permissions for a specific role
   */
  private static getRolePermissions(role: UserRole): Permission[] {
    return this.ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Get user access profile (checks preview users first, then database)
   */
  public static async getUserAccessProfile(
    userId: string,
    countryId?: string
  ): Promise<UserAccessProfile> {
    // Check if this is a preview user (disabled in production)
    if (!this.IS_PRODUCTION && this.PREVIEW_USERS[userId]) {
      const profile = this.PREVIEW_USERS[userId];
      return {
        ...profile,
        countryId: countryId || profile.countryId
      };
    }

    // For regular users, determine role based on country ownership
    const role = countryId ? UserRole.COUNTRY_OWNER : UserRole.USER;
    
    return {
      userId,
      role,
      countryId,
      permissions: this.getRolePermissions(role),
      features: {
        isPremium: false,
        hasSdiAccess: false,
        hasEciAccess: false,
        canCreateCountries: false
      },
      limits: {
        maxScenarios: role === UserRole.COUNTRY_OWNER ? 10 : 3,
        maxExportsPerDay: role === UserRole.COUNTRY_OWNER ? 20 : 5,
        maxDmInputsPerMonth: role === UserRole.COUNTRY_OWNER ? 5 : 0
      }
    };
  }

  /**
   * Check if user has specific permission
   */
  public static async hasPermission(
    userId: string,
    permission: Permission,
    countryId?: string
  ): Promise<boolean> {
    const profile = await this.getUserAccessProfile(userId, countryId);
    return profile.permissions.includes(permission);
  }

  /**
   * Check if user can access a specific country
   */
  public static async canAccessCountry(
    userId: string,
    targetCountryId: string,
    accessType: 'view' | 'edit' | 'manage' = 'view'
  ): Promise<boolean> {
    const profile = await this.getUserAccessProfile(userId);
    
    // Super admins and admins can access any country
    if (profile.role === UserRole.SUPER_ADMIN || profile.role === UserRole.ADMIN) {
      return true;
    }
    
    // Moderators can view any country, edit their own
    if (profile.role === UserRole.MODERATOR) {
      if (accessType === 'view') return true;
      return profile.countryId === targetCountryId;
    }
    
    // Country owners can only access their own country
    if (profile.role === UserRole.COUNTRY_OWNER) {
      return profile.countryId === targetCountryId;
    }
    
    // Regular users and guests can only view
    return accessType === 'view';
  }

  /**
   * Check feature access (premium, SDI, ECI)
   */
  public static async hasFeatureAccess(
    userId: string,
    feature: keyof UserAccessProfile['features']
  ): Promise<boolean> {
    const profile = await this.getUserAccessProfile(userId);
    return profile.features[feature];
  }

  /**
   * Check if user is within usage limits
   */
  public static async isWithinLimits(
    userId: string,
    limitType: keyof UserAccessProfile['limits'],
    currentUsage: number
  ): Promise<boolean> {
    const profile = await this.getUserAccessProfile(userId);
    const limit = profile.limits[limitType];
    return currentUsage < limit;
  }

  /**
   * Get available preview users for testing
   */
  public static getPreviewUsers(): Array<{
    userId: string;
    role: UserRole;
    features: string[];
  }> {
    return Object.entries(this.PREVIEW_USERS).map(([userId, profile]) => ({
      userId,
      role: profile.role,
      features: Object.entries(profile.features)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => feature)
    }));
  }

  /**
   * Middleware-style permission checker
   */
  public static createPermissionChecker(requiredPermission: Permission) {
    return async (userId: string, countryId?: string): Promise<boolean> => {
      return this.hasPermission(userId, requiredPermission, countryId);
    };
  }

  /**
   * Generate access control configuration for frontend
   */
  public static async getFrontendConfig(userId: string): Promise<{
    role: UserRole;
    permissions: Permission[];
    features: UserAccessProfile['features'];
    limits: UserAccessProfile['limits'];
  }> {
    const profile = await this.getUserAccessProfile(userId);
    
    return {
      role: profile.role,
      permissions: profile.permissions,
      features: profile.features,
      limits: profile.limits
    };
  }
}

/**
 * Access control decorators for API endpoints
 */
export function requirePermission(permission: Permission) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const ctx = args[0]?.ctx;
      const userId = ctx?.headers?.get?.('x-user-id') || ctx?.user?.id;
      
      if (!userId) {
        throw new Error('Authentication required');
      }
      
      const hasAccess = await AccessControlManager.hasPermission(userId, permission);
      if (!hasAccess) {
        throw new Error(`Permission denied: ${permission}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

export function requireRole(role: UserRole) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const ctx = args[0]?.ctx;
      const userId = ctx?.headers?.get?.('x-user-id') || ctx?.user?.id;
      
      if (!userId) {
        throw new Error('Authentication required');
      }
      
      const profile = await AccessControlManager.getUserAccessProfile(userId);
      const roleHierarchy = [
        UserRole.GUEST,
        UserRole.USER,
        UserRole.COUNTRY_OWNER,
        UserRole.MODERATOR,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN
      ];
      
      const userRoleLevel = roleHierarchy.indexOf(profile.role);
      const requiredRoleLevel = roleHierarchy.indexOf(role);
      
      if (userRoleLevel < requiredRoleLevel) {
        throw new Error(`Insufficient role: requires ${role}, has ${profile.role}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Preview authentication helper
 */
export class PreviewAuth {
  /**
   * Generate preview session for testing different roles
   */
  public static createPreviewSession(role: UserRole, countryId?: string): {
    userId: string;
    sessionToken: string;
    expiresAt: number;
  } {
    const userId = `preview_${role}_${Date.now()}`;
    const sessionToken = Buffer.from(JSON.stringify({
      userId,
      role,
      countryId,
      isPreview: true,
      createdAt: Date.now()
    })).toString('base64');
    
    return {
      userId,
      sessionToken,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
  }

  /**
   * Validate preview session
   */
  public static validatePreviewSession(sessionToken: string): {
    userId: string;
    role: UserRole;
    countryId?: string;
    isValid: boolean;
  } {
    try {
      const decoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
      const isValid = decoded.isPreview && (Date.now() - decoded.createdAt) < (24 * 60 * 60 * 1000);
      
      return {
        userId: decoded.userId,
        role: decoded.role,
        countryId: decoded.countryId,
        isValid
      };
    } catch {
      return {
        userId: '',
        role: UserRole.GUEST,
        isValid: false
      };
    }
  }
}