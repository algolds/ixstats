import { useState, useEffect } from 'react';

export function useRelativeTime(timestamp: Date | string | number) {
  const [, setTick] = useState(0);

  // Force re-render every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(tick => tick + 1);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Calculate relative time
  const calculateRelativeTime = () => {
    const messageTime = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - messageTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMs < 0) {
      // Future timestamp - show absolute time
      return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return messageTime.toLocaleDateString();
  };

  return calculateRelativeTime();
}