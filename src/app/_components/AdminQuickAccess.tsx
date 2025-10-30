"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "~/trpc/react";
import Link from "next/link";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

// Icons
import {
  Shield,
  Settings,
  Users,
  Database,
  BarChart3,
  FileText,
  Globe,
  Zap,
  Star,
  Plus,
  ExternalLink,
  Grid3X3,
  List,
  Crown,
  Wrench,
  Monitor,
  Activity,
  Key,
  Cog,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { AdminFavoriteButton } from "~/components/admin/AdminFavoriteButton";
import { AdminControlEmbed } from "~/components/admin/AdminControlEmbeds";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";

// Define available admin panels
const ADMIN_PANELS = [
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
    panelType: "content",
    panelId: "content-management",
    displayName: "Content Management",
    description: "Manage countries, posts, and content",
    iconName: "FileText",
    url: "/admin/content",
    category: "content",
  },
  {
    panelType: "system",
    panelId: "system-settings",
    displayName: "System Settings",
    description: "Global system configuration",
    iconName: "Cog",
    url: "/admin/settings",
    category: "system",
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
    panelType: "tools",
    panelId: "admin-tools",
    displayName: "Admin Tools",
    description: "Utilities and maintenance tools",
    iconName: "Wrench",
    url: "/admin/tools",
    category: "tools",
  },
];

const getIcon = (iconName: string) => {
  const iconMap: Record<string, React.ComponentType<any>> = {
    Shield,
    Users,
    Database,
    BarChart3,
    FileText,
    Globe,
    Cog,
    Monitor,
    Wrench,
    Settings,
    Activity,
    Key,
  };
  return iconMap[iconName] || Settings;
};

export function AdminQuickAccess() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [availablePanelsExpanded, setAvailablePanelsExpanded] = useState(true);

  // Get user's favorites
  const {
    data: favoritesData,
    isLoading: favoritesLoading,
    error: favoritesError,
  } = api.users.getAdminFavorites.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const favorites = favoritesData?.favorites || [];

  // Handle favorites loading error
  if (favoritesError) {
    console.warn("Failed to load admin favorites:", favoritesError);
  }

  // Group favorites by category
  const favoritesByCategory = favorites.reduce(
    (acc, fav) => {
      if (!acc[fav.category]) {
        acc[fav.category] = [];
      }
      acc[fav.category].push(fav);
      return acc;
    },
    {} as Record<string, typeof favorites>
  );

  const categories = Object.keys(favoritesByCategory).sort();

  // Auto-collapse available panels when user has favorites
  useEffect(() => {
    if (favorites.length > 0) {
      setAvailablePanelsExpanded(false);
    }
  }, [favorites.length]);

  return (
    <motion.div
      key="admin"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-foreground text-xl font-bold">Admin Quick Access</h3>
            <p className="text-muted-foreground text-sm">
              {favorites.length} favorited panels • Quick access to admin tools
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Favorites Content */}
      {favoritesLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-hierarchy-child h-24 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : favorites.length > 0 ? (
        <Tabs defaultValue={categories[0] || "all"} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All ({favorites.length})</TabsTrigger>
            {categories.slice(0, 3).map((category) => (
              <TabsTrigger key={category} value={category} className="capitalize">
                {category} ({favoritesByCategory[category]?.length || 0})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <AdminPanelGrid favorites={favorites} viewMode={viewMode} />
          </TabsContent>

          {categories.map((category) => (
            <TabsContent key={category} value={category} className="mt-6">
              <AdminPanelGrid favorites={favoritesByCategory[category] || []} viewMode={viewMode} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card className="glass-hierarchy-child">
          <CardContent className="p-8 text-center">
            <Star className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
            <h4 className="text-foreground mb-2 text-lg font-semibold">No Favorites Yet</h4>
            <p className="text-muted-foreground mb-6">
              Add your frequently used admin panels to favorites for quick access.
            </p>
            <Link href="/admin">
              <Button className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Browse Admin Panels
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Available Panels Section */}
      <Card className="glass-hierarchy-child">
        <CardHeader className="pb-3">
          <CardTitle
            className="flex cursor-pointer items-center justify-between"
            onClick={() => setAvailablePanelsExpanded(!availablePanelsExpanded)}
          >
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Available Admin Panels
              <Badge variant="outline" className="text-xs">
                {
                  ADMIN_PANELS.filter(
                    (panel) => !favorites.some((fav) => fav.panelId === panel.panelId)
                  ).length
                }{" "}
                available
              </Badge>
            </div>
            {availablePanelsExpanded ? (
              <ChevronUp className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            )}
          </CardTitle>
        </CardHeader>
        <motion.div
          initial={false}
          animate={{
            height: availablePanelsExpanded ? "auto" : 0,
            opacity: availablePanelsExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{ overflow: "hidden" }}
        >
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {ADMIN_PANELS.map((panel) => {
                const Icon = getIcon(panel.iconName);
                const isFavorited = favorites.some((fav) => fav.panelId === panel.panelId);

                return (
                  <div
                    key={panel.panelId}
                    className={cn(
                      "rounded-lg border p-3 transition-all duration-200 hover:scale-[1.02]",
                      isFavorited
                        ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
                        : "glass-hierarchy-interactive"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Icon className="h-5 w-5 text-purple-500" />
                      <AdminFavoriteButton {...panel} size="sm" variant="ghost" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="text-foreground text-sm font-medium">{panel.displayName}</h5>
                      <p className="text-muted-foreground line-clamp-2 text-xs">
                        {panel.description}
                      </p>
                      <Badge variant="outline" className="text-xs capitalize">
                        {panel.category}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </motion.div>
      </Card>
    </motion.div>
  );
}

interface AdminPanelGridProps {
  favorites: any[];
  viewMode: "grid" | "list";
}

function AdminPanelGrid({ favorites, viewMode }: AdminPanelGridProps) {
  if (viewMode === "list") {
    return (
      <div className="grid grid-cols-1 gap-3">
        {favorites.map((favorite) => (
          <motion.div
            key={favorite.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="transition-all duration-200 hover:scale-[1.005]"
          >
            <div className="h-auto">
              <AdminControlEmbed favorite={favorite} />
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {favorites.map((favorite) => (
        <motion.div
          key={favorite.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="transition-all duration-200 hover:scale-[1.02]"
        >
          <AdminControlEmbed favorite={favorite} />
        </motion.div>
      ))}
    </div>
  );
}
