import React from "react";
import { GlassCard } from "~/components/ui/enhanced-card";
import { GlassButton } from "~/components/ui/enhanced-button";
import { CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import Link from "next/link";
import { 
  Globe, 
  BarChart3, 
  Crown, 
  Settings, 
  Users, 
  TrendingUp,
  Map,
  MessageSquare
} from "lucide-react";
import { Badge } from "~/components/ui/badge";

interface QuickActionsProps {
  userProfile?: { countryId?: string };
  systemPermissions?: string[];
}

export function QuickActions({ userProfile, systemPermissions = [] }: QuickActionsProps) {
  const primaryActions = [
    {
      title: 'International Directory',
      description: 'Browse and explore all nations',
      icon: Globe,
      href: '/countries',
      variant: 'diplomatic' as const,
      available: true
    },
    {
      title: 'MyCountry®',
      description: userProfile?.countryId ? 'Manage your nation' : 'Set up your country',
      icon: Crown,
      href: userProfile?.countryId ? `/countries/${userProfile.countryId}` : '/setup',
      variant: 'economic' as const,
      available: true,
      badge: userProfile?.countryId ? undefined : 'Setup Required'
    },
    {
      title: 'Global Analytics',
      description: 'World rankings and statistics',
      icon: BarChart3,
      href: '/dashboard',
      variant: 'cultural' as const,
      available: true
    },
    {
      title: 'System Administration',
      description: 'Manage system settings and data',
      icon: Settings,
      href: '/admin',
      variant: 'military' as const,
      available: systemPermissions.includes('admin'),
      badge: 'Admin Only'
    }
  ];

  const secondaryActions = [
    {
      title: 'World Map',
      description: 'Geographic visualization',
      icon: Map,
      href: '/map',
      available: true
    },
    {
      title: 'Diplomacy Hub',
      description: 'International relations',
      icon: MessageSquare,
      href: '/diplomacy',
      available: userProfile?.countryId
    },
    {
      title: 'Economic Modeling',
      description: 'Advanced economic tools',
      icon: TrendingUp,
      href: '/modeling',
      available: systemPermissions.includes('advanced_tools')
    },
    {
      title: 'Player Directory',
      description: 'Connect with other players',
      icon: Users,
      href: '/players',
      available: true
    }
  ];

  return (
    <section className="quick-actions py-8">
      <div className="container mx-auto px-4">
        {/* Primary Actions */}
        <GlassCard variant="glass" className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>⚡</span>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {primaryActions.filter(action => action.available).map((action) => (
                <QuickActionCard key={action.title} action={action} />
              ))}
            </div>
          </CardContent>
        </GlassCard>

        {/* Secondary Actions */}
        <GlassCard variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🔧</span>
              Tools & Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {secondaryActions.filter(action => action.available).map((action) => (
                <SecondaryActionButton key={action.title} action={action} />
              ))}
            </div>
          </CardContent>
        </GlassCard>
      </div>
    </section>
  );
}

function QuickActionCard({ action }: { action: any }) {
  const Icon = action.icon;
  
  return (
    <Link href={action.href}>
      <GlassCard 
        variant={action.variant}
        hover="lift"
        glow="hover"
        className="quick-action-card h-full cursor-pointer transition-all duration-300 hover:scale-105"
      >
        <CardContent className="p-6 text-center">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full glass-button">
              <Icon className="w-6 h-6" />
            </div>
          </div>
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
            {action.title}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            {action.description}
          </p>
          {action.badge && (
            <Badge variant="outline" className="glass-badge text-xs">
              {action.badge}
            </Badge>
          )}
        </CardContent>
      </GlassCard>
    </Link>
  );
}

function SecondaryActionButton({ action }: { action: any }) {
  const Icon = action.icon;
  
  return (
    <Link href={action.href}>
      <GlassButton 
        variant="outline" 
        className="w-full h-16 flex flex-col items-center justify-center gap-1 text-xs"
        glass={true}
      >
        <Icon className="w-4 h-4" />
        <span>{action.title}</span>
      </GlassButton>
    </Link>
  );
} 