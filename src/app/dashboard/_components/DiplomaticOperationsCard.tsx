"use client";

import React, { useState } from "react";
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
  Eye
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
  onToggleExpansion 
}: DiplomaticOperationsCardProps) {
  const [focusedSection, setFocusedSection] = useState<string | null>(null);

  // Fetch diplomatic data
  const { data: diplomaticRelations } = api.countries.getDiplomaticRelations?.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  ) || { data: [] };

  const { data: activeCrises } = api.sdi.getActiveCrises.useQuery(
    undefined,
    { enabled: !!userProfile?.countryId }
  );

  const { data: diplomaticIntelligence } = api.sdi.getDiplomaticIntelligence?.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  ) || { data: null };

  // Mock data for demonstration (replace with real API calls)
  const embassyNetworks = [
    { id: 1, country: "Caphiria", status: "active", strength: 85 },
    { id: 2, country: "Urcea", status: "strengthening", strength: 72 },
    { id: 3, country: "Burgundie", status: "neutral", strength: 45 },
  ];

  const activeTreaties = [
    { id: 1, name: "Trade Agreement Alpha", status: "active", progress: 100 },
    { id: 2, name: "Security Pact Beta", status: "negotiating", progress: 65 },
    { id: 3, name: "Cultural Exchange", status: "pending", progress: 30 },
  ];

  const crisisAlerts = activeCrises?.slice(0, 3) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'strengthening': return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'negotiating': case 'pending': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      case 'crisis': case 'deteriorating': return 'text-red-400 border-red-500/30 bg-red-500/10';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'negotiating': case 'pending': return <Clock className="h-4 w-4" />;
      case 'crisis': return <AlertTriangle className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
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
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Shield className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-red-400">
                  Diplomatic Operations
                </CardTitle>
                <p className="text-sm text-muted-foreground">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleExpansion}
                  className="p-2"
                >
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
              <h4 className="font-semibold text-sm">Embassy Networks</h4>
              <Badge variant="outline" className="text-xs">
                {embassyNetworks.length} Active
              </Badge>
            </div>
            
            <div className="space-y-2">
              {embassyNetworks.slice(0, isExpanded ? embassyNetworks.length : 3).map((embassy) => (
                <div 
                  key={embassy.id} 
                  className="glass-hierarchy-child p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setFocusedSection(focusedSection === `embassy-${embassy.id}` ? null : `embassy-${embassy.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn("p-1 rounded border", getStatusColor(embassy.status))}>
                        {getStatusIcon(embassy.status)}
                      </div>
                      <span className="font-medium text-sm">{embassy.country}</span>
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
                      className="mt-3 pt-3 border-t border-white/10"
                    >
                      <div className="text-xs text-muted-foreground">
                        Status: {embassy.status} • Diplomatic strength at {embassy.strength}%
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active Treaties */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Handshake className="h-4 w-4 text-green-400" />
              <h4 className="font-semibold text-sm">Treaty Management</h4>
              <Badge variant="outline" className="text-xs">
                {activeTreaties.length} In Progress
              </Badge>
            </div>
            
            <div className="space-y-2">
              {activeTreaties.slice(0, isExpanded ? activeTreaties.length : 2).map((treaty) => (
                <div 
                  key={treaty.id} 
                  className="glass-hierarchy-child p-3 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{treaty.name}</span>
                    <div className="flex items-center gap-2">
                      <div className={cn("p-1 rounded border", getStatusColor(treaty.status))}>
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
                <h4 className="font-semibold text-sm">Crisis Response</h4>
                <Badge variant="destructive" className="text-xs">
                  {crisisAlerts.length} Active
                </Badge>
              </div>
              
              <div className="space-y-2">
                {crisisAlerts.slice(0, isExpanded ? crisisAlerts.length : 2).map((crisis: any, index: number) => (
                  <div 
                    key={crisis.id || index} 
                    className="glass-hierarchy-child p-3 rounded-lg border-l-2 border-red-500/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm text-red-400">
                          {crisis.title || `Crisis ${index + 1}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
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
              <h4 className="font-semibold text-sm">Intelligence Summary</h4>
            </div>
            
            <div className="glass-hierarchy-child p-3 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-green-400">
                    {embassyNetworks.filter(e => e.status === 'active').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Stable Relations</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-yellow-400">
                    {activeTreaties.filter(t => t.status === 'negotiating').length}
                  </div>
                  <div className="text-xs text-muted-foreground">In Negotiation</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-400">
                    {crisisAlerts.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Active Crises</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-2 border-t border-white/10">
            <div className="grid grid-cols-2 gap-2">
              <Link href={createUrl("/mycountry/new?tab=diplomatic")}>
                <Button variant="outline" size="sm" className="w-full">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Diplomatic Briefing
                </Button>
              </Link>
              
              <Link href={createUrl("/thinkpages?filter=diplomatic")}>
                <Button variant="outline" size="sm" className="w-full">
                  <Globe className="h-4 w-4 mr-2" />
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