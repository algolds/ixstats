"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Progress } from "~/components/ui/progress";
import { 
  Shield, 
  AlertTriangle, 
  Lock, 
  Wifi, 
  Zap, 
  Building2, 
  Users, 
  Globe,
  Eye,
  Target,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  BarChart3,
  Activity,
  MapPin,
  ExternalLink,
  RefreshCw,
  Plus,
  Search
} from "lucide-react";
import { toast } from "sonner";

interface NationalSecurityModalProps {
  children: React.ReactNode;
  mode?: "dashboard" | "report" | "protocols";
  threatId?: string;
}

const THREAT_CATEGORIES = [
  { value: "cyber", label: "Cyber Security", icon: Wifi, color: "text-blue-600", bg: "bg-blue-100" },
  { value: "terrorism", label: "Terrorism", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100" },
  { value: "military", label: "Military", icon: Shield, color: "text-green-600", bg: "bg-green-100" },
  { value: "economic", label: "Economic", icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-100" },
  { value: "infrastructure", label: "Infrastructure", icon: Building2, color: "text-orange-600", bg: "bg-orange-100" },
  { value: "political", label: "Political", icon: Users, color: "text-indigo-600", bg: "bg-indigo-100" }
];

const SEVERITY_LEVELS = [
  { value: "low", label: "Low", color: "text-green-600", bg: "bg-green-100" },
  { value: "medium", label: "Medium", color: "text-yellow-600", bg: "bg-yellow-100" },
  { value: "high", label: "High", color: "text-orange-600", bg: "bg-orange-100" },
  { value: "critical", label: "Critical", color: "text-red-600", bg: "bg-red-100" }
];

const THREAT_STATUS = [
  { value: "active", label: "Active", color: "text-red-600", bg: "bg-red-100" },
  { value: "monitoring", label: "Monitoring", color: "text-yellow-600", bg: "bg-yellow-100" },
  { value: "resolved", label: "Resolved", color: "text-green-600", bg: "bg-green-100" },
  { value: "dismissed", label: "Dismissed", color: "text-gray-600", bg: "bg-gray-100" }
];

export function NationalSecurityModal({ 
  children, 
  mode = "dashboard", 
  threatId 
}: NationalSecurityModalProps) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [newThreatForm, setNewThreatForm] = useState({
    title: "",
    description: "",
    severity: "medium" as "low" | "medium" | "high" | "critical",
    category: "",
    source: "",
    location: "",
    estimatedImpact: ""
  });

  // Get security dashboard data
  const { data: securityDashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = 
    api.eci.getSecurityDashboard.useQuery(
      { userId: user?.id || '' },
      { enabled: !!user?.id && open }
    );

  // Get security threats
  const { data: threats, isLoading: threatsLoading, refetch: refetchThreats } = 
    api.eci.getSecurityThreats.useQuery(
      { userId: user?.id || '' },
      { enabled: !!user?.id && open }
    );

  // Create threat mutation
  const createThreat = api.eci.createSecurityThreat.useMutation({
    onSuccess: () => {
      toast.success("Security threat reported successfully!");
      resetThreatForm();
      void refetchThreats();
      void refetchDashboard();
    },
    onError: (error) => {
      toast.error(`Failed to report threat: ${error.message}`);
    },
  });

  const resetThreatForm = () => {
    setNewThreatForm({
      title: "",
      description: "",
      severity: "medium",
      category: "",
      source: "",
      location: "",
      estimatedImpact: ""
    });
  };

  const handleSubmitThreat = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newThreatForm.title.trim() || !newThreatForm.category || !newThreatForm.description.trim()) {
      toast.error("Please fill in required fields");
      return;
    }

    createThreat.mutate({
      userId: user?.id || '',
      title: newThreatForm.title,
      description: newThreatForm.description,
      severity: newThreatForm.severity,
      category: newThreatForm.category as any,
      source: newThreatForm.source,
      status: "active"
    });
  };

  const filteredThreats = threats?.filter((threat: any) => {
    const matchesSearch = threat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         threat.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || threat.category === filterCategory;
    const matchesSeverity = filterSeverity === "all" || threat.severity === filterSeverity;
    
    return matchesSearch && matchesCategory && matchesSeverity;
  }) || [];

  const activeThreats = filteredThreats.filter((t: any) => t.status === 'active');
  const monitoringThreats = filteredThreats.filter((t: any) => t.status === 'monitoring');
  const resolvedThreats = filteredThreats.filter((t: any) => t.status === 'resolved');

  const getThreatIcon = (category: string) => {
    const categoryConfig = THREAT_CATEGORIES.find(cat => cat.value === category);
    const IconComponent = categoryConfig?.icon || AlertTriangle;
    return <IconComponent className="h-4 w-4" />;
  };

  const getSeverityConfig = (severity: string) => {
    return SEVERITY_LEVELS.find(s => s.value === severity) || SEVERITY_LEVELS[1];
  };

  const getStatusConfig = (status: string) => {
    return THREAT_STATUS.find(s => s.value === status) || THREAT_STATUS[0];
  };

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            National Security Command Center
          </DialogTitle>
          <DialogDescription>
            Monitor threats, assess security status, and manage emergency protocols for national security.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Security Dashboard</TabsTrigger>
            <TabsTrigger value="threats">Threat Management</TabsTrigger>
            <TabsTrigger value="protocols">Emergency Protocols</TabsTrigger>
            <TabsTrigger value="analytics">Security Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <div className="space-y-6">
              {dashboardLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/3" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                  </div>
                  <Skeleton className="h-64" />
                </div>
              ) : (
                <>
                  {/* Threat Level Overview */}
                  <GlassCard variant="security">
                    <div className="p-6 pb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-500" />
                        Current Threat Level
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">Real-time national security assessment</p>
                    </div>
                    <div className="p-6">
                      <div className="text-center">
                        <div className={`text-4xl font-bold mb-2 ${getThreatLevelColor(securityDashboard?.overallThreatLevel || 'low')}`}>
                          {(securityDashboard?.overallThreatLevel || 'low').toUpperCase()}
                        </div>
                        <div className="text-lg text-muted-foreground mb-4">
                          Overall Threat Level
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-red-600">
                              {securityDashboard?.activeThreats || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">Active Threats</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-red-800">
                              {securityDashboard?.criticalThreats || 0}
                            </div>
                            <div className="text-sm text-muted-foreground">Critical</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-yellow-600">
                              {monitoringThreats.length}
                            </div>
                            <div className="text-sm text-muted-foreground">Monitoring</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-600">
                              {resolvedThreats.length}
                            </div>
                            <div className="text-sm text-muted-foreground">Resolved</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Recent Threats */}
                  <GlassCard variant="security">
                    <div className="p-6 pb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Target className="h-5 w-5 text-orange-500" />
                        Recent Security Events
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">Latest reported threats and incidents</p>
                    </div>
                    <div className="p-6">
                      {securityDashboard?.recentThreats && securityDashboard.recentThreats.length > 0 ? (
                        <div className="space-y-3">
                          {securityDashboard.recentThreats.map((threat: any) => (
                            <div key={threat.id ? `threat-${threat.id}` : `threat-fallback-${Math.random()}`} className="p-3 border rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  {getThreatIcon(threat.category)}
                                  <h4 className="font-semibold">{threat.title}</h4>
                                </div>
                                <div className="flex gap-2">
                                  <Badge className={getSeverityConfig(threat.severity)?.bg ?? ""}>
                                    {getSeverityConfig(threat.severity)?.label ?? ""}
                                  </Badge>
                                  <Badge variant="outline" className={getStatusConfig(threat.status)?.bg ?? ""}>
                                    {getStatusConfig(threat.status)?.label ?? ""}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{threat.description}</p>
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>Category: {THREAT_CATEGORIES.find(c => c.value === threat.category)?.label}</span>
                                <span>Detected: {new Date(threat.detectedDate).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                          <p className="text-green-600">No recent security threats</p>
                          <p className="text-sm">Security status: All clear</p>
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  {/* Security Categories */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {THREAT_CATEGORIES.map((category) => {
                      const IconComponent = category.icon;
                      const categoryThreats = activeThreats.filter((t: any) => t.category === category.value);
                      return (
                        <GlassCard key={category.value} variant="security">
                          <div className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`p-2 rounded-lg ${category.bg}`}>
                                <IconComponent className={`h-5 w-5 ${category.color}`} />
                              </div>
                              <div>
                                <div className="font-semibold">{category.label}</div>
                                <div className="text-sm text-muted-foreground">
                                  {categoryThreats.length} active
                                </div>
                              </div>
                            </div>
                            <Progress 
                              value={categoryThreats.length > 0 ? Math.min(100, (categoryThreats.length / 5) * 100) : 0}
                              className="h-2"
                            />
                          </div>
                        </GlassCard>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="threats" className="mt-6">
            <div className="space-y-6">
              {/* Threat Management Header */}
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Threat Management</h3>
                  <p className="text-sm text-muted-foreground">Monitor and manage security threats</p>
                </div>
                <Button 
                  onClick={() => {
                    void refetchThreats();
                    void refetchDashboard();
                  }}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {/* Filters */}
              <GlassCard variant="security">
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="search">Search Threats</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="search"
                          placeholder="Search by title or description..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {THREAT_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Severity</Label>
                      <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Severities</SelectItem>
                          {SEVERITY_LEVELS.map((severity) => (
                            <SelectItem key={severity.value} value={severity.value}>
                              {severity.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Report Threat
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Report New Security Threat</DialogTitle>
                            <DialogDescription>
                              Document a new security threat or incident for assessment.
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleSubmitThreat} className="space-y-4">
                            <div>
                              <Label htmlFor="threatTitle">Threat Title *</Label>
                              <Input
                                id="threatTitle"
                                placeholder="e.g., Cyber attack on government systems"
                                value={newThreatForm.title}
                                onChange={(e) => setNewThreatForm(prev => ({ ...prev, title: e.target.value }))}
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Category *</Label>
                                <Select 
                                  value={newThreatForm.category} 
                                  onValueChange={(value) => setNewThreatForm(prev => ({ ...prev, category: value }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {THREAT_CATEGORIES.map((cat) => (
                                      <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Severity *</Label>
                                <Select 
                                  value={newThreatForm.severity} 
                                  onValueChange={(value) => setNewThreatForm(prev => ({ ...prev, severity: value as any }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SEVERITY_LEVELS.map((severity) => (
                                      <SelectItem key={severity.value} value={severity.value}>
                                        {severity.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="threatDescription">Description *</Label>
                              <Textarea
                                id="threatDescription"
                                placeholder="Detailed description of the threat, its scope, and potential impact..."
                                value={newThreatForm.description}
                                onChange={(e) => setNewThreatForm(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="threatSource">Source</Label>
                                <Input
                                  id="threatSource"
                                  placeholder="e.g., Intelligence report, citizen report"
                                  value={newThreatForm.source}
                                  onChange={(e) => setNewThreatForm(prev => ({ ...prev, source: e.target.value }))}
                                />
                              </div>
                              <div>
                                <Label htmlFor="threatLocation">Location</Label>
                                <Input
                                  id="threatLocation"
                                  placeholder="e.g., Capital city, border region"
                                  value={newThreatForm.location}
                                  onChange={(e) => setNewThreatForm(prev => ({ ...prev, location: e.target.value }))}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="submit" disabled={createThreat.isPending}>
                                {createThreat.isPending ? "Reporting..." : "Report Threat"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Threats List */}
              {threatsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : filteredThreats.length > 0 ? (
                <div className="space-y-3">
                  {filteredThreats.map((threat: any) => (
                    <GlassCard key={threat.id} variant="security" className="hover:shadow-md transition-shadow">
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            {getThreatIcon(threat.category)}
                            <div>
                              <h4 className="font-semibold">{threat.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {THREAT_CATEGORIES.find(c => c.value === threat.category)?.label}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getSeverityConfig(threat.severity)?.bg ?? ""}>
                              {getSeverityConfig(threat.severity)?.label ?? ""}
                            </Badge>
                            <Badge variant="outline" className={getStatusConfig(threat.status)?.bg ?? ""}>
                              {getStatusConfig(threat.status)?.label ?? ""}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm mb-3">{threat.description}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>Detected: {new Date(threat.detectedDate).toLocaleString()}</span>
                          {threat.source && <span>Source: {threat.source}</span>}
                          {threat.location && <span>Location: {threat.location}</span>}
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              ) : (
                <GlassCard variant="security">
                  <div className="p-8 text-center">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No threats found matching your criteria</p>
                    <p className="text-sm text-muted-foreground">Adjust your filters or report a new threat</p>
                  </div>
                </GlassCard>
              )}
            </div>
          </TabsContent>

          <TabsContent value="protocols" className="mt-6">
            <GlassCard variant="security">
              <div className="p-6 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Lock className="h-5 w-5 text-purple-500" />
                  Emergency Response Protocols
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Standard operating procedures for security incidents</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {THREAT_CATEGORIES.map((category) => {
                    const IconComponent = category.icon;
                    return (
                      <GlassCard key={category.value} variant="security">
                        <div className="p-4">
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${category.bg}`}>
                              <IconComponent className={`h-5 w-5 ${category.color}`} />
                            </div>
                            <h4 className="font-semibold">{category.label} Protocol</h4>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span>Immediate assessment and containment</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span>Notify relevant authorities</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span>Deploy response team</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span>Monitor and update status</span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="mt-4 w-full">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Full Protocol
                          </Button>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <GlassCard variant="security">
              <div className="p-6 pb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-500" />
                  Security Analytics
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Trends, patterns, and insights from security data</p>
              </div>
              <div className="p-6">
                <Alert>
                  <Eye className="h-4 w-4" />
                  <AlertDescription>
                    Advanced security analytics dashboard is being developed. This will include threat trend analysis, 
                    predictive modeling, and comprehensive reporting capabilities.
                  </AlertDescription>
                </Alert>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}