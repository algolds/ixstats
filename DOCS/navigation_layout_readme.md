# Navigation & Layout System Implementation Guide
*Unified navigation and layout architecture for IxStats*

## 📋 Overview

The Navigation & Layout System provides the foundational structure for the entire IxStats application, ensuring consistent navigation patterns, responsive design, and seamless user experience across all pages and components.

### Key Objectives
- **Unified Navigation**: Consistent navigation patterns across all pages
- **Responsive Design**: Fluid layouts that work on all device sizes
- **Context-Aware**: Navigation adapts based on user state and permissions
- **Performance**: Efficient rendering and minimal layout shifts
- **Accessibility**: Full keyboard navigation and screen reader support
- **Premium Feel**: Sophisticated glassmorphism and animation effects

---

## 🏗️ System Architecture

### Core Navigation Components
```
src/components/layout/
├── AppShell.tsx                    # Main application wrapper
├── Header/
│   ├── AppHeader.tsx              # Primary application header
│   ├── UserNav.tsx                # User-specific navigation
│   ├── NotificationCenter.tsx     # Global notifications
│   └── QuickSearch.tsx            # Global search functionality
├── Navigation/
│   ├── PrimaryNav.tsx             # Main navigation menu
│   ├── SecondaryNav.tsx           # Context-specific navigation
│   ├── BreadcrumbNav.tsx          # Breadcrumb navigation
│   ├── FloatingDock.tsx           # Bottom floating navigation
│   └── MobileNav.tsx              # Mobile-optimized navigation
├── Sidebar/
│   ├── AppSidebar.tsx             # Collapsible sidebar
│   ├── ContextualSidebar.tsx      # Page-specific sidebar content
│   └── QuickActions.tsx           # Sidebar quick actions
├── Footer/
│   ├── AppFooter.tsx              # Application footer
│   └── StatusBar.tsx              # System status indicators
└── Layout/
    ├── PageLayout.tsx             # Standard page layout
    ├── DashboardLayout.tsx        # Dashboard-specific layout
    ├── AuthLayout.tsx             # Authentication pages layout
    └── ErrorLayout.tsx            # Error page layout
```

### Navigation State Management
```typescript
interface NavigationState {
  // Current navigation context
  currentPage: string;
  currentSection: string;
  breadcrumbs: BreadcrumbItem[];
  
  // User context
  user: User | null;
  userCountry: Country | null;
  permissions: Permission[];
  
  // UI state
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  searchOpen: boolean;
  notificationsPanelOpen: boolean;
  
  // System state
  isOnline: boolean;
  systemStatus: 'operational' | 'maintenance' | 'degraded';
  ixTime: IxTimeState;
  
  // Navigation preferences
  preferredLayout: 'comfortable' | 'compact' | 'dense';
  animationsEnabled: boolean;
  keyboardShortcutsEnabled: boolean;
}

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
  isCurrentPage?: boolean;
}

interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
  permission?: string;
  children?: NavigationItem[];
  external?: boolean;
  premium?: boolean;
}
```

---

## 🧩 Core Component Implementation

### 1. App Shell Layout
```tsx
// components/layout/AppShell.tsx
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { AppHeader } from './Header/AppHeader';
import { AppSidebar } from './Sidebar/AppSidebar';
import { AppFooter } from './Footer/AppFooter';
import { FloatingDock } from './Navigation/FloatingDock';
import { NotificationCenter } from './Header/NotificationCenter';
import { CommandPalette } from './Navigation/CommandPalette';
import { useNavigationState } from '@/hooks/use-navigation-state';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  layout?: 'default' | 'dashboard' | 'fullscreen' | 'auth';
  showSidebar?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  showFloatingDock?: boolean;
}

export function AppShell({
  children,
  layout = 'default',
  showSidebar = true,
  showHeader = true,
  showFooter = true,
  showFloatingDock = true
}: AppShellProps) {
  const { user } = useUser();
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
    commandPaletteOpen,
    setCommandPaletteOpen
  } = useNavigationState();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'mod+k': () => setCommandPaletteOpen(true),
    'mod+b': () => setSidebarCollapsed(!sidebarCollapsed),
    'mod+/': () => setMobileMenuOpen(!mobileMenuOpen),
    'escape': () => {
      setCommandPaletteOpen(false);
      setMobileMenuOpen(false);
    }
  });

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Check on mount

    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarCollapsed]);

  // Layout variations
  const layoutClasses = {
    default: 'app-shell-default',
    dashboard: 'app-shell-dashboard', 
    fullscreen: 'app-shell-fullscreen',
    auth: 'app-shell-auth'
  };

  return (
    <div className={cn('app-shell', layoutClasses[layout])}>
      {/* Background Effects */}
      <div className="app-background">
        <div className="aurora-bg-subtle absolute inset-0 opacity-10" />
        <div className="grid-pattern absolute inset-0 opacity-5" />
      </div>

      {/* Header */}
      {showHeader && (
        <AppHeader
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
      )}

      {/* Main Content Area */}
      <div className="app-content-wrapper">
        {/* Sidebar */}
        {showSidebar && user && (
          <AppSidebar
            collapsed={sidebarCollapsed}
            mobileOpen={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <main 
          className={cn(
            'app-main-content',
            showSidebar && !sidebarCollapsed && 'with-sidebar',
            showSidebar && sidebarCollapsed && 'with-sidebar-collapsed'
          )}
        >
          <div className="content-container">
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      {showFooter && <AppFooter />}

      {/* Floating Navigation */}
      {showFloatingDock && user && <FloatingDock />}

      {/* Global Overlays */}
      <NotificationCenter />
      <CommandPalette 
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="mobile-menu-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
```

### 2. Enhanced App Header
```tsx
// components/layout/Header/AppHeader.tsx
'use client';

import { GlassCard } from '@/components/ui/enhanced-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserNav } from './UserNav';
import { QuickSearch } from './QuickSearch';
import { NotificationButton } from './NotificationButton';
import { IxTimeDisplay } from '@/components/ui/ixtime-display';
import { SystemStatusIndicator } from './SystemStatusIndicator';
import { 
  Menu, 
  Search, 
  Command, 
  Bell,
  Settings,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';

interface AppHeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenCommandPalette: () => void;
}

export function AppHeader({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenCommandPalette
}: AppHeaderProps) {
  const { data: systemStatus } = api.system.getStatus.useQuery();
  const { data: notifications } = api.notifications.getUnread.useQuery();

  return (
    <header className="app-header sticky top-0 z-50">
      <GlassCard variant="glass" className="header-card rounded-none border-x-0 border-t-0">
        <div className="flex items-center justify-between h-16 px-4 lg:px-6">
          
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleSidebar}
              className="glass-button lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo & Brand */}
            <Link href="/" className="flex items-center gap-3">
              <div className="app-logo w-8 h-8">
                <img 
                  src="/ixstats-logo.png" 
                  alt="IxStats" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="brand-text hidden sm:block">
                <h1 className="text-xl font-bold text-foreground">IxStats</h1>
                <p className="text-xs text-muted-foreground">Nation Management</p>
              </div>
            </Link>
          </div>

          {/* Center Section - Search */}
          <div className="flex-1 max-w-md mx-4">
            <QuickSearch onOpenCommandPalette={onOpenCommandPalette} />
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            
            {/* System Status */}
            <SystemStatusIndicator status={systemStatus} />
            
            {/* IxTime Display */}
            <IxTimeDisplay 
              variant="compact"
              className="hidden md:block glass-time-display"
            />

            {/* Command Palette Trigger */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenCommandPalette}
              className="glass-button hidden lg:flex"
            >
              <Command className="h-4 w-4 mr-2" />
              <span className="text-sm">⌘K</span>
            </Button>

            {/* Notifications */}
            <NotificationButton 
              count={notifications?.count || 0}
              hasUnread={notifications && notifications.count > 0}
            />

            {/* Help */}
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="glass-button"
            >
              <Link href="/help">
                <HelpCircle className="h-5 w-5" />
              </Link>
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="glass-button"
            >
              <Link href="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>

            {/* User Navigation */}
            <UserNav />
          </div>
        </div>
      </GlassCard>
    </header>
  );
}
```

### 3. Dynamic Sidebar System
```tsx
// components/layout/Sidebar/AppSidebar.tsx
'use client';

import { useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { GlassCard } from '@/components/ui/enhanced-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown,
  ChevronRight,
  Home,
  Globe,
  BarChart3,
  Crown,
  Settings,
  Users,
  MessageSquare,
  Map,
  TrendingUp,
  Shield,
  Star
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}

export function AppSidebar({ collapsed, mobileOpen, onClose }: AppSidebarProps) {
  const { user } = useUser();
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>(['main']);

  // Get user's country data for personalized navigation
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // Dynamic navigation based on user permissions and country status
  const navigationItems = useMemo(() => {
    const baseItems: NavigationSection[] = [
      {
        id: 'main',
        label: 'Main',
        items: [
          {
            id: 'dashboard',
            label: 'Dashboard',
            href: '/',
            icon: Home,
            active: pathname === '/'
          },
          {
            id: 'directory',
            label: 'International Directory',
            href: '/countries',
            icon: Globe,
            active: pathname.startsWith('/countries') && !pathname.startsWith('/countries/my')
          },
          {
            id: 'analytics',
            label: 'Global Analytics',
            href: '/analytics',
            icon: BarChart3,
            active: pathname.startsWith('/analytics')
          }
        ]
      }
    ];

    // Add MyCountry® section if user has a country
    if (userProfile?.countryId) {
      baseItems.push({
        id: 'mycountry',
        label: 'MyCountry®',
        premium: true,
        items: [
          {
            id: 'my-dashboard',
            label: 'Nation Dashboard',
            href: '/mycountry/dashboard',
            icon: Crown,
            active: pathname.startsWith('/mycountry/dashboard'),
            premium: true
          },
          {
            id: 'government',
            label: 'Government',
            href: '/mycountry/government',
            icon: Shield,
            active: pathname.startsWith('/mycountry/government')
          },
          {
            id: 'economy',
            label: 'Economy',
            href: '/mycountry/economy',
            icon: TrendingUp,
            active: pathname.startsWith('/mycountry/economy')
          },
          {
            id: 'demographics',
            label: 'Demographics',
            href: '/mycountry/demographics',
            icon: Users,
            active: pathname.startsWith('/mycountry/demographics')
          },
          {
            id: 'diplomacy',
            label: 'Diplomacy',
            href: '/mycountry/diplomacy',
            icon: MessageSquare,
            active: pathname.startsWith('/mycountry/diplomacy')
          }
        ]
      });
    } else {
      // Add setup item if no country
      baseItems[0].items.push({
        id: 'setup',
        label: 'Setup MyCountry®',
        href: '/mycountry/setup',
        icon: Star,
        active: pathname.startsWith('/mycountry/setup'),
        badge: 'Setup'
      });
    }

    // Add tools section
    baseItems.push({
      id: 'tools',
      label: 'Tools',
      items: [
        {
          id: 'map',
          label: 'World Map',
          href: '/map',
          icon: Map,
          active: pathname.startsWith('/map')
        },
        {
          id: 'compare',
          label: 'Nation Compare',
          href: '/compare',
          icon: BarChart3,
          active: pathname.startsWith('/compare')
        }
      ]
    });

    // Add admin section for admins
    if (user?.publicMetadata?.role === 'admin') {
      baseItems.push({
        id: 'admin',
        label: 'Administration',
        items: [
          {
            id: 'admin-dashboard',
            label: 'Admin Dashboard',
            href: '/admin',
            icon: Settings,
            active: pathname.startsWith('/admin'),
            permission: 'admin'
          }
        ]
      });
    }

    return baseItems;
  }, [pathname, userProfile?.countryId, user?.publicMetadata?.role]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          'app-sidebar fixed left-0 top-16 bottom-0 z-40 transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          'hidden lg:block'
        )}
      >
        <GlassCard 
          variant="glass" 
          className="sidebar-card h-full rounded-none border-y-0 border-l-0"
        >
          <ScrollArea className="h-full">
            <nav className="sidebar-nav p-4">
              {navigationItems.map((section) => (
                <SidebarSection
                  key={section.id}
                  section={section}
                  collapsed={collapsed}
                  expanded={expandedSections.includes(section.id)}
                  onToggle={() => toggleSection(section.id)}
                />
              ))}
            </nav>
          </ScrollArea>
        </GlassCard>
      </aside>

      {/* Mobile Sidebar */}
      <div 
        className={cn(
          'mobile-sidebar fixed inset-0 z-50 lg:hidden',
          mobileOpen ? 'block' : 'hidden'
        )}
      >
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Sidebar Panel */}
        <aside className="absolute left-0 top-0 bottom-0 w-80 max-w-[80vw]">
          <GlassCard variant="glass" className="sidebar-panel h-full rounded-none">
            <ScrollArea className="h-full">
              <nav className="sidebar-nav p-4">
                {navigationItems.map((section) => (
                  <SidebarSection
                    key={section.id}
                    section={section}
                    collapsed={false}
                    expanded={expandedSections.includes(section.id)}
                    onToggle={() => toggleSection(section.id)}
                    onItemClick={onClose}
                  />
                ))}
              </nav>
            </ScrollArea>
          </GlassCard>
        </aside>
      </div>
    </>
  );
}

// Sidebar Section Component
function SidebarSection({
  section,
  collapsed,
  expanded,
  onToggle,
  onItemClick
}: {
  section: NavigationSection;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
}) {
  return (
    <div className="sidebar-section mb-6">
      {/* Section Header */}
      {!collapsed && (
        <Collapsible open={expanded} onOpenChange={onToggle}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="section-header w-full justify-between p-2 h-auto glass-button"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {section.label}
                </span>
                {section.premium && (
                  <Badge variant="premium" className="text-xs glass-badge">
                    Premium
                  </Badge>
                )}
              </div>
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-1 mt-2">
            {section.items.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                collapsed={collapsed}
                onClick={onItemClick}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Collapsed State - Show icons only */}
      {collapsed && (
        <div className="space-y-1">
          {section.items.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              collapsed={collapsed}
              onClick={onItemClick}
            />
          ))}
        </div>
      )}
      
      {!collapsed && <Separator className="mt-4" />}
    </div>
  );
}

// Sidebar Item Component
function SidebarItem({
  item,
  collapsed,
  onClick
}: {
  item: NavigationItem;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  
  return (
    <Button
      variant={item.active ? "default" : "ghost"}
      size="sm"
      asChild
      className={cn(
        "sidebar-item w-full justify-start glass-button",
        collapsed ? "px-2" : "px-3",
        item.premium && "premium-item",
        item.active && "active-item"
      )}
      onClick={onClick}
    >
      <Link href={item.href}>
        <Icon className={cn("h-4 w-4", !collapsed && "mr-3")} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <Badge variant="secondary" className="ml-auto glass-badge text-xs">
                {item.badge}
              </Badge>
            )}
            {item.premium && (
              <Star className="h-3 w-3 ml-1 text-yellow-500" />
            )}
          </>
        )}
      </Link>
    </Button>
  );
}

// Types
interface NavigationSection {
  id: string;
  label: string;
  premium?: boolean;
  items: NavigationItem[];
}

interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: any;
  active: boolean;
  badge?: string;
  premium?: boolean;
  permission?: string;
}
```

### 4. Floating Dock Navigation
```tsx
// components/layout/Navigation/FloatingDock.tsx
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { GlassCard } from '@/components/ui/enhanced-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Home,
  Globe,
  BarChart3,
  Crown,
  Settings,
  Plus,
  Command,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function FloatingDock() {
  const { user } = useUser();
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Get user's country data
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // Get notification count
  const { data: notifications } = api.notifications.getUnread.useQuery();

  // Hide/show dock based on scroll direction
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < lastScrollY || currentScrollY < 100) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Primary navigation items
  const dockItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/',
      icon: Home,
      active: pathname === '/',
      shortcut: '⌘1'
    },
    {
      id: 'directory',
      label: 'Nations',
      href: '/countries',
      icon: Globe,
      active: pathname.startsWith('/countries') && !pathname.includes('mycountry'),
      shortcut: '⌘2'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      active: pathname.startsWith('/analytics'),
      shortcut: '⌘3'
    },
    // MyCountry® or Setup
    userProfile?.countryId ? {
      id: 'mycountry',
      label: 'MyCountry®',
      href: '/mycountry/dashboard',
      icon: Crown,
      active: pathname.startsWith('/mycountry'),
      premium: true,
      shortcut: '⌘4'
    } : {
      id: 'setup',
      label: 'Setup Nation',
      href: '/mycountry/setup',
      icon: Plus,
      active: pathname.startsWith('/mycountry/setup'),
      badge: 'New',
      shortcut: '⌘4'
    },
    {
      id: 'messages',
      label: 'Messages',
      href: '/messages',
      icon: MessageSquare,
      active: pathname.startsWith('/messages'),
      badge: notifications?.count || undefined,
      shortcut: '⌘5'
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/settings',
      icon: Settings,
      active: pathname.startsWith('/settings'),
      shortcut: '⌘,'
    }
  ];

  return (
    <TooltipProvider>
      <div 
        className={cn(
          'floating-dock fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40',
          'transition-all duration-300 ease-in-out',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        )}
      >
        <GlassCard 
          variant="glass" 
          glow="hover"
          className="dock-container backdrop-blur-xl bg-opacity-80"
        >
          <div className="flex items-center gap-2 p-3">
            {dockItems.map((item) => {
              const Icon = item.icon;
              
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={item.active ? "default" : "ghost"}
                      size="sm"
                      asChild
                      className={cn(
                        "dock-item relative w-12 h-12 p-0 glass-button",
                        item.active && "active-dock-item",
                        item.premium && "premium-dock-item"
                      )}
                    >
                      <Link href={item.href}>
                        <Icon className="h-5 w-5" />
                        
                        {/* Badge */}
                        {item.badge && (
                          <Badge 
                            variant="destructive" 
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs glass-badge"
                          >
                            {typeof item.badge === 'number' && item.badge > 9 ? '9+' : item.badge}
                          </Badge>
                        )}
                        
                        {/* Premium Indicator */}
                        {item.premium && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 border border-white/20" />
                        )}
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    className="glass-tooltip"
                    sideOffset={8}
                  >
                    <div className="flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <kbd className="px-1.5 py-0.5 text-xs bg-white/10 rounded border border-white/20">
                          {item.shortcut}
                        </kbd>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </TooltipProvider>
  );
}
```

---

## 🎨 Layout Styling System

### Responsive Design Patterns
```css
/* Enhanced responsive layout system */
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.app-content-wrapper {
  flex: 1;
  display: flex;
  min-height: 0; /* Allow flex child to shrink */
}

.app-main-content {
  flex: 1;
  min-width: 0; /* Prevent flex overflow */
  transition: margin-left 0.3s ease;
}

.app-main-content.with-sidebar {
  margin-left: 256px; /* w-64 */
}

.app-main-content.with-sidebar-collapsed {
  margin-left: 64px; /* w-16 */
}

/* Mobile overrides */
@media (max-width: 1023px) {
  .app-main-content.with-sidebar,
  .app-main-content.with-sidebar-collapsed {
    margin-left: 0;
  }
}

/* Content container */
.content-container {
  padding: 1.5rem;
  max-width: 100%;
  margin: 0 auto;
}

@media (min-width: 1024px) {
  .content-container {
    padding: 2rem;
  }
}

@media (min-width: 1280px) {
  .content-container {
    max-width: 1280px;
    padding: 2.5rem;
  }
}

/* Glass effects for navigation */
.header-card,
.sidebar-card {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

/* Floating dock styles */
.floating-dock {
  backdrop-filter: blur(20px);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.dock-item {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dock-item:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.active-dock-item {
  background: var(--color-brand-primary);
  box-shadow: 0 0 0 2px var(--color-brand-primary);
}

.premium-dock-item {
  position: relative;
  background: linear-gradient(135deg, var(--mycountry-primary), var(--mycountry-secondary));
}

/* Sidebar transitions */
.sidebar-nav {
  padding-top: 0.5rem;
}

.sidebar-section {
  animation: fadeIn 0.3s ease-out;
}

.sidebar-item {
  transition: all 0.2s ease;
  border-radius: 0.5rem;
  margin-bottom: 0.25rem;
}

.sidebar-item:hover {
  background: var(--glass-diplomatic);
  transform: translateX(4px);
}

.active-item {
  background: var(--color-brand-primary);
  color: white;
  box-shadow: 0 2px 8px rgba(var(--color-brand-primary-rgb), 0.3);
}

.premium-item {
  background: linear-gradient(135deg, var(--mycountry-primary), var(--mycountry-secondary));
  color: white;
}

/* Mobile menu overlay */
.mobile-menu-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 40;
  animation: fadeIn 0.2s ease-out;
}

.mobile-sidebar .sidebar-panel {
  transform: translateX(-100%);
  animation: slideInLeft 0.3s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInLeft {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

/* Loading states */
.navigation-skeleton {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Focus states for accessibility */
.sidebar-item:focus-visible,
.dock-item:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .header-card,
  .sidebar-card {
    border: 2px solid;
    background: var(--color-bg-primary);
  }
  
  .glass-button {
    border: 1px solid var(--color-border-primary);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .app-main-content,
  .sidebar-item,
  .dock-item,
  .floating-dock {
    transition: none;
  }
  
  .sidebar-section {
    animation: none;
  }
}
```

---

## 🎯 Advanced Navigation Features

### Command Palette Implementation
```tsx
// components/layout/Navigation/CommandPalette.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Search suggestions from API
  const { data: searchResults } = api.search.global.useQuery(
    { query: debouncedSearch },
    { 
      enabled: debouncedSearch.length > 2 && open,
      staleTime: 30 * 1000
    }
  );

  // Quick actions
  const quickActions = useMemo(() => [
    {
      id: 'home',
      title: 'Go to Dashboard',
      subtitle: 'Main dashboard overview',
      action: () => router.push('/'),
      shortcut: '⌘H',
      icon: '🏠'
    },
    {
      id: 'countries',
      title: 'Browse Nations',
      subtitle: 'International directory',
      action: () => router.push('/countries'),
      shortcut: '⌘B',
      icon: '🌍'
    },
    {
      id: 'mycountry',
      title: 'My Nation',
      subtitle: 'MyCountry® dashboard',
      action: () => router.push('/mycountry'),
      shortcut: '⌘M',
      icon: '👑'
    },
    {
      id: 'analytics',
      title: 'Global Analytics',
      subtitle: 'World statistics and rankings',
      action: () => router.push('/analytics'),
      shortcut: '⌘A',
      icon: '📊'
    },
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'User preferences and configuration',
      action: () => router.push('/settings'),
      shortcut: '⌘,',
      icon: '⚙️'
    }
  ], [router]);

  const handleSelect = (action: () => void) => {
    action();
    onOpenChange(false);
    setSearch('');
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        setSearch('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="command-palette-dialog max-w-2xl p-0">
        <Command className="command-palette glass-command">
          <CommandInput
            placeholder="Search for nations, pages, or actions..."
            value={search}
            onValueChange={setSearch}
            className="command-input"
          />
          
          <CommandList className="command-list max-h-96">
            <CommandEmpty>
              <div className="py-6 text-center text-muted-foreground">
                <span>No results found for "{search}"</span>
              </div>
            </CommandEmpty>

            {/* Quick Actions */}
            {(!search || search.length < 2) && (
              <CommandGroup heading="Quick Actions">
                {quickActions.map((action) => (
                  <CommandItem
                    key={action.id}
                    onSelect={() => handleSelect(action.action)}
                    className="command-item"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-lg">{action.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{action.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {action.subtitle}
                        </div>
                      </div>
                      <kbd className="command-shortcut">
                        {action.shortcut}
                      </kbd>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Search Results */}
            {searchResults && (
              <>
                {searchResults.countries && searchResults.countries.length > 0 && (
                  <CommandGroup heading="Nations">
                    {searchResults.countries.map((country) => (
                      <CommandItem
                        key={country.id}
                        onSelect={() => handleSelect(() => router.push(`/countries/${country.id}`))}
                        className="command-item"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-6 h-4 rounded overflow-hidden">
                            <img 
                              src={country.flagUrl || '/placeholder-flag.png'} 
                              alt={`${country.name} flag`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{country.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {country.continent} • {country.economicTier}
                            </div>
                          </div>
                          <Badge variant="outline" className="glass-badge">
                            Nation
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {searchResults.players && searchResults.players.length > 0 && (
                  <CommandGroup heading="Players">
                    {searchResults.players.map((player) => (
                      <CommandItem
                        key={player.id}
                        onSelect={() => handleSelect(() => router.push(`/players/${player.id}`))}
                        className="command-item"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-6 h-6 rounded-full overflow-hidden">
                            <img 
                              src={player.avatar || '/placeholder-avatar.png'} 
                              alt={`${player.name} avatar`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{player.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {player.countryName || 'No nation'}
                            </div>
                          </div>
                          <Badge variant="outline" className="glass-badge">
                            Player
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {searchResults.pages && searchResults.pages.length > 0 && (
                  <CommandGroup heading="Pages">
                    {searchResults.pages.map((page) => (
                      <CommandItem
                        key={page.path}
                        onSelect={() => handleSelect(() => router.push(page.path))}
                        className="command-item"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-lg">{page.icon}</span>
                          <div className="flex-1">
                            <div className="font-medium">{page.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {page.description}
                            </div>
                          </div>
                          <Badge variant="outline" className="glass-badge">
                            Page
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 🧪 Testing & Quality Assurance

### Navigation Testing Strategy
```tsx
// __tests__/layout/navigation.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { FloatingDock } from '@/components/layout/Navigation/FloatingDock';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/'),
}));

describe('Navigation System', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      pathname: '/',
    });
  });

  describe('AppShell', () => {
    it('renders with all navigation components', () => {
      render(
        <AppShell>
          <div>Test content</div>
        </AppShell>
      );

      expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
      expect(screen.getByRole('navigation')).toBeInTheDocument(); // Sidebar
      expect(screen.getByRole('main')).toBeInTheDocument(); // Main content
    });

    it('handles sidebar toggle correctly', () => {
      render(
        <AppShell>
          <div>Test content</div>
        </AppShell>
      );

      const toggleButton = screen.getByLabelText('Toggle sidebar');
      fireEvent.click(toggleButton);

      expect(screen.getByRole('navigation')).toHaveClass('collapsed');
    });
  });

  describe('FloatingDock', () => {
    it('renders all navigation items', () => {
      render(<FloatingDock />);

      expect(screen.getByLabelText('Dashboard')).toBeInTheDocument();
      expect(screen.getByLabelText('Nations')).toBeInTheDocument();
      expect(screen.getByLabelText('Analytics')).toBeInTheDocument();
    });

    it('shows/hides based on scroll position', async () => {
      render(<FloatingDock />);

      const dock = screen.getByTestId('floating-dock');
      expect(dock).toHaveClass('translate-y-0');

      // Simulate scroll down
      Object.defineProperty(window, 'scrollY', { value: 500 });
      fireEvent.scroll(window);

      await waitFor(() => {
        expect(dock).toHaveClass('translate-y-16');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports keyboard shortcuts', () => {
      const mockPush = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({ push: mockPush });

      render(<AppShell><div>Content</div></AppShell>);

      // Test command palette shortcut
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Test navigation shortcuts
      fireEvent.keyDown(document, { key: '1', metaKey: true });
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts to mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 });

      render(<AppShell><div>Content</div></AppShell>);

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('lg:block', 'hidden');
    });
  });
});
```

### Accessibility Testing
```tsx
// __tests__/layout/accessibility.test.tsx
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AppShell } from '@/components/layout/AppShell';

expect.extend(toHaveNoViolations);

describe('Navigation Accessibility', () => {
  it('meets WCAG 2.1 AA standards', async () => {
    const { container } = render(
      <AppShell>
        <div>Test content</div>
      </AppShell>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports screen readers', () => {
    render(<AppShell><div>Content</div></AppShell>);

    // Check for proper ARIA labels
    expect(screen.getByRole('banner')).toHaveAttribute('aria-label');
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label');
    expect(screen.getByRole('main')).toHaveAttribute('aria-label');
  });

  it('supports keyboard navigation', () => {
    render(<AppShell><div>Content</div></AppShell>);

    const firstNavItem = screen.getAllByRole('link')[0];
    firstNavItem.focus();
    expect(firstNavItem).toHaveFocus();

    // Test tab navigation
    fireEvent.keyDown(firstNavItem, { key: 'Tab' });
    const nextElement = document.activeElement;
    expect(nextElement).not.toBe(firstNavItem);
  });
});
```

This comprehensive Navigation & Layout System implementation guide provides the foundation for building a sophisticated, accessible, and performant navigation experience that scales across the entire IxStats application.

