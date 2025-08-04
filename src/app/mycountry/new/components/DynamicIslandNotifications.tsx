"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Crown,
  Globe2,
  TrendingUp,
  Users,
  Building2,
  MessageSquare,
  Calendar,
  Settings,
  Search,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Separator } from '~/components/ui/separator';

interface Notification {
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

interface DynamicIslandNotificationsProps {
  notifications: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onMarkAllRead?: () => void;
  onNotificationAction?: (notificationId: string, action: string) => void;
  className?: string;
}

function getNotificationIcon(type: Notification['type'], severity: Notification['severity']) {
  const iconProps = { 
    size: 16, 
    className: severity === 'critical' ? 'text-red-500' : 
               severity === 'high' ? 'text-orange-500' :
               severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
  };

  switch (type) {
    case 'alert':
      return <AlertTriangle {...iconProps} />;
    case 'opportunity':
      return <Zap {...iconProps} />;
    case 'update':
      return <CheckCircle {...iconProps} />;
    case 'message':
      return <MessageSquare {...iconProps} />;
    case 'achievement':
      return <Crown {...iconProps} />;
    default:
      return <Bell {...iconProps} />;
  }
}

function getCategoryIcon(category: Notification['category']) {
  const iconProps = { size: 14, className: 'text-muted-foreground' };
  
  switch (category) {
    case 'economic':
      return <TrendingUp {...iconProps} />;
    case 'diplomatic':
      return <Globe2 {...iconProps} />;
    case 'social':
      return <Users {...iconProps} />;
    case 'governance':
      return <Building2 {...iconProps} />;
    case 'security':
      return <AlertTriangle {...iconProps} />;
    default:
      return <Bell {...iconProps} />;
  }
}

export function DynamicIslandNotifications({
  notifications,
  onNotificationClick,
  onMarkAllRead,
  onNotificationAction,
  className = ''
}: DynamicIslandNotificationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical' | 'actionable'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalCount = notifications.filter(n => n.severity === 'critical' && !n.read).length;
  
  // Filter notifications
  const filteredNotifications = notifications
    .filter(notification => {
      if (filter === 'unread') return !notification.read;
      if (filter === 'critical') return notification.severity === 'critical';
      if (filter === 'actionable') return notification.actionable;
      return true;
    })
    .filter(notification => 
      searchQuery === '' || 
      notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by severity (critical first), then by timestamp (newest first)
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
      return b.timestamp - a.timestamp;
    });

  const handleNotificationClick = (notification: Notification) => {
    onNotificationClick?.(notification);
    // Mark as read when clicked
    if (!notification.read) {
      // This would typically trigger a state update in the parent
      onNotificationAction?.(notification.id, 'mark_read');
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <AnimatePresence>
        {!isExpanded ? (
          // Collapsed Dynamic Island
          <motion.div
            key="collapsed"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative"
          >
            <Button
              onClick={() => setIsExpanded(true)}
              className="glass-hierarchy-interactive bg-black/80 backdrop-blur-xl border-white/10 text-white hover:bg-black/90 transition-all duration-300 relative overflow-hidden"
              style={{
                borderRadius: '20px',
                padding: '8px 16px',
                minWidth: unreadCount > 0 ? '120px' : '80px',
              }}
            >
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-1"
                  >
                    <Badge 
                      className={`text-xs px-1.5 py-0 ${
                        criticalCount > 0 ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                      }`}
                    >
                      {unreadCount}
                    </Badge>
                  </motion.div>
                )}
              </div>
              
              {/* Pulse animation for critical notifications */}
              {criticalCount > 0 && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-red-500/20"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </Button>
          </motion.div>
        ) : (
          // Expanded Notification Panel
          <motion.div
            key="expanded"
            initial={{ scale: 0.9, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-96"
          >
            <Card className="glass-hierarchy-parent bg-black/90 backdrop-blur-xl border-white/10 text-white shadow-2xl">
              <CardContent className="p-0">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-white" />
                    <div>
                      <h3 className="font-semibold">Notifications</h3>
                      <p className="text-xs text-white/60">
                        {unreadCount} unread {criticalCount > 0 && `• ${criticalCount} critical`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMarkAllRead}
                        className="text-xs text-white/80 hover:text-white hover:bg-white/10"
                      >
                        Mark all read
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsExpanded(false)}
                      className="text-white/80 hover:text-white hover:bg-white/10 p-1"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="p-4 space-y-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        placeholder="Search notifications..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-white/20"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/80 hover:text-white hover:bg-white/10"
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex gap-2">
                    {['all', 'unread', 'critical', 'actionable'].map((filterOption) => (
                      <Button
                        key={filterOption}
                        variant={filter === filterOption ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter(filterOption as any)}
                        className={`text-xs capitalize ${
                          filter === filterOption 
                            ? 'bg-white/20 text-white' 
                            : 'text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {filterOption}
                        {filterOption === 'unread' && unreadCount > 0 && (
                          <Badge className="ml-1 bg-blue-500 text-white text-xs px-1">
                            {unreadCount}
                          </Badge>
                        )}
                        {filterOption === 'critical' && criticalCount > 0 && (
                          <Badge className="ml-1 bg-red-500 text-white text-xs px-1">
                            {criticalCount}
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-96 overflow-y-auto">
                  {filteredNotifications.length > 0 ? (
                    <div className="space-y-1 p-2">
                      {filteredNotifications.map((notification, index) => (
                        <motion.div
                          key={notification.id && notification.id.trim() ? `notification-${notification.id}` : `notification-fallback-${index}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleNotificationClick(notification)}
                          className={`p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/5 border border-transparent hover:border-white/10 ${
                            !notification.read ? 'bg-white/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getNotificationIcon(notification.type, notification.severity)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-medium text-white truncate">
                                  {notification.title}
                                </h4>
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                                )}
                              </div>
                              
                              <p className="text-xs text-white/70 line-clamp-2 mb-2">
                                {notification.description}
                              </p>
                              
                              <div className="flex items-center gap-2 text-xs text-white/50">
                                {getCategoryIcon(notification.category)}
                                <span className="capitalize">{notification.category}</span>
                                <span>•</span>
                                <span>{new Date(notification.timestamp).toLocaleTimeString()}</span>
                                <span>•</span>
                                <span>{notification.source}</span>
                                {notification.actionable && (
                                  <>
                                    <span>•</span>
                                    <Badge className="bg-amber-500/20 text-amber-300 text-xs px-1">
                                      Action Required
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-white/60">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notifications found</p>
                      {searchQuery && (
                        <p className="text-xs mt-1">Try adjusting your search or filters</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {filteredNotifications.length > 0 && (
                  <div className="p-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-white/60">
                      {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-white/60 hover:text-white hover:bg-white/10"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Settings
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DynamicIslandNotifications;