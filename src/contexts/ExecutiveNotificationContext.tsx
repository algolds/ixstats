"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface ExecutiveNotification {
  id: string;
  type: 'alert' | 'opportunity' | 'update' | 'message' | 'achievement';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  category: 'economic' | 'diplomatic' | 'social' | 'security' | 'governance';
  timestamp: number;
  actionable: boolean;
  read: boolean;
  source: string;
}

interface ExecutiveNotificationContextType {
  notifications: ExecutiveNotification[];
  unreadCount: number;
  isExecutiveMode: boolean;
  setNotifications: (notifications: ExecutiveNotification[]) => void;
  setExecutiveMode: (isExecutive: boolean) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
}

const ExecutiveNotificationContext = createContext<ExecutiveNotificationContextType | null>(null);

export function useExecutiveNotifications() {
  const context = useContext(ExecutiveNotificationContext);
  if (!context) {
    return {
      notifications: [],
      unreadCount: 0,
      isExecutiveMode: false,
      setNotifications: () => {},
      setExecutiveMode: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
    };
  }
  return context;
}

interface ExecutiveNotificationProviderProps {
  children: React.ReactNode;
}

export function ExecutiveNotificationProvider({ children }: ExecutiveNotificationProviderProps) {
  const [notifications, setNotifications] = useState<ExecutiveNotification[]>([]);
  const [isExecutiveMode, setIsExecutiveMode] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const setExecutiveMode = useCallback((isExecutive: boolean) => {
    setIsExecutiveMode(isExecutive);
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const contextValue: ExecutiveNotificationContextType = {
    notifications,
    unreadCount,
    isExecutiveMode,
    setNotifications,
    setExecutiveMode,
    markAsRead,
    markAllAsRead,
  };

  return (
    <ExecutiveNotificationContext.Provider value={contextValue}>
      {children}
    </ExecutiveNotificationContext.Provider>
  );
}

export { ExecutiveNotificationContext };
export type { ExecutiveNotification };