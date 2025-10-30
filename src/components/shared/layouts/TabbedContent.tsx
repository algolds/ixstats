"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabbedContentProps {
  tabs: Tab[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
  tabsClassName?: string;
  contentClassName?: string;
  orientation?: "horizontal" | "vertical";
  variant?: "default" | "pills" | "underline";
  animated?: boolean;
}

export function TabbedContent({
  tabs,
  defaultTab,
  onTabChange,
  className,
  tabsClassName,
  contentClassName,
  orientation = "horizontal",
  variant = "default",
  animated = true,
}: TabbedContentProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const variantStyles = {
    default: "",
    pills: "bg-muted/50 p-1 rounded-lg",
    underline: "border-b border-border",
  };

  const triggerVariantStyles = {
    default: "",
    pills: "data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md",
    underline: "border-b-2 border-transparent data-[state=active]:border-primary rounded-none",
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className={cn("w-full", className)}>
      <TabsList
        className={cn(
          "w-full",
          variantStyles[variant],
          orientation === "vertical" && "h-auto flex-col",
          tabsClassName
        )}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className={cn(
              "flex items-center gap-2",
              triggerVariantStyles[variant],
              orientation === "vertical" && "w-full justify-start"
            )}
          >
            {tab.icon && <tab.icon className="h-4 w-4" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {tab.badge}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className={cn("mt-4", contentClassName)}>
          {animated ? (
            <AnimatePresence mode="wait">
              {activeTab === tab.id && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {tab.content}
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            tab.content
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
