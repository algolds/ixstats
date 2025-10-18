"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { Target, Crown, ChevronDown, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import { ATOMIC_COMPONENTS } from '~/components/government/atoms/AtomicGovernmentComponents';

interface ComponentsListProps {
  components: ComponentType[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComponentsList({ components, isOpen, onOpenChange }: ComponentsListProps) {
  if (components.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Selected Atomic Components
                <Badge variant="secondary" className="ml-2">
                  {components.length}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-1 gap-3">
              {components.map(componentType => {
                const metadata = ATOMIC_COMPONENTS[componentType];
                if (!metadata) return null;

                return (
                  <motion.div
                    key={componentType}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-muted hover:border-primary/30 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                      <Crown className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{metadata.name}</p>
                        <Badge variant="outline" className="text-xs">
                          <Target className="h-3 w-3 mr-1" />
                          Component
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {metadata.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
