"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useToast } from "~/components/ui/toast";
import { 
  Bell, 
  Plus, 
  Trash2, 
  Send, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  AlertCircle,
  Users,
  Globe,
  Zap
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const NotificationType = ["info", "warning", "success", "error", "economic", "crisis", "diplomatic", "system"] as const;
const NotificationLevel = ["low", "medium", "high", "critical"] as const;

export function NotificationsAdmin() {
  const { toast } = useToast();
  const [createFormData, setCreateFormData] = useState({
    title: "",
    description: "",
    type: "info" as const,
    level: "medium" as const,
    href: "",
    userId: "",
    countryId: "",
    scope: "global" as "global" | "user" | "country"
  });

  // Queries
  const { 
    data: notificationStats, 
    isLoading: statsLoading,
    refetch: refetchStats 
  } = api.notifications.getNotificationStats.useQuery({
    adminUserId: "admin" // TODO: Replace with actual admin user ID
  });

  const {
    data: allNotifications,
    isLoading: notificationsLoading,
    refetch: refetchNotifications
  } = api.notifications.getUserNotifications.useQuery({
    limit: 100,
    unreadOnly: false,
    userId: "admin" // TODO: Replace with actual admin user ID or make this admin-specific
  });

  const { data: countries } = api.countries.getAll.useQuery();

  // Mutations
  const createNotificationMutation = api.notifications.createNotification.useMutation({
    onSuccess: () => {
      toast({
        type: "success",
        title: "Notification created",
        description: "The notification has been sent successfully."
      });
      setCreateFormData({
        title: "",
        description: "",
        type: "info",
        level: "medium",
        href: "",
        userId: "",
        countryId: "",
        scope: "global"
      });
      void refetchNotifications();
      void refetchStats();
    },
    onError: (error) => {
      toast({
        type: "error",
        title: "Failed to create notification",
        description: error.message
      });
    }
  });

  const deleteNotificationMutation = api.notifications.deleteNotification.useMutation({
    onSuccess: () => {
      toast({
        type: "success",
        title: "Notification deleted"
      });
      void refetchNotifications();
      void refetchStats();
    },
    onError: (error) => {
      toast({
        type: "error",
        title: "Failed to delete notification",
        description: error.message
      });
    }
  });

  const handleCreateNotification = () => {
    if (!createFormData.title.trim()) {
      toast({
        type: "error",
        title: "Title required",
        description: "Please enter a notification title."
      });
      return;
    }

    const notificationData = {
      title: createFormData.title,
      description: createFormData.description || undefined,
      type: createFormData.type,
      level: createFormData.level,
      href: createFormData.href || undefined,
      userId: createFormData.scope === "user" && createFormData.userId ? createFormData.userId : undefined,
      countryId: createFormData.scope === "country" && createFormData.countryId ? createFormData.countryId : undefined,
      adminUserId: "admin", // TODO: Replace with actual admin user ID
    };

    createNotificationMutation.mutate(notificationData);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "info": return <Info className="h-4 w-4 text-blue-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "economic": return <Zap className="h-4 w-4 text-purple-500" />;
      case "crisis": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "diplomatic": return <Users className="h-4 w-4 text-indigo-500" />;
      case "system": return <Bell className="h-4 w-4 text-gray-500" />;
      default: return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getScopeInfo = (notification: any) => {
    if (notification.userId) return { scope: "User", icon: <Users className="h-3 w-3" /> };
    if (notification.countryId) return { scope: "Country", icon: <Globe className="h-3 w-3" /> };
    return { scope: "Global", icon: <Zap className="h-3 w-3" /> };
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? "..." : notificationStats?.totalNotifications || 0}
                </p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unread</p>
                <p className="text-2xl font-bold text-red-500">
                  {statsLoading ? "..." : notificationStats?.unreadNotifications || 0}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Read</p>
                <p className="text-2xl font-bold text-green-500">
                  {statsLoading ? "..." : notificationStats?.readNotifications || 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Types</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? "..." : notificationStats?.typeBreakdown?.length || 0}
                </p>
              </div>
              <Info className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Notification Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input
                placeholder="Notification title"
                value={createFormData.title}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select
                value={createFormData.type}
                onValueChange={(value) => setCreateFormData(prev => ({ ...prev, type: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NotificationType.map(type => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        {getNotificationIcon(type)}
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Level</label>
              <Select
                value={createFormData.level}
                onValueChange={(value) => setCreateFormData(prev => ({ ...prev, level: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NotificationLevel.map(level => (
                    <SelectItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Scope</label>
              <Select
                value={createFormData.scope}
                onValueChange={(value) => setCreateFormData(prev => ({ 
                  ...prev, 
                  scope: value as any,
                  userId: "",
                  countryId: ""
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Global (All Users)
                    </div>
                  </SelectItem>
                  <SelectItem value="country">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Country Specific
                    </div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Specific User
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {createFormData.scope === "country" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Country</label>
              <Select
                value={createFormData.countryId}
                onValueChange={(value) => setCreateFormData(prev => ({ ...prev, countryId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  {countries?.countries?.map(country => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {createFormData.scope === "user" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">User ID</label>
              <Input
                placeholder="Clerk User ID"
                value={createFormData.userId}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, userId: e.target.value }))}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Optional description"
              value={createFormData.description}
              onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Link (optional)</label>
            <Input
              placeholder="https://..."
              value={createFormData.href}
              onChange={(e) => setCreateFormData(prev => ({ ...prev, href: e.target.value }))}
            />
          </div>

          <Button 
            onClick={handleCreateNotification}
            disabled={createNotificationMutation.isPending}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {createNotificationMutation.isPending ? "Creating..." : "Send Notification"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            {notificationsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : allNotifications?.notifications && allNotifications.notifications.length > 0 ? (
              <div className="space-y-4">
                {allNotifications.notifications.map((notification) => {
                  const scopeInfo = getScopeInfo(notification);
                  return (
                    <div key={notification.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notification.type || "info")}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{notification.title}</h4>
                            <Badge variant="outline" className="text-xs">
                              <div className="flex items-center gap-1">
                                {scopeInfo.icon}
                                {scopeInfo.scope}
                              </div>
                            </Badge>
                            <Badge variant={notification.read ? "default" : "destructive"} className="text-xs">
                              {notification.read ? "Read" : "Unread"}
                            </Badge>
                          </div>
                          {notification.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNotificationMutation.mutate({ 
                          notificationId: notification.id,
                          adminUserId: "admin" // TODO: Replace with actual admin user ID
                        })}
                        disabled={deleteNotificationMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No notifications found</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}