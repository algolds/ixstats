"use client";

import React from 'react';
import { useRelativeTime } from '~/hooks/useRelativeTime';

interface MessageTimestampProps {
  timestamp: Date | string | number;
}

export function MessageTimestamp({ timestamp }: MessageTimestampProps) {
  const relativeTime = useRelativeTime(timestamp);
  const date = new Date(timestamp);
  const now = new Date();
  const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  return (
    <span 
      className="text-xs text-muted-foreground cursor-help" 
      title={`IxTime: ${date.toLocaleString()}`}
    >
      {hoursDiff > 24 ? date.toLocaleDateString() : relativeTime}
    </span>
  );
}
