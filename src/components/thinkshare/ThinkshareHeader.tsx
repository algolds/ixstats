"use client";

import React from 'react';
import { Send, Plus } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';

interface ThinkshareHeaderProps {
  onNewMessageClick: () => void;
}

export function ThinkshareHeader({ onNewMessageClick }: ThinkshareHeaderProps) {
  return (
    <Card className="glass-hierarchy-parent overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-green-600/10 via-transparent to-emerald-600/10" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500" />
      <CardContent className="p-6 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 bg-gradient-to-br from-green-600 to-emerald-700 rounded-lg flex items-center justify-center shadow-lg">
                <Send className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                ThinkShare
              </h2>
              <p className="text-sm text-muted-foreground">
                Private messaging • Connect with minds worldwide
              </p>
            </div>
          </div>
          <Button 
            onClick={onNewMessageClick}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
