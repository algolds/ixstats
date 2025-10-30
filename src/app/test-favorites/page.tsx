"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AdminFavoriteButton } from "~/components/admin/AdminFavoriteButton";
import { Shield, Users, Database, BarChart3, Settings, Monitor } from "lucide-react";

export default function TestFavoritesPage() {
  const testPanels = [
    {
      panelType: "dashboard",
      panelId: "admin-main",
      displayName: "Admin Dashboard",
      description: "Main administration panel",
      iconName: "Shield",
      url: "/admin",
      category: "system",
    },
    {
      panelType: "users",
      panelId: "user-management",
      displayName: "User Management",
      description: "Manage users, roles, and permissions",
      iconName: "Users",
      url: "/admin/users",
      category: "users",
    },
    {
      panelType: "database",
      panelId: "database-admin",
      displayName: "Database Admin",
      description: "Database management and queries",
      iconName: "Database",
      url: "/admin/database",
      category: "system",
    },
    {
      panelType: "analytics",
      panelId: "system-analytics",
      displayName: "System Analytics",
      description: "Performance metrics and usage stats",
      iconName: "BarChart3",
      url: "/admin/analytics",
      category: "analytics",
    },
    {
      panelType: "monitoring",
      panelId: "system-monitor",
      displayName: "System Monitor",
      description: "Real-time system monitoring",
      iconName: "Monitor",
      url: "/admin/monitor",
      category: "system",
    },
    {
      panelType: "system",
      panelId: "system-settings",
      displayName: "System Settings",
      description: "Global system configuration",
      iconName: "Settings",
      url: "/admin/settings",
      category: "system",
    },
  ];

  const getIcon = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      Shield,
      Users,
      Database,
      BarChart3,
      Settings,
      Monitor,
    };
    return iconMap[iconName] || Settings;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Admin Favorites System</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Click the star buttons to add/remove panels from your favorites. Then check the Admin
              tab on the homepage to see your favorited panels.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {testPanels.map((panel) => {
                const Icon = getIcon(panel.iconName);

                return (
                  <Card key={panel.panelId} className="relative">
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <Icon className="h-8 w-8 text-purple-500" />
                        <AdminFavoriteButton {...panel} size="lg" variant="ghost" />
                      </div>
                      <h4 className="text-foreground mb-2 font-semibold">{panel.displayName}</h4>
                      <p className="text-muted-foreground mb-3 text-sm">{panel.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs capitalize">
                          {panel.category}
                        </span>
                        <span className="text-muted-foreground text-xs">{panel.url}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
