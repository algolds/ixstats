"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { useAchievementUpdates } from "~/hooks/useDiplomaticUpdates";
import type { LiveIntelligenceUpdate } from "~/lib/diplomatic-websocket";
import { IxTime } from "~/lib/ixtime";
import {
  RiStarLine,
  RiTrophyLine,
  RiMedalLine,
  RiAwardLine,
  RiShieldLine,
  RiStarFill,
  RiFlashLine,
  RiFireLine,
  RiCheckLine,
  RiCloseLine
} from "react-icons/ri";

interface AchievementNotificationProps {
  countryId: string;
  countryName: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
  maxNotifications?: number;
  autoHideDuration?: number;
  showParticleEffects?: boolean;
  playSound?: boolean;
  className?: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'legendary';
  category: 'diplomatic' | 'economic' | 'cultural' | 'military' | 'scientific' | 'social' | 'environmental' | 'historical';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points: number;
  unlockedAt: string;
  previousProgress?: number;
  currentProgress?: number;
  maxProgress?: number;
}

interface NotificationState {
  id: string;
  achievement: Achievement;
  timestamp: number;
  isVisible: boolean;
  isExpired: boolean;
}

const TIER_ICONS = {
  bronze: RiMedalLine,
  silver: RiAwardLine,
  gold: RiTrophyLine,
  platinum: RiShieldLine,
  legendary: RiStarFill
} as const;

const TIER_COLORS = {
  bronze: 'from-amber-600 to-amber-800',
  silver: 'from-gray-400 to-gray-600',
  gold: 'from-yellow-400 to-yellow-600',
  platinum: 'from-blue-400 to-purple-600',
  legendary: 'from-purple-500 to-pink-600'
} as const;

const RARITY_EFFECTS = {
  common: 'shadow-md',
  uncommon: 'shadow-lg shadow-green-500/20',
  rare: 'shadow-xl shadow-blue-500/30',
  epic: 'shadow-xl shadow-purple-500/40',
  legendary: 'shadow-2xl shadow-pink-500/50'
} as const;

const POSITION_CLASSES = {
  'top-right': 'fixed top-4 right-4 z-50',
  'top-left': 'fixed top-4 left-4 z-50',
  'bottom-right': 'fixed bottom-4 right-4 z-50',
  'bottom-left': 'fixed bottom-4 left-4 z-50',
  'center': 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50'
} as const;

const RealTimeAchievementNotificationsComponent: React.FC<AchievementNotificationProps> = ({
  countryId,
  countryName,
  position = 'top-right',
  maxNotifications = 3,
  autoHideDuration = 5000,
  showParticleEffects = true,
  playSound = true,
  className
}) => {
  const { isConnected, recentEvents, actions } = useAchievementUpdates(countryId);
  const [notifications, setNotifications] = useState<NotificationState[]>([]);

  // Process new achievement events
  useEffect(() => {
    recentEvents.forEach((update: LiveIntelligenceUpdate) => {
      if (update.type === 'achievement_notification' && update.event.type === 'achievement_unlocked') {
        const achievementData = update.event.data as {
          achievementId: string;
          achievementTier: string;
          achievementTitle?: string;
          achievementDescription?: string;
          achievementCategory?: string;
          achievementRarity?: string;
          achievementPoints?: number;
        };

        // Create achievement object from event data
        const achievement: Achievement = {
          id: achievementData.achievementId,
          title: achievementData.achievementTitle || 'New Achievement Unlocked',
          description: achievementData.achievementDescription || 'You have unlocked a new diplomatic achievement!',
          tier: (achievementData.achievementTier as Achievement['tier']) || 'bronze',
          category: (achievementData.achievementCategory as Achievement['category']) || 'diplomatic',
          rarity: (achievementData.achievementRarity as Achievement['rarity']) || 'common',
          points: achievementData.achievementPoints || 100,
          unlockedAt: update.event.timestamp
        };

        // Add new notification
        const newNotification: NotificationState = {
          id: `${achievement.id}-${Date.now()}`,
          achievement,
          timestamp: Date.now(),
          isVisible: true,
          isExpired: false
        };

        setNotifications(prev => {
          // Remove oldest if at max capacity
          const filtered = prev.slice(0, maxNotifications - 1);
          return [newNotification, ...filtered];
        });

        // Play sound effect if enabled
        if (playSound && typeof window !== 'undefined') {
          playAchievementSound(achievement.tier);
        }

        // Auto-hide after duration
        setTimeout(() => {
          setNotifications(prev => 
            prev.map(n => 
              n.id === newNotification.id 
                ? { ...n, isExpired: true }
                : n
            )
          );
        }, autoHideDuration);

        // Remove completely after animation
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
        }, autoHideDuration + 1000);
      }
    });
  }, [recentEvents, maxNotifications, autoHideDuration, playSound]);

  // Play achievement unlock sound
  const playAchievementSound = (tier: Achievement['tier']) => {
    try {
      // Create audio context for achievement sounds
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Different frequencies for different tiers
      const frequencies = {
        bronze: [440, 550],
        silver: [523, 659],
        gold: [659, 784],
        platinum: [784, 932],
        legendary: [932, 1109]
      };

      const [freq1, freq2] = frequencies[tier];
      
      // Create achievement unlock sound sequence
      [freq1, freq2].forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime + index * 0.15);
        oscillator.stop(audioContext.currentTime + 0.3 + index * 0.15);
      });
    } catch (error) {
      console.warn('Could not play achievement sound:', error);
    }
  };

  // Manually dismiss notification
  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId
          ? { ...n, isExpired: true }
          : n
      )
    );

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }, 300);
  }, []);

  // Render individual notification
  const renderNotification = (notification: NotificationState) => {
    const { achievement } = notification;
    const TierIcon = TIER_ICONS[achievement.tier];
    const tierColor = TIER_COLORS[achievement.tier];
    const rarityEffect = RARITY_EFFECTS[achievement.rarity];

    return (
      <motion.div
        key={notification.id}
        initial={{ opacity: 0, x: position.includes('right') ? 400 : -400, scale: 0.8 }}
        animate={{ 
          opacity: notification.isExpired ? 0 : 1,
          x: notification.isExpired ? (position.includes('right') ? 200 : -200) : 0,
          scale: notification.isExpired ? 0.8 : 1
        }}
        exit={{ 
          opacity: 0, 
          x: position.includes('right') ? 400 : -400, 
          scale: 0.8 
        }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 30,
          opacity: { duration: 0.3 }
        }}
        className={cn(
          "relative w-80 p-4 rounded-xl border backdrop-blur-md",
          "bg-gradient-to-r from-black/40 to-black/20",
          "border-[--intel-gold]/30",
          rarityEffect,
          "overflow-hidden group"
        )}
      >
        {/* Particle Effects Background */}
        {showParticleEffects && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-[--intel-gold] rounded-full"
                initial={{ 
                  x: Math.random() * 300, 
                  y: Math.random() * 100,
                  opacity: 0
                }}
                animate={{ 
                  y: [null, -20, -40],
                  opacity: [0, 1, 0],
                  scale: [1, 1.5, 0]
                }}
                transition={{ 
                  duration: 2,
                  delay: i * 0.1,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
              />
            ))}
          </div>
        )}

        {/* Tier Gradient Background */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-10",
          tierColor
        )} />

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                "bg-gradient-to-br shadow-lg",
                tierColor
              )}>
                <TierIcon className="w-6 h-6 text-white" />
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-bold text-sm">
                    Achievement Unlocked!
                  </h4>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium uppercase",
                    "bg-[--intel-gold]/20 text-[--intel-gold]"
                  )}>
                    {achievement.tier}
                  </span>
                </div>
                <p className="text-[--intel-silver] text-xs">
                  +{achievement.points} points
                </p>
              </div>
            </div>

            <button
              onClick={() => dismissNotification(notification.id)}
              className="p-1 text-[--intel-silver] hover:text-white transition-colors rounded"
            >
              <RiCloseLine className="w-4 h-4" />
            </button>
          </div>

          {/* Achievement Details */}
          <div className="space-y-2">
            <h5 className="text-white font-semibold text-base">
              {achievement.title}
            </h5>
            <p className="text-[--intel-silver] text-sm leading-relaxed">
              {achievement.description}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center gap-4 text-xs text-[--intel-silver]">
              <span className="capitalize">{achievement.category}</span>
              <span className="capitalize">{achievement.rarity}</span>
            </div>
            
            <div className="text-xs text-[--intel-silver]">
              {new Date(achievement.unlockedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Connection Status Indicator */}
        {!isConnected && (
          <div className="absolute top-2 left-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </motion.div>
    );
  };

  return (
    <div className={cn(POSITION_CLASSES[position], className)}>
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {notifications.map(renderNotification)}
        </AnimatePresence>
      </div>

      {/* Connection Status */}
      {!isConnected && notifications.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-80 p-3 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm"
        >
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
            <div>
              <div className="font-medium">Offline Mode</div>
              <div className="text-xs opacity-80 mt-1">
                Achievement notifications require WebSocket connection
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

RealTimeAchievementNotificationsComponent.displayName = 'RealTimeAchievementNotifications';

export const RealTimeAchievementNotifications = React.memo(RealTimeAchievementNotificationsComponent);