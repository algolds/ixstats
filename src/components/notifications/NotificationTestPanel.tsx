/**
 * Notification Test Panel
 * Component for testing the complete notification flow through the dynamic island
 */

'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Bell, 
  AlertTriangle, 
  TrendingUp, 
  Globe, 
  Shield, 
  DollarSign, 
  Trophy,
  Zap,
  Play,
  Settings
} from 'lucide-react';
import { useNotificationStore } from '~/stores/notificationStore';
import { useGlobalNotificationBridge } from '~/services/GlobalNotificationBridge';
import { diplomaticNotificationService, achievementNotificationService } from '~/services/DiplomaticNotificationService';

export function NotificationTestPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  
  const addNotification = useNotificationStore(state => state.addNotification);
  const notifications = useNotificationStore(state => state.notifications);
  const stats = useNotificationStore(state => state.stats);
  
  const { bridge, wireIntelligence, wireEconomic, wireDiplomatic } = useGlobalNotificationBridge();

  // Test various notification types
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
          type: 'user-action',
          source: 'test-panel',
          data: { testType: 'intelligence' },
          confidence: 1.0
        }]
      } as any);
      
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
        }]
      } as any);
      
      setTestResults(prev => [...prev, '✅ Economic notification created successfully']);
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Economic notification failed: ${error}`]);
    }
  };

  const testDiplomaticNotification = async () => {
    try {
      const diplomaticEvent = {
        id: `test-diplo-${Date.now()}`,
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
        id: `test-achievement-${Date.now()}`,
        name: 'Test Achievement Unlocked',
        description: 'Successfully tested the achievement notification system.',
        category: 'social' as const,
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

  const testBridgeIntegration = () => {
    try {
      // Test direct bridge integration
      wireIntelligence([{
        id: `test-intel-${Date.now()}`,
        type: 'alert',
        title: 'Bridge Test Intelligence',
        description: 'Testing direct bridge integration for intelligence data.',
        severity: 'medium',
        category: 'security',
        timestamp: Date.now(),
        createdAt: Date.now(),
        source: 'test-bridge',
        actionable: true
      }]);
      
      wireEconomic({
        metric: 'Test GDP',
        value: 1500000000000,
        changePercent: 8.5,
        countryId: 'test-country'
      });
      
      wireDiplomatic({
        eventType: 'agreement',
        title: 'Bridge Test Agreement',
        description: 'Testing diplomatic event through bridge integration.',
        countries: ['test-country']
      });
      
      setTestResults(prev => [...prev, '✅ Bridge integration test completed']);
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Bridge integration test failed: ${error}`]);
    }
  };

  const runFullSystemTest = async () => {
    setTestResults(['🧪 Starting comprehensive system test...']);
    
    // Test all notification types in sequence
    await new Promise(resolve => setTimeout(resolve, 500));
    await testIntelligenceNotification();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testEconomicNotification();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testDiplomaticNotification();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testAchievementNotification();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    testBridgeIntegration();
    
    setTestResults(prev => [...prev, '🎉 Full system test completed!']);
  };

  const clearNotifications = () => {
    const store = useNotificationStore.getState();
    store.cleanup();
    setTestResults(prev => [...prev, '🧹 Notifications cleared']);
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 left-4 z-[10002]">
        <Button
          onClick={() => setIsVisible(true)}
          size="sm"
          className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
        >
          <Zap className="h-4 w-4 mr-2" />
          Test Notifications
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-4 bg-background/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl z-[10001] overflow-hidden">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Bell className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Notification System Test Panel</h2>
              <p className="text-sm text-muted-foreground">
                Test the complete notification flow through Dynamic Island
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              {notifications.length} Total
            </Badge>
            <Badge variant="outline" className="gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              {stats.unread} Unread
            </Badge>
            <Button
              onClick={() => setIsVisible(false)}
              size="sm"
              variant="ghost"
            >
              ×
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <Tabs defaultValue="test" className="h-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="test">Test Controls</TabsTrigger>
              <TabsTrigger value="results">Test Results</TabsTrigger>
              <TabsTrigger value="stats">System Stats</TabsTrigger>
            </TabsList>

            <TabsContent value="test" className="space-y-6">
              {/* Individual Tests */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Individual Notification Tests
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
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
                </CardContent>
              </Card>

              {/* System Tests */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    System Tests
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                  <Button
                    onClick={runFullSystemTest}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Run Full System Test
                  </Button>
                  
                  <Button
                    onClick={testBridgeIntegration}
                    variant="outline"
                    className="flex-1"
                  >
                    Bridge Integration Test
                  </Button>
                  
                  <Button
                    onClick={clearNotifications}
                    variant="destructive"
                    className="flex-1"
                  >
                    Clear All Notifications
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Store Stats</CardTitle>
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
      </div>
    </div>
  );
}

export default NotificationTestPanel;