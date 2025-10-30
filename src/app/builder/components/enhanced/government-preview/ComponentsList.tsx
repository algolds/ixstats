"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Target, Crown, ChevronDown, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import type { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import { ATOMIC_COMPONENTS } from "~/components/government/atoms/AtomicGovernmentComponents";

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
          <CardHeader className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Selected Atomic Components
                <Badge variant="secondary" className="ml-2">
                  {components.length}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronDown className="text-muted-foreground h-5 w-5 transition-transform" />
              ) : (
                <ChevronRight className="text-muted-foreground h-5 w-5 transition-transform" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-1 gap-3">
              {components.map((componentType) => {
                const metadata = ATOMIC_COMPONENTS[componentType];
                if (!metadata) return null;

                return (
                  <motion.div
                    key={componentType}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-muted/50 border-muted hover:border-primary/30 flex items-start gap-3 rounded-lg border p-4 transition-colors"
                  >
                    <div className="bg-primary/10 flex-shrink-0 rounded-lg p-2">
                      <Crown className="text-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-sm font-semibold">{metadata.name}</p>
                        <Badge variant="outline" className="text-xs">
                          <Target className="mr-1 h-3 w-3" />
                          Component
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed">
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
