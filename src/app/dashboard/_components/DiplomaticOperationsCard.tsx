"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Globe,
  Users,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  ArrowRight,
  Building2,
  Handshake,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { createUrl } from "~/lib/url-utils";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface DiplomaticOperationsCardProps {
  userProfile?: {
    id: string;
    countryId?: string;
  };
  className?: string;
  isExpanded?: boolean;
  onToggleExpansion?: () => void;
}

export function DiplomaticOperationsCard({
  userProfile,
  className,
  isExpanded = false,
  onToggleExpansion,
}: DiplomaticOperationsCardProps) {
  const [focusedSection, setFocusedSection] = useState<string | null>(null);

  // Fetch diplomatic data
  const { data: diplomaticRelations } = api.countries.getDiplomaticRelations?.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId }
  ) || { data: [] };

  const { data: activeCrises } = api.unifiedIntelligence.getActiveCrises.useQuery();

  const { data: diplomaticIntelligence } =
    api.unifiedIntelligence.getEnhancedDiplomaticIntelligence?.useQuery(
      { countryId: userProfile?.countryId || "" },
      { enabled: !!userProfile?.countryId }
    ) || { data: null };

  // Fetch live embassy network data
  const { data: liveEmbassies, isLoading: embassiesLoading } = api.diplomatic.getEmbassies.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId, refetchInterval: 60000 }
  );

  // Use live embassy data or show empty state
  const embassyNetworks = useMemo(() => {
    if (liveEmbassies && liveEmbassies.length > 0) {
      return liveEmbassies.map((embassy, index) => ({
        id: index + 1,
        country: embassy.country,
        status: embassy.status,
        strength: embassy.strength,
      }));
    }

    // Return empty array if no real data
    return [];
  }, [liveEmbassies]);

  const activeTreaties = [
    { id: 1, name: "Trade Agreement Alpha", status: "active", progress: 100 },
    { id: 2, name: "Security Pact Beta", status: "negotiating", progress: 65 },
    { id: 3, name: "Cultural Exchange", status: "pending", progress: 30 },
  ];

  const crisisAlerts = activeCrises?.slice(0, 3) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "strengthening":
        return "text-green-400 border-green-500/30 bg-green-500/10";
      case "negotiating":
      case "pending":
        return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
      case "crisis":
      case "deteriorating":
        return "text-red-400 border-red-500/30 bg-red-500/10";
      default:
        return "text-gray-400 border-gray-500/30 bg-gray-500/10";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4" />;
      case "negotiating":
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "crisis":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <motion.div
      className={cn("lg:col-span-6", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card className="glass-hierarchy-parent h-full overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500/20 p-2">
                <Shield className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-red-400">
                  Diplomatic Operations
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Embassy Networks & Treaty Management
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href={createUrl("/mycountry/new")}>
                <Button variant="outline" size="sm" className="group">
                  Full Command Center
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
              {onToggleExpansion && (
                <Button variant="ghost" size="sm" onClick={onToggleExpansion} className="p-2">
                  {isExpanded ? "−" : "+"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Embassy Networks */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-400" />
              <h4 className="text-sm font-semibold">Embassy Networks</h4>
              <Badge variant="outline" className="text-xs">
                {embassyNetworks.length} Active
              </Badge>
              {embassiesLoading && (
                <div className="h-3 w-3 animate-spin rounded-full border border-blue-400/20 border-t-blue-400" />
              )}
            </div>

            {embassyNetworks.length > 0 ? (
              <div className="space-y-2">
                {embassyNetworks
                  .slice(0, isExpanded ? embassyNetworks.length : 3)
                  .map((embassy) => (
                    <div
                      key={embassy.id}
                      className="glass-hierarchy-child cursor-pointer rounded-lg p-3 transition-colors hover:bg-white/5"
                      onClick={() =>
                        setFocusedSection(
                          focusedSection === `embassy-${embassy.id}`
                            ? null
                            : `embassy-${embassy.id}`
                        )
                      }
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("rounded border p-1", getStatusColor(embassy.status))}>
                            {getStatusIcon(embassy.status)}
                          </div>
                          <span className="text-sm font-medium">{embassy.country}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {embassy.strength}%
                        </Badge>
                      </div>
                      <Progress value={embassy.strength} className="h-2" />

                      {focusedSection === `embassy-${embassy.id}` && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 border-t border-white/10 pt-3"
                        >
                          <div className="text-muted-foreground text-xs">
                            Status: {embassy.status} • Diplomatic strength at {embassy.strength}%
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="glass-hierarchy-child rounded-lg p-6 text-center">
                <Building2 className="text-muted-foreground mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-muted-foreground text-sm">No embassies established yet</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Build diplomatic relations to establish embassies
                </p>
              </div>
            )}
          </div>

          {/* Active Treaties */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Handshake className="h-4 w-4 text-green-400" />
              <h4 className="text-sm font-semibold">Treaty Management</h4>
              <Badge variant="outline" className="text-xs">
                {activeTreaties.length} In Progress
              </Badge>
            </div>

            <div className="space-y-2">
              {activeTreaties.slice(0, isExpanded ? activeTreaties.length : 2).map((treaty) => (
                <div key={treaty.id} className="glass-hierarchy-child rounded-lg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{treaty.name}</span>
                    <div className="flex items-center gap-2">
                      <div className={cn("rounded border p-1", getStatusColor(treaty.status))}>
                        {getStatusIcon(treaty.status)}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {treaty.progress}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={treaty.progress} className="h-2" />
                </div>
              ))}
            </div>
          </div>

          {/* Crisis Response */}
          {crisisAlerts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <h4 className="text-sm font-semibold">Crisis Response</h4>
                <Badge variant="destructive" className="text-xs">
                  {crisisAlerts.length} Active
                </Badge>
              </div>

              <div className="space-y-2">
                {crisisAlerts
                  .slice(0, isExpanded ? crisisAlerts.length : 2)
                  .map((crisis: any, index: number) => (
                    <div
                      key={crisis.id || index}
                      className="glass-hierarchy-child rounded-lg border-l-2 border-red-500/50 p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-medium text-red-400">
                            {crisis.title || `Crisis ${index + 1}`}
                          </div>
                          <div className="text-muted-foreground mt-1 text-xs">
                            {crisis.description || "Diplomatic situation requires attention"}
                          </div>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {crisis.severity || "High"}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Intelligence Overview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-purple-400" />
              <h4 className="text-sm font-semibold">Intelligence Summary</h4>
            </div>

            <div className="glass-hierarchy-child rounded-lg p-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-green-400">
                    {embassyNetworks.filter((e) => e.status === "active").length}
                  </div>
                  <div className="text-muted-foreground text-xs">Stable Relations</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-yellow-400">
                    {activeTreaties.filter((t) => t.status === "negotiating").length}
                  </div>
                  <div className="text-muted-foreground text-xs">In Negotiation</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-400">{crisisAlerts.length}</div>
                  <div className="text-muted-foreground text-xs">Active Crises</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="border-t border-white/10 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <Link href={createUrl("/mycountry/new?tab=diplomatic")}>
                <Button variant="outline" size="sm" className="w-full">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Diplomatic Briefing
                </Button>
              </Link>

              <Link href={createUrl("/thinkpages?filter=diplomatic")}>
                <Button variant="outline" size="sm" className="w-full">
                  <Globe className="mr-2 h-4 w-4" />
                  Embassy Wire
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
