/**
 * Global Notification System Component
 * Main orchestrator for the entire notification ecosystem
 */

'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { api } from '~/trpc/react';
import { useNotificationStore } from '~/stores/notificationStore';
import { UnifiedNotificationProvider } from '~/hooks/useUnifiedNotifications';
import { globalNotificationBridge } from '~/services/GlobalNotificationBridge';
import { LiveDataIntegration } from './LiveDataIntegration';
import { useToast } from '../ui/toast';

interface GlobalNotificationSystemProps {
  children: React.ReactNode;
  isExecutiveMode?: boolean;
}

export function GlobalNotificationSystem({ 
  children, 
  isExecutiveMode = false 
}: GlobalNotificationSystemProps) {
  const { user } = useUser();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Get user profile for country context
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // Notification store integration
  const notifications = useNotificationStore(state => state.notifications);
  const initialize = useNotificationStore(state => state.initialize);
  
  // Initialize the entire notification system
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        console.log('[GlobalNotificationSystem] Initializing notification ecosystem...');
        
        // Initialize notification store
        await initialize();
        
        // Initialize global bridge
        await globalNotificationBridge.initialize();
        
        // Set up toast notifications for dynamic island fallback
        globalNotificationBridge.on('notificationCreated', (data) => {
          const { notification } = data;
          
          // Show toast for certain types of notifications
          if (notification.deliveryMethod === 'toast' || notification.priority === 'low') {
            toast({
              title: notification.title,
              description: notification.message,
              duration: 5000,
            });
          }
        });
        
        setIsInitialized(true);
        console.log('[GlobalNotificationSystem] System initialized successfully');
      } catch (error) {
        console.error('[GlobalNotificationSystem] Initialization failed:', error);
      }
    };

    initializeSystem();
  }, [initialize, toast]);

  // Monitor notification changes for debugging
  useEffect(() => {
    if (isInitialized && notifications.length > 0) {
      const unreadCount = notifications.filter(n => n.status !== 'read' && n.status !== 'dismissed').length;
      console.log(`[GlobalNotificationSystem] ${notifications.length} total notifications, ${unreadCount} unread`);
    }
  }, [notifications, isInitialized]);

  // Route-based notification context updates
  useEffect(() => {
    if (!isInitialized) return;
    
    // Update notification context based on current route
    const context = {
      currentPage: pathname,
      isUserActive: true,
      lastUserActivity: Date.now(),
    };
    
    // This would update the notification delivery context
    console.log('[GlobalNotificationSystem] Route changed:', pathname);
  }, [pathname, isInitialized]);

  // Real-time WebSocket integration (placeholder)
  useEffect(() => {
    if (!isInitialized || !userProfile?.countryId) return;
    
    // This would set up WebSocket connections for real-time updates
    console.log('[GlobalNotificationSystem] Setting up real-time connections for country:', userProfile.countryId);
    
    // Cleanup would happen in the return function
    return () => {
      console.log('[GlobalNotificationSystem] Cleaning up real-time connections');
    };
  }, [isInitialized, userProfile?.countryId]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center p-4">
        {/* Initializing notification system... (removed) */}
      </div>
    );
  }

  return (
    <UnifiedNotificationProvider
      userId={user?.id}
      countryId={userProfile?.countryId}
      isExecutiveMode={isExecutiveMode}
    >
      {/* Live Data Integration - connects all data streams */}
      <LiveDataIntegration
        countryId={userProfile?.countryId}
        isExecutiveMode={isExecutiveMode}
        enableIntelligenceStream={true}
        enableEconomicStream={true}
        enableDiplomaticStream={true}
      />
      
      {/* Render children - the rest of the app */}
      {children}
      
      {/* Global notification monitoring (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <NotificationDebugPanel />
      )}
    </UnifiedNotificationProvider>
  );
}

// Development debug panel
function NotificationDebugPanel() {
  const notifications = useNotificationStore(state => state.notifications);
  const stats = useNotificationStore(state => state.stats);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        setIsVisible(!isVisible);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-black/90 text-white text-xs p-4 rounded-lg shadow-2xl z-[10003] max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Notification Debug Panel</h3>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-2">
        <div>
          <strong>Stats:</strong> {stats.total} total, {stats.unread} unread
        </div>
        
        <div>
          <strong>Bridge:</strong> {globalNotificationBridge.getStats().totalRules} rules active
        </div>
        
        <div className="border-t border-gray-700 pt-2">
          <strong>Recent Notifications:</strong>
          {notifications.slice(0, 5).map(notification => (
            <div key={notification.id} className="ml-2 py-1 border-b border-gray-800">
              <div className="font-medium">{notification.title}</div>
              <div className="text-gray-400">
                {notification.category} • {notification.priority} • {notification.status}
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-gray-500 text-[10px]">
          Press Ctrl+Shift+N to toggle
        </div>
      </div>
    </div>
  );
}

export default GlobalNotificationSystem;