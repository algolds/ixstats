"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  Eye, Shield, AlertTriangle, Target, Brain, Settings, ChevronUp, ChevronDown
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { CountryIntelligenceSection } from "~/app/countries/_components/CountryIntelligenceSection";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";

interface SDICardProps {
  userProfile?: { countryId: string | null };
  isSdiExpanded: boolean;
  toggleSdiExpansion: () => void;
  focusedCard: string | null;
  setFocusedCard: (card: string | null) => void;
}

export function SDICard({
  userProfile,
  isSdiExpanded,
  toggleSdiExpansion,
  focusedCard,
  setFocusedCard
}: SDICardProps) {
  return (
    <motion.div
      className={cn(
        "lg:col-span-6",
        "glass-hierarchy-parent relative overflow-hidden group cursor-pointer",
        "rounded-xl border border-neutral-200 dark:border-white/[0.2] transition-all duration-200",
        "hover:shadow-xl hover:shadow-red-500/10 dark:hover:shadow-red-400/20",
        focusedCard && focusedCard !== "sdi" && "blur-sm scale-95 opacity-50"
      )}
      onClick={() => setFocusedCard(focusedCard === "sdi" ? null : "sdi")}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 40, delay: 0.3 }}
      layout
    >
      {/* Red glow overlay for SDI section theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-400/10 via-red-300/5 to-red-500/10 
                    rounded-xl animate-pulse pointer-events-none" style={{ animationDuration: '7s' }} />
      
      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Eye className="h-6 w-6 text-red-400" />
            <div>
              <h3 className="text-xl font-bold text-foreground">Strategic Defense Intelligence</h3>
              <p className="text-sm text-muted-foreground">Intelligence operations and security oversight</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="glass-hierarchy-interactive"
              onClick={(e) => {
                e.stopPropagation();
                window.open(createUrl("/sdi"), "_blank");
              }}
            >
              → Open SDI
            </Button>
            
            {/* Expand Arrow */}
            <button 
              className="p-2 rounded-full glass-surface glass-interactive hover:glass-depth-2 transition-all duration-200"
              onClick={(e) => {
                e.stopPropagation();
                toggleSdiExpansion();
              }}
            >
              {isSdiExpanded ? (
                <ChevronUp className="h-5 w-5 text-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* SDI Preview - Always Visible */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 glass-hierarchy-child rounded">
            <span className="text-sm text-muted-foreground">Threat Level</span>
            <Badge variant="destructive" className="text-xs">ELEVATED</Badge>
          </div>
          <div className="flex items-center justify-between p-3 glass-hierarchy-child rounded">
            <span className="text-sm text-muted-foreground">Global Crises</span>
            <span className="text-sm font-medium text-red-400">3 Active</span>
          </div>
          <div className="flex items-center justify-between p-3 glass-hierarchy-child rounded">
            <span className="text-sm text-muted-foreground">Intel Reports</span>
            <Badge variant="outline">12 New</Badge>
          </div>
        </div>

        {/* SDI Submodule Icons - Only show when not expanded */}
        {!isSdiExpanded && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/mycountry#government">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <Shield className="h-4 w-4 text-red-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Security Monitoring</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/mycountry#analytics">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <AlertTriangle className="h-4 w-4 text-orange-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Threat Analysis</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/mycountry#intelligence">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <Eye className="h-4 w-4 text-blue-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Intelligence Reports</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/mycountry#analytics">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <Target className="h-4 w-4 text-purple-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Crisis Management</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/mycountry#government">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <Brain className="h-4 w-4 text-green-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Strategic Planning</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/mycountry#government">
                  <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                    <Settings className="h-4 w-4 text-gray-400" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Defense Systems</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Expandable SDI Content */}
        <AnimatePresence>
          {isSdiExpanded && userProfile?.countryId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mt-6 overflow-hidden"
            >
              <div className="glass-hierarchy-child p-6 rounded-lg">
                {userProfile.countryId && (
                  <CountryIntelligenceSection countryId={userProfile.countryId} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!userProfile?.countryId && (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Configure your country profile to access Strategic Defense Intelligence</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}