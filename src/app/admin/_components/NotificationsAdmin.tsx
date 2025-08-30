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
  Zap,
  Play,
  Settings,
  Trophy,
  Shield,
  DollarSign
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNotificationStore } from '~/stores/notificationStore';
import { useGlobalNotificationBridge } from '~/services/GlobalNotificationBridge';
import { diplomaticNotificationService, achievementNotificationService } from '~/services/DiplomaticNotificationService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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

  // Test system integration
  const [testResults, setTestResults] = useState<string[]>([]);
  const addNotification = useNotificationStore(state => state.addNotification);
  const notifications = useNotificationStore(state => state.notifications);
  const stats = useNotificationStore(state => state.stats);
  const { bridge, wireIntelligence, wireEconomic, wireDiplomatic } = useGlobalNotificationBridge();

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

  // Test notification functions
  const testIntelligenceNotification = async () => {
    try {
      await addNotification({
        source: 'intelligence',
        title: '🚨 TEST: Critical Intelligence Alert',
        message: 'This is a test of the intelligence notification system. High-priority security alert detected.',
        category: 'security',
        type: 'alert',
        priority: 'critical',
        severity: 'urgent',
        deliveryMethod: 'dynamic-island',
        actionable: true,
        actions: [{
          id: 'test-action',
          label: 'Investigate',
          type: 'primary',
          onClick: () => setTestResults(prev => [...prev, 'Intelligence notification action clicked'])
        }],
        triggers: [{
          type: 'data-change',
          source: 'admin-panel',
          data: { testType: 'intelligence' },
          confidence: 1.0
        }],
        status: 'pending' as const,
        relevanceScore: 90,
        context: {
          userId: 'admin-test',
          isExecutiveMode: true,
          currentRoute: '/admin',
          ixTime: Date.now(),
          realTime: Date.now(),
          timeMultiplier: 2,
          activeFeatures: ['admin'],
          recentActions: ['test'],
          focusMode: false,
          sessionDuration: 0,
          isUserActive: true,
          deviceType: 'desktop' as const,
          screenSize: 'large' as const,
          networkQuality: 'high' as const,
          userPreferences: {} as any,
          historicalEngagement: [],
          interactionHistory: [],
          contextualFactors: {},
          urgencyFactors: [],
          contextualRelevance: 0.9
        }
      });
      
      setTestResults(prev => [...prev, '✅ Intelligence notification created successfully']);
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Intelligence notification failed: ${error}`]);
    }
  };

  const testEconomicNotification = async () => {
    try {
      await addNotification({
        source: 'intelligence',
        title: '📈 TEST: Economic Alert',
        message: 'GDP has increased by 15.2% this quarter, indicating strong economic growth.',
        category: 'economic',
        type: 'alert',
        priority: 'high',
        severity: 'important',
        deliveryMethod: 'dynamic-island',
        actionable: true,
        actions: [{
          id: 'view-economic-data',
          label: 'View Economic Dashboard',
          type: 'primary',
          onClick: () => setTestResults(prev => [...prev, 'Economic notification action clicked'])
        }],
        triggers: [{
          type: 'data-change',
          source: 'economic-system',
          data: { metric: 'GDP', changePercent: 15.2, value: 2400000000000 },
          confidence: 0.9
        }],
        status: 'pending' as const,
        relevanceScore: 85,
        context: {
          userId: 'admin-test',
          isExecutiveMode: true,
          currentRoute: '/admin',
          ixTime: Date.now(),
          realTime: Date.now(),
          timeMultiplier: 2,
          activeFeatures: ['admin'],
          recentActions: ['test'],
          focusMode: false,
          sessionDuration: 0,
          isUserActive: true,
          deviceType: 'desktop' as const,
          screenSize: 'large' as const,
          networkQuality: 'high' as const,
          userPreferences: {} as any,
          historicalEngagement: [],
          interactionHistory: [],
          contextualFactors: {},
          urgencyFactors: [],
          contextualRelevance: 0.8
        }
      });
      
      setTestResults(prev => [...prev, '✅ Economic notification created successfully']);
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Economic notification failed: ${error}`]);
    }
  };

  const testDiplomaticNotification = async () => {
    try {
      const diplomaticEvent = {
        id: `admin-test-diplo-${Date.now()}`,
        type: 'treaty' as const,
        title: 'Peace Treaty Signed',
        description: 'Historic peace agreement reached between neighboring nations.',
        countries: ['test-country-1', 'test-country-2'],
        significance: 'major' as const,
        timestamp: Date.now()
      };
      
      await diplomaticNotificationService.processDiplomaticEvent(diplomaticEvent);
      setTestResults(prev => [...prev, '✅ Diplomatic notification processed via specialized service']);
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Diplomatic notification failed: ${error}`]);
    }
  };

  const testAchievementNotification = async () => {
    try {
      const achievement = {
        id: `admin-test-achievement-${Date.now()}`,
        name: 'Admin Test Achievement',
        description: 'Successfully tested the achievement notification system from admin panel.',
        category: 'economic' as const,
        rarity: 'epic' as const,
        unlocked: true,
        unlockedAt: Date.now()
      };
      
      await achievementNotificationService.processAchievementUnlock(achievement);
      setTestResults(prev => [...prev, '✅ Achievement notification created successfully']);
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Achievement notification failed: ${error}`]);
    }
  };

  const runFullSystemTest = async () => {
    setTestResults(['🧪 Starting comprehensive system test from admin panel...']);
    
    // Test all notification types in sequence
    await new Promise(resolve => setTimeout(resolve, 500));
    await testIntelligenceNotification();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testEconomicNotification();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testDiplomaticNotification();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testAchievementNotification();
    
    setTestResults(prev => [...prev, '🎉 Full admin system test completed!']);
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="admin" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="admin">Admin Panel</TabsTrigger>
          <TabsTrigger value="test">Test System</TabsTrigger>
          <TabsTrigger value="stats">Live Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="admin" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="test" className="space-y-6">
          {/* Test Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Notification System Testing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Individual Tests */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={testIntelligenceNotification}
                  className="flex items-center gap-2 h-auto p-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
                >
                  <Shield className="h-5 w-5 text-red-400" />
                  <div className="text-left">
                    <div className="font-medium">Intelligence Alert</div>
                    <div className="text-xs opacity-80">Critical security notification</div>
                  </div>
                </Button>

                <Button
                  onClick={testEconomicNotification}
                  className="flex items-center gap-2 h-auto p-4 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30"
                >
                  <DollarSign className="h-5 w-5 text-green-400" />
                  <div className="text-left">
                    <div className="font-medium">Economic Update</div>
                    <div className="text-xs opacity-80">GDP growth notification</div>
                  </div>
                </Button>

                <Button
                  onClick={testDiplomaticNotification}
                  className="flex items-center gap-2 h-auto p-4 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30"
                >
                  <Globe className="h-5 w-5 text-blue-400" />
                  <div className="text-left">
                    <div className="font-medium">Diplomatic Event</div>
                    <div className="text-xs opacity-80">Treaty signed notification</div>
                  </div>
                </Button>

                <Button
                  onClick={testAchievementNotification}
                  className="flex items-center gap-2 h-auto p-4 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30"
                >
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  <div className="text-left">
                    <div className="font-medium">Achievement</div>
                    <div className="text-xs opacity-80">Test achievement unlock</div>
                  </div>
                </Button>
              </div>

              {/* System Tests */}
              <div className="flex gap-4">
                <Button
                  onClick={runFullSystemTest}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Run Full System Test
                </Button>
                
                <Button
                  onClick={clearTestResults}
                  variant="outline"
                  className="flex-1"
                >
                  Clear Results
                </Button>
              </div>

              {/* Test Results */}
              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {testResults.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No test results yet. Run some tests to see results here.</p>
                      ) : (
                        testResults.map((result, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg text-sm font-mono ${
                              result.includes('✅') ? 'bg-green-500/20 text-green-400' :
                              result.includes('❌') ? 'bg-red-500/20 text-red-400' :
                              result.includes('🧪') || result.includes('🎉') ? 'bg-purple-500/20 text-purple-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {result}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          {/* Live System Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Enhanced Notification Store</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Notifications:</span>
                  <Badge>{stats.total}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Unread:</span>
                  <Badge variant="destructive">{stats.unread}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Delivered:</span>
                  <Badge variant="secondary">{stats.delivered}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Dismissed:</span>
                  <Badge variant="outline">{stats.dismissed}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bridge Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(() => {
                  const bridgeStats = bridge.getStats();
                  return (
                    <>
                      <div className="flex justify-between">
                        <span>Total Rules:</span>
                        <Badge>{bridgeStats.totalRules}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Recent Notifications:</span>
                        <Badge>{bridgeStats.recentNotifications}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Initialized:</span>
                        <Badge variant={bridgeStats.isInitialized ? "default" : "destructive"}>
                          {bridgeStats.isInitialized ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}