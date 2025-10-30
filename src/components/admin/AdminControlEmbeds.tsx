"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Icons
import {
  Shield,
  Users,
  Database,
  BarChart3,
  FileText,
  Settings,
  Monitor,
  Wrench,
  Activity,
  ExternalLink,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Crown,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Server,
  Zap,
} from "lucide-react";

import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";

interface AdminControlEmbedProps {
  favorite: {
    id: string;
    panelType: string;
    panelId: string;
    displayName: string;
    description?: string;
    iconName?: string;
    url: string;
    category: string;
  };
}

const getIcon = (iconName: string) => {
  const iconMap: Record<string, React.ComponentType<any>> = {
    Shield,
    Users,
    Database,
    BarChart3,
    FileText,
    Settings,
    Monitor,
    Wrench,
    Activity,
    Crown,
    CheckCircle,
    AlertTriangle,
    TrendingUp,
    Server,
    Zap,
  };
  return iconMap[iconName] || Settings;
};

// Main Dashboard Control Embed
function DashboardControlEmbed({ favorite }: AdminControlEmbedProps) {
  const Icon = getIcon(favorite.iconName || "Shield");

  // Mock system stats - in real implementation, these would come from APIs
  const systemStats = {
    uptime: "99.8%",
    activeUsers: 127,
    totalCountries: 45,
    systemLoad: "2.3",
  };

  return (
    <Card className="glass-hierarchy-interactive h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-sm">{favorite.displayName}</CardTitle>
          </div>
          <Link href={createUrl(favorite.url)}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Uptime</span>
            <Badge variant="outline" className="text-green-600">
              {systemStats.uptime}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Users</span>
            <span className="font-medium">{systemStats.activeUsers}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Countries</span>
            <span className="font-medium">{systemStats.totalCountries}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Load</span>
            <Badge variant="outline">{systemStats.systemLoad}</Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            <RefreshCw className="mr-1 h-3 w-3" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            <Eye className="mr-1 h-3 w-3" />
            Monitor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// User Management Control Embed
function UserManagementControlEmbed({ favorite }: AdminControlEmbedProps) {
  const Icon = getIcon(favorite.iconName || "Users");
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <Card className="glass-hierarchy-interactive h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-sm">{favorite.displayName}</CardTitle>
          </div>
          <Link href={createUrl(favorite.url)}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-7 text-xs"
          />
          <Button variant="outline" size="sm" className="px-2">
            <Search className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-1 text-xs">
          <div className="bg-muted/30 flex items-center justify-between rounded p-2">
            <span>Active Users</span>
            <Badge variant="outline">127</Badge>
          </div>
          <div className="bg-muted/30 flex items-center justify-between rounded p-2">
            <span>System Owners</span>
            <Badge variant="outline">3</Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            <Plus className="mr-1 h-3 w-3" />
            Add User
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            <Crown className="mr-1 h-3 w-3" />
            Roles
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Database Admin Control Embed
function DatabaseAdminControlEmbed({ favorite }: AdminControlEmbedProps) {
  const Icon = getIcon(favorite.iconName || "Database");

  return (
    <Card className="glass-hierarchy-interactive h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-sm">{favorite.displayName}</CardTitle>
          </div>
          <Link href={createUrl(favorite.url)}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">DB Size</span>
            <Badge variant="outline">245 MB</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tables</span>
            <span className="font-medium">18</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Connections</span>
            <Badge variant="outline" className="text-green-600">
              Active
            </Badge>
          </div>
        </div>
        <Select>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Quick Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="backup">Create Backup</SelectItem>
            <SelectItem value="optimize">Optimize Tables</SelectItem>
            <SelectItem value="vacuum">Vacuum Database</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            <Activity className="mr-1 h-3 w-3" />
            Monitor
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            <Server className="mr-1 h-3 w-3" />
            Studio
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// System Analytics Control Embed
function SystemAnalyticsControlEmbed({ favorite }: AdminControlEmbedProps) {
  const Icon = getIcon(favorite.iconName || "BarChart3");

  return (
    <Card className="glass-hierarchy-interactive h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-sm">{favorite.displayName}</CardTitle>
          </div>
          <Link href={createUrl(favorite.url)}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs defaultValue="performance" className="w-full">
          <TabsList className="grid h-6 w-full grid-cols-2">
            <TabsTrigger value="performance" className="text-xs">
              Performance
            </TabsTrigger>
            <TabsTrigger value="usage" className="text-xs">
              Usage
            </TabsTrigger>
          </TabsList>
          <TabsContent value="performance" className="mt-2 space-y-2">
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span>CPU Usage</span>
                <Badge variant="outline">23%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Memory</span>
                <Badge variant="outline">67%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Response Time</span>
                <Badge variant="outline" className="text-green-600">
                  145ms
                </Badge>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="usage" className="mt-2 space-y-2">
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span>Page Views</span>
                <span className="font-medium">12.4k</span>
              </div>
              <div className="flex items-center justify-between">
                <span>API Calls</span>
                <span className="font-medium">8.7k</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Error Rate</span>
                <Badge variant="outline" className="text-green-600">
                  0.02%
                </Badge>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <Button variant="outline" size="sm" className="w-full text-xs">
          <TrendingUp className="mr-1 h-3 w-3" />
          View Detailed Analytics
        </Button>
      </CardContent>
    </Card>
  );
}

// Content Management Control Embed
function ContentManagementControlEmbed({ favorite }: AdminControlEmbedProps) {
  const Icon = getIcon(favorite.iconName || "FileText");

  return (
    <Card className="glass-hierarchy-interactive h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-sm">{favorite.displayName}</CardTitle>
          </div>
          <Link href={createUrl(favorite.url)}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/30 rounded p-2 text-center">
            <div className="font-medium">45</div>
            <div className="text-muted-foreground">Countries</div>
          </div>
          <div className="bg-muted/30 rounded p-2 text-center">
            <div className="font-medium">127</div>
            <div className="text-muted-foreground">Posts</div>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span>Pending Reviews</span>
            <Badge variant="outline">3</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Draft Posts</span>
            <Badge variant="outline">7</Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            <Plus className="mr-1 h-3 w-3" />
            New Post
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            <Edit className="mr-1 h-3 w-3" />
            Review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Generic Control Embed (fallback)
function GenericControlEmbed({ favorite }: AdminControlEmbedProps) {
  const Icon = getIcon(favorite.iconName || "Settings");

  return (
    <Card className="glass-hierarchy-interactive h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-sm">{favorite.displayName}</CardTitle>
          </div>
          <Link href={createUrl(favorite.url)}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {favorite.description && (
          <p className="text-muted-foreground line-clamp-2 text-xs">{favorite.description}</p>
        )}
        <div className="flex items-center justify-between text-xs">
          <Badge variant="outline" className="capitalize">
            {favorite.category}
          </Badge>
          <span className="text-muted-foreground">Quick Access</span>
        </div>
        <Button variant="outline" size="sm" className="w-full text-xs">
          <Zap className="mr-1 h-3 w-3" />
          Open Panel
        </Button>
      </CardContent>
    </Card>
  );
}

// Main Control Embed Router
export function AdminControlEmbed({ favorite }: AdminControlEmbedProps) {
  switch (favorite.panelType) {
    case "dashboard":
      return <DashboardControlEmbed favorite={favorite} />;
    case "users":
      return <UserManagementControlEmbed favorite={favorite} />;
    case "database":
      return <DatabaseAdminControlEmbed favorite={favorite} />;
    case "analytics":
      return <SystemAnalyticsControlEmbed favorite={favorite} />;
    case "content":
      return <ContentManagementControlEmbed favorite={favorite} />;
    default:
      return <GenericControlEmbed favorite={favorite} />;
  }
}
