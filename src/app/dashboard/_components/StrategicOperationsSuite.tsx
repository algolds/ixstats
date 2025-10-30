"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  Shield,
  MessageSquare,
  Users,
  Target,
  Globe,
  Zap,
  Activity,
  Settings,
} from "lucide-react";
import { DiplomaticOperationsCard } from "./DiplomaticOperationsCard";
import { StrategicCommunicationsCard } from "./StrategicCommunicationsCard";

interface StrategicOperationsSuiteProps {
  userProfile?: any;
  className?: string;
}

export function StrategicOperationsSuite({
  userProfile,
  className = "",
}: StrategicOperationsSuiteProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const operations = [
    {
      id: "diplomatic",
      name: "Diplomatic Operations",
      icon: Shield,
      color: "text-blue-500",
      status: "Active",
      metrics: "12 active missions",
    },
    {
      id: "communications",
      name: "Strategic Communications",
      icon: MessageSquare,
      color: "text-green-500",
      status: "Monitoring",
      metrics: "3 campaigns running",
    },
    {
      id: "intelligence",
      name: "Intelligence Coordination",
      icon: Target,
      color: "text-orange-500",
      status: "Standby",
      metrics: "45 reports pending",
    },
    {
      id: "network",
      name: "Network Operations",
      icon: Globe,
      color: "text-purple-500",
      status: "Online",
      metrics: "98.7% uptime",
    },
  ];

  return (
    <div className={className}>
      {/* Suite Header */}
      <Card className="glass-hierarchy-child mb-4">
        <CardHeader className="pb-3">
          <div
            className="flex cursor-pointer items-center justify-between"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Activity className="h-5 w-5 text-indigo-500" />
              Strategic Operations Suite
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {operations.filter((op) => op.status === "Active").length} Active
              </Badge>
              {isExpanded ? (
                <ChevronUp className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              )}
            </div>
          </div>
        </CardHeader>

        {/* Collapsed Summary */}
        {!isExpanded && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {operations.map((operation) => {
                const IconComponent = operation.icon;
                return (
                  <div
                    key={operation.id}
                    className="glass-hierarchy-interactive rounded-lg p-3 text-center transition-transform hover:scale-[1.02]"
                  >
                    <div className="mb-2 flex items-center justify-center">
                      <IconComponent className={`h-5 w-5 ${operation.color}`} />
                    </div>
                    <div className="mb-1 text-xs font-medium">{operation.name}</div>
                    <Badge
                      variant={operation.status === "Active" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {operation.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Expanded Operations */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-6">
              {/* Operations Overview Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {operations.map((operation) => {
                  const IconComponent = operation.icon;
                  return (
                    <Card key={operation.id} className="glass-hierarchy-interactive">
                      <CardContent className="p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <IconComponent className={`h-5 w-5 ${operation.color}`} />
                          <Badge
                            variant={operation.status === "Active" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {operation.status}
                          </Badge>
                        </div>
                        <h3 className="mb-1 text-sm font-medium">{operation.name}</h3>
                        <p className="text-muted-foreground text-xs">{operation.metrics}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Detailed Operation Cards */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <DiplomaticOperationsCard userProfile={userProfile} />
                <StrategicCommunicationsCard userProfile={userProfile} />
              </div>

              {/* Additional Operations */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Intelligence Coordination */}
                <Card className="glass-hierarchy-child">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <Target className="h-5 w-5 text-orange-500" />
                      Intelligence Coordination
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pending Reports</span>
                        <span className="font-medium">45</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Active Sources</span>
                        <span className="font-medium">12</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Threat Level</span>
                        <Badge variant="outline" className="text-xs">
                          Low
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Network Operations */}
                <Card className="glass-hierarchy-child">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <Globe className="h-5 w-5 text-purple-500" />
                      Network Operations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">System Uptime</span>
                        <span className="font-medium text-green-600">98.7%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Active Connections</span>
                        <span className="font-medium">1,247</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Security Status</span>
                        <Badge variant="default" className="text-xs">
                          <Shield className="mr-1 h-3 w-3" />
                          Secure
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
