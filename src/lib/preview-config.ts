// IxStats Private Preview Configuration
// Centralized configuration for preview mode, testing, and demo features

import { UserRole, AccessControlManager } from "./access-control";
import { seedPreviewDatabase } from "./preview-seeder";

export interface PreviewConfig {
  isPreviewMode: boolean;
  demoUsers: DemoUser[];
  features: {
    enabledModules: string[];
    mockDataEnabled: boolean;
    debugMode: boolean;
    performanceMonitoring: boolean;
  };
  simulation: {
    acceleratedTime: boolean;
    autoGenerateEvents: boolean;
    realTimeUpdates: boolean;
    maxCountries: number;
  };
  ui: {
    showPreviewBanner: boolean;
    enableDevTools: boolean;
    showPerformanceMetrics: boolean;
    glassmorphicTheme: boolean;
  };
}

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  countryId?: string;
  countryName?: string;
  description: string;
  credentials: {
    username: string;
    password: string;
  };
}

export class PreviewConfigManager {
  // Production safety check
  private static readonly IS_PRODUCTION = process.env.NODE_ENV === 'production';

  private static readonly DEFAULT_CONFIG: PreviewConfig = {
    isPreviewMode: true,
    demoUsers: [
      {
        id: "admin_preview",
        email: "admin@ixstats.preview",
        name: "Alex Administrator",
        role: UserRole.SUPER_ADMIN,
        description: "Full system administrator with all permissions",
        credentials: {
          username: "admin",
          password: "preview2024"
        }
      },
      {
        id: "demo_admin",
        email: "demo.admin@ixstats.preview",
        name: "Sam Executive",
        role: UserRole.ADMIN,
        description: "Administrative user with economic management powers",
        credentials: {
          username: "demo_admin",
          password: "demo2024"
        }
      },
      {
        id: "demo_moderator",
        email: "moderator@ixstats.preview",
        name: "Jordan Analyst",
        role: UserRole.MODERATOR,
        description: "Economic analyst with SDI access and moderation tools",
        credentials: {
          username: "moderator",
          password: "analyst2024"
        }
      },
      {
        id: "country_owner_1",
        email: "valdoria@ixstats.preview",
        name: "Maria Valdez",
        role: UserRole.COUNTRY_OWNER,
        countryId: "country_valdoria",
        countryName: "Valdoria",
        description: "Leader of Valdoria - developing economy country",
        credentials: {
          username: "valdoria",
          password: "leader2024"
        }
      },
      {
        id: "country_owner_2",
        email: "asteria@ixstats.preview",
        name: "Viktor Sterling",
        role: UserRole.COUNTRY_OWNER,
        countryId: "country_asteria",
        countryName: "Asteria",
        description: "Leader of Asteria - strong economy country",
        credentials: {
          username: "asteria",
          password: "leader2024"
        }
      },
      {
        id: "regular_user",
        email: "observer@ixstats.preview",
        name: "Casey Observer",
        role: UserRole.USER,
        description: "Regular user with viewing permissions",
        credentials: {
          username: "observer",
          password: "view2024"
        }
      }
    ],
    features: {
      enabledModules: [
        "countries",
        "analytics", 
        "modals",
        "scenarios",
        "admin",
        "sdi",
        "eci"
      ],
      mockDataEnabled: false, // Disabled - using real API data now
      debugMode: true,
      performanceMonitoring: true
    },
    simulation: {
      acceleratedTime: true,
      autoGenerateEvents: true,
      realTimeUpdates: true,
      maxCountries: 25
    },
    ui: {
      showPreviewBanner: true,
      enableDevTools: true,
      showPerformanceMetrics: false,
      glassmorphicTheme: true
    }
  };

  /**
   * Get current preview configuration
   * @throws Error in production environment
   */
  public static getConfig(): PreviewConfig {
    if (this.IS_PRODUCTION) {
      throw new Error('Preview configuration system is disabled in production');
    }

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ixstats_preview_config');
      if (saved) {
        try {
          return { ...this.DEFAULT_CONFIG, ...JSON.parse(saved) };
        } catch {
          // Fall back to default if parsing fails
        }
      }
    }
    return this.DEFAULT_CONFIG;
  }

  /**
   * Update preview configuration
   * @throws Error in production environment
   */
  public static updateConfig(updates: Partial<PreviewConfig>): void {
    if (this.IS_PRODUCTION) {
      throw new Error('Preview configuration system is disabled in production');
    }

    if (typeof window !== 'undefined') {
      const current = this.getConfig();
      const updated = { ...current, ...updates };
      localStorage.setItem('ixstats_preview_config', JSON.stringify(updated));
    }
  }

  /**
   * Get demo user by credentials
   */
  public static getDemoUser(username: string, password: string): DemoUser | null {
    const config = this.getConfig();
    return config.demoUsers.find(user => 
      user.credentials.username === username && 
      user.credentials.password === password
    ) || null;
  }

  /**
   * Get demo user by ID
   */
  public static getDemoUserById(id: string): DemoUser | null {
    const config = this.getConfig();
    return config.demoUsers.find(user => user.id === id) || null;
  }

  /**
   * Initialize preview environment
   * @throws Error in production environment
   */
  public static async initializePreview(): Promise<void> {
    if (this.IS_PRODUCTION) {
      throw new Error('Preview initialization is disabled in production');
    }

    console.log("🚀 Initializing IxStats Private Preview...");

    const config = this.getConfig();
    
    // Show preview banner
    if (config.ui.showPreviewBanner) {
      this.showPreviewBanner();
    }
    
    // Initialize mock data if enabled
    if (config.features.mockDataEnabled) {
      console.log("📊 Mock data system enabled");
      // Mock data will be generated by the seeder
    }
    
    // Enable performance monitoring
    if (config.features.performanceMonitoring) {
      this.enablePerformanceMonitoring();
    }
    
    // Setup development tools
    if (config.ui.enableDevTools) {
      this.setupDevTools();
    }
    
    console.log("✅ Preview environment initialized");
  }

  /**
   * Show preview banner in UI
   */
  private static showPreviewBanner(): void {
    if (typeof window === 'undefined') return;
    
    // Create banner element
    const banner = document.createElement('div');
    banner.id = 'preview-banner';
    banner.className = 'fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 text-center text-sm font-medium';
    banner.innerHTML = `
      🚧 IxStats Private Preview - Demo Environment 
      <span class="ml-4 text-xs opacity-75">Not for production use</span>
      <button onclick="this.parentElement.style.display='none'" class="ml-4 text-white hover:text-gray-200">×</button>
    `;
    
    // Insert at the beginning of body
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Add padding to main content
    const main = document.querySelector('main') || document.body;
    if (main) {
      main.style.marginTop = '40px';
    }
  }

  /**
   * Enable performance monitoring
   */
  private static enablePerformanceMonitoring(): void {
    if (typeof window === 'undefined') return;
    
    // Monitor page load performance
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (perfData) {
        console.log('📊 Page Performance:', {
          loadTime: Math.round(perfData.loadEventEnd - perfData.loadEventStart),
          domContentLoaded: Math.round(perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart),
          firstPaint: Math.round(performance.getEntriesByName('first-paint')[0]?.startTime || 0),
          firstContentfulPaint: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0)
        });
      }
    });
    
    // Monitor resource loading
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const slowResources = entries.filter(entry => entry.duration > 1000);
      if (slowResources.length > 0) {
        console.warn('⚠️ Slow resources detected:', slowResources.map(r => ({
          name: r.name,
          duration: Math.round(r.duration)
        })));
      }
    });
    
    try {
      observer.observe({ entryTypes: ['resource'] });
    } catch (e) {
      console.log('Performance Observer not supported');
    }
  }

  /**
   * Setup development tools
   */
  private static setupDevTools(): void {
    if (typeof window === 'undefined') return;
    
    // Add global utilities for debugging
    (window as any).IxStatsDebug = {
      getConfig: () => this.getConfig(),
      updateConfig: (updates: Partial<PreviewConfig>) => this.updateConfig(updates),
      getDemoUsers: () => this.getConfig().demoUsers,
      clearPreviewData: () => {
        localStorage.removeItem('ixstats_preview_config');
        console.log('Preview configuration cleared');
      },
      toggleFeature: (feature: string) => {
        const config = this.getConfig();
        const enabled = config.features.enabledModules;
        const index = enabled.indexOf(feature);
        if (index > -1) {
          enabled.splice(index, 1);
          console.log(`Disabled feature: ${feature}`);
        } else {
          enabled.push(feature);
          console.log(`Enabled feature: ${feature}`);
        }
        this.updateConfig({ features: { ...config.features, enabledModules: enabled } });
      },
      simulateError: (component: string) => {
        console.error(`Simulated error in ${component}:`, new Error('Preview error simulation'));
      },
      generateMockData: () => {
        console.log('Mock data generation would be triggered here');
      }
    };
    
    console.log('🔧 Development tools available as window.IxStatsDebug');
  }

  /**
   * Get authentication configuration for demo users
   */
  public static getAuthConfig(): {
    provider: string;
    demoMode: boolean;
    demoUsers: Array<{
      username: string;
      role: string;
      country?: string;
    }>;
  } {
    const config = this.getConfig();
    
    return {
      provider: 'demo',
      demoMode: true,
      demoUsers: config.demoUsers.map(user => ({
        username: user.credentials.username,
        role: user.role,
        country: user.countryName
      }))
    };
  }

  /**
   * Get feature flags for frontend
   */
  public static getFeatureFlags(): Record<string, boolean> {
    const config = this.getConfig();
    
    return {
      // Module flags
      countriesModule: config.features.enabledModules.includes('countries'),
      analyticsModule: config.features.enabledModules.includes('analytics'),
      modalsModule: config.features.enabledModules.includes('modals'),
      scenariosModule: config.features.enabledModules.includes('scenarios'),
      adminModule: config.features.enabledModules.includes('admin'),
      sdiModule: config.features.enabledModules.includes('sdi'),
      eciModule: config.features.enabledModules.includes('eci'),
      
      // Feature flags
      mockDataEnabled: config.features.mockDataEnabled,
      debugMode: config.features.debugMode,
      performanceMonitoring: config.features.performanceMonitoring,
      acceleratedTime: config.simulation.acceleratedTime,
      autoGenerateEvents: config.simulation.autoGenerateEvents,
      realTimeUpdates: config.simulation.realTimeUpdates,
      
      // UI flags
      showPreviewBanner: config.ui.showPreviewBanner,
      enableDevTools: config.ui.enableDevTools,
      showPerformanceMetrics: config.ui.showPerformanceMetrics,
      glassmorphicTheme: config.ui.glassmorphicTheme,
    };
  }

  /**
   * Create database seeding script
   */
  public static async seedDatabase(): Promise<void> {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const db = new PrismaClient();
      
      await seedPreviewDatabase(db, {
        countriesCount: this.getConfig().simulation.maxCountries,
        usersCount: this.getConfig().demoUsers.length,
        historicalMonths: 24,
        clearExisting: true
      });
      
      console.log("✅ Database seeded successfully");
      await db.$disconnect();
    } catch (error) {
      console.error("❌ Database seeding failed:", error);
      throw error;
    }
  }

  /**
   * Generate preview documentation
   */
  public static generatePreviewDocs(): {
    users: DemoUser[];
    features: string[];
    endpoints: string[];
    testingGuide: string[];
  } {
    const config = this.getConfig();
    
    return {
      users: config.demoUsers,
      features: config.features.enabledModules,
      endpoints: [
        'GET /api/countries - List all countries',
        'GET /api/countries/{id} - Get country details',
        'POST /api/countries/{id}/economic-data - Update economic data',
        'GET /api/admin/system-status - System status',
        'POST /api/admin/dm-inputs - Create DM input',
        'GET /api/analytics/global-stats - Global statistics'
      ],
      testingGuide: [
        '1. Use demo credentials to log in with different roles',
        '2. Test country management features with country owner accounts',
        '3. Verify admin controls with admin accounts',
        '4. Test analytics and modal functionality',
        '5. Create scenarios and DM inputs',
        '6. Verify real-time updates and calculations'
      ]
    };
  }
}

// Initialize preview mode when module loads
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      PreviewConfigManager.initializePreview().catch(console.error);
    });
  } else {
    PreviewConfigManager.initializePreview().catch(console.error);
  }
}