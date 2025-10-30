"use client";

import React from "react";
import {
  HelpCircle,
  Info,
  TrendingUp,
  DollarSign,
  Factory,
  Users,
  Target,
  AlertTriangle,
  CheckCircle,
  Calculator,
  BarChart3,
  PieChart,
  Settings,
  Coins,
  Globe,
  Zap,
  Heart,
  Leaf,
  Brain,
  Wrench,
  Briefcase,
  GraduationCap,
  Sparkles,
  Lightbulb,
  Shield,
  Lock,
  Unlock,
  AlertCircle,
  XCircle,
  Clock,
  Building2,
  TrendingDown,
  ArrowUpDown,
  Gauge,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

interface HelpSystemProps {
  className?: string;
}

/**
 * Comprehensive Help System for Atomic Economic Components
 *
 * Provides detailed guidance on:
 * - Gameplay mechanics and how components affect the economy
 * - Implementation costs, maintenance costs, and capacity requirements
 * - Time to implement, staff requirements, and technology prerequisites
 * - Economic impact including tax efficiency, revenue, GDP growth, employment, and sectors
 * - Component synergies and conflicts
 * - Cost-effective combinations and over-selection warnings
 */
export function EconomicComponentsHelpSystem({ className }: HelpSystemProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <HelpCircle className="h-4 w-4" />
          Components Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-blue-600" />
            Atomic Economic Components Guide
          </DialogTitle>
          <DialogDescription>
            Complete guide to economic components: gameplay mechanics, costs, and strategic
            combinations
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 text-sm">
          {/* Overview Section */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Target className="h-5 w-5 text-blue-600" />
              What are Atomic Economic Components?
            </h3>
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Atomic economic components are fundamental building blocks that define your nation's
                economic structure. Each component has specific costs, requirements, and impacts on
                GDP, employment, tax efficiency, and various economic sectors.
              </p>
              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Strategic Selection Matters
                    </p>
                    <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                      Components work together to create powerful synergies or harmful conflicts.
                      Selecting too many components increases costs dramatically, while selecting
                      complementary components maximizes effectiveness.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Gameplay Mechanics Section */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Gauge className="h-5 w-5 text-green-600" />
              Gameplay Mechanics
            </h3>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Each component affects your economy through multiple interconnected systems:
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      GDP & Growth Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>• Components boost specific economic sectors</li>
                      <li>• Sector impacts range from 0.3x to 2.8x multipliers</li>
                      <li>• Technology-focused components have highest GDP growth</li>
                      <li>• Traditional sectors grow slower but cost less</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-blue-600" />
                      Employment Effects
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>• Unemployment modifier: -2.5% to +1.5%</li>
                      <li>• Labor participation: 0.8x to 1.5x multiplier</li>
                      <li>• Wage growth: 0.7x to 1.8x multiplier</li>
                      <li>• Innovation economies reduce unemployment most</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Calculator className="h-4 w-4 text-purple-600" />
                      Tax Efficiency
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>• Optimal corporate tax: 15% to 35%</li>
                      <li>• Optimal income tax: 22% to 40%</li>
                      <li>• Revenue efficiency: 65% to 92%</li>
                      <li>• Free markets have highest tax efficiency</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <BarChart3 className="h-4 w-4 text-amber-600" />
                      Sector Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>• Components prioritize different sectors</li>
                      <li>• Technology: Up to 2.5x multiplier</li>
                      <li>• Finance: Up to 2.8x multiplier</li>
                      <li>• Choose components matching your sector focus</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <Separator />

          {/* Costs & Resources Section */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Coins className="h-5 w-5 text-amber-600" />
              Costs & Resources
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Implementation Cost
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground mb-2 text-xs">
                      One-time cost to implement the component:
                    </p>
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>• Low: $40,000 - $80,000</li>
                      <li>• Medium: $100,000 - $150,000</li>
                      <li>• High: $180,000 - $300,000</li>
                    </ul>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Paid Once
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Coins className="h-4 w-4 text-amber-600" />
                      Maintenance Cost
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground mb-2 text-xs">
                      Annual cost to maintain the component:
                    </p>
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>• Low: $20,000 - $45,000</li>
                      <li>• Medium: $55,000 - $80,000</li>
                      <li>• High: $90,000 - $150,000</li>
                    </ul>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Annual
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Gauge className="h-4 w-4 text-blue-600" />
                      Required Capacity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground mb-2 text-xs">
                      Government capacity required:
                    </p>
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>• Low: 50-65 capacity points</li>
                      <li>• Medium: 70-85 capacity points</li>
                      <li>• High: 88-98 capacity points</li>
                    </ul>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Fixed
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Over-Selection Warning
                    </p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Selecting too many components dramatically increases total costs. Each
                      additional component adds both implementation and maintenance costs. Focus on
                      3-6 complementary components for cost-effectiveness.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Time & Prerequisites Section */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Clock className="h-5 w-5 text-indigo-600" />
              Time & Prerequisites
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-indigo-600" />
                      Implementation Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>
                        • <strong>Low Complexity:</strong> 1-2 years
                      </li>
                      <li>
                        • <strong>Medium Complexity:</strong> 2-3 years
                      </li>
                      <li>
                        • <strong>High Complexity:</strong> 4-5 years
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-blue-600" />
                      Staff Requirements
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>• Small: 120 staff members</li>
                      <li>• Medium: 150-180 staff</li>
                      <li>• Large: 200-300 staff</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 text-cyan-600" />
                      Technology Required
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      <li>• Most components require technology</li>
                      <li>• Traditional systems may not</li>
                      <li>• Advanced tech = higher costs</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <Separator />

          {/* Component Examples Section */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Building2 className="h-5 w-5 text-purple-600" />
              Component Examples
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Free Market System
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <p className="text-muted-foreground text-xs">
                      Market-driven resource allocation with minimal intervention
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Implementation:</span>
                        <span className="font-medium">$50,000</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Maintenance:</span>
                        <span className="font-medium">$25,000/year</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span className="font-medium">60 points</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Time:</span>
                        <span className="font-medium">2-3 years</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tax Efficiency:</span>
                        <span className="font-medium text-green-600">85%</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Medium Complexity
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Lightbulb className="h-4 w-4 text-amber-600" />
                      Innovation Economy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <p className="text-muted-foreground text-xs">
                      Continuous innovation and technological advancement
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Implementation:</span>
                        <span className="font-medium">$250,000</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Maintenance:</span>
                        <span className="font-medium">$125,000/year</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span className="font-medium">98 points</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Time:</span>
                        <span className="font-medium">2-3 years</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tax Efficiency:</span>
                        <span className="font-medium text-green-600">90%</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Medium Complexity
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Factory className="h-4 w-4 text-indigo-600" />
                      Manufacturing Led
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <p className="text-muted-foreground text-xs">
                      Industrial production and manufacturing focus
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Implementation:</span>
                        <span className="font-medium">$100,000</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Maintenance:</span>
                        <span className="font-medium">$55,000/year</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span className="font-medium">75 points</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Time:</span>
                        <span className="font-medium">4-5 years</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tax Efficiency:</span>
                        <span className="font-medium text-green-600">75%</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      High Complexity
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Leaf className="h-4 w-4 text-green-600" />
                      Sustainable Development
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <p className="text-muted-foreground text-xs">
                      Development without compromising future generations
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Implementation:</span>
                        <span className="font-medium">$140,000</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Maintenance:</span>
                        <span className="font-medium">$70,000/year</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span className="font-medium">82 points</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Time:</span>
                        <span className="font-medium">1-2 years</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tax Efficiency:</span>
                        <span className="font-medium text-green-600">83%</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Low Complexity
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <Separator />

          {/* Synergies & Conflicts Section */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Synergies & Conflicts
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="border-green-200 dark:border-green-900">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Powerful Synergies
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium">Innovation Cluster</p>
                        <p className="text-muted-foreground text-xs">
                          Innovation Economy + R&D Investment + Startup Ecosystem
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 border-green-600 text-xs text-green-600"
                        >
                          +15% Effectiveness
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs font-medium">Free Market Package</p>
                        <p className="text-muted-foreground text-xs">
                          Free Market System + Free Trade + Flexible Labor
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 border-green-600 text-xs text-green-600"
                        >
                          +15% Effectiveness
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs font-medium">Green Economy</p>
                        <p className="text-muted-foreground text-xs">
                          Sustainable Development + Renewable Energy + Circular Economy
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 border-green-600 text-xs text-green-600"
                        >
                          +15% Effectiveness
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs font-medium">Knowledge Hub</p>
                        <p className="text-muted-foreground text-xs">
                          Knowledge Economy + Education First + University Partnerships
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 border-green-600 text-xs text-green-600"
                        >
                          +15% Effectiveness
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200 dark:border-red-900">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Major Conflicts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium">Free Market vs Planned Economy</p>
                        <p className="text-muted-foreground text-xs">
                          Incompatible economic philosophies
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 border-red-600 text-xs text-red-600"
                        >
                          -15% Effectiveness
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs font-medium">Innovation vs Resource Extraction</p>
                        <p className="text-muted-foreground text-xs">
                          Different development paths clash
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 border-red-600 text-xs text-red-600"
                        >
                          -15% Effectiveness
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs font-medium">Flexible Labor vs Protected Workers</p>
                        <p className="text-muted-foreground text-xs">
                          Opposing labor market philosophies
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 border-red-600 text-xs text-red-600"
                        >
                          -15% Effectiveness
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs font-medium">Free Trade vs Protectionist</p>
                        <p className="text-muted-foreground text-xs">
                          Contradictory trade policies
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 border-red-600 text-xs text-red-600"
                        >
                          -15% Effectiveness
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-950/20">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                      Cross-Builder Synergies
                    </p>
                    <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">
                      Economic components can synergize with government and tax system components.
                      For example, Free Market System works well with Minimal Government and Low Tax
                      Rate policies, while Social Market Economy pairs well with Progressive
                      Taxation and Social Safety Nets.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Cost-Effective Combinations Section */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Target className="h-5 w-5 text-blue-600" />
              Cost-Effective Combinations
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Coins className="h-4 w-4 text-amber-600" />
                      Budget-Friendly Starter
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-muted-foreground mb-2 space-y-1 text-xs">
                      <li>• Free Market System</li>
                      <li>• Service Based</li>
                      <li>• Flexible Labor</li>
                    </ul>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Total Implementation:</span>
                        <span className="font-medium">$210,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Annual Maintenance:</span>
                        <span className="font-medium">$110,000</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Developing Nations
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Brain className="h-4 w-4 text-cyan-600" />
                      Innovation Powerhouse
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-muted-foreground mb-2 space-y-1 text-xs">
                      <li>• Innovation Economy</li>
                      <li>• Technology Focused</li>
                      <li>• R&D Investment</li>
                      <li>• Startup Ecosystem</li>
                    </ul>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Total Implementation:</span>
                        <span className="font-medium">$980,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Annual Maintenance:</span>
                        <span className="font-medium">$490,000</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Advanced Economies
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Leaf className="h-4 w-4 text-green-600" />
                      Sustainable Growth
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-muted-foreground mb-2 space-y-1 text-xs">
                      <li>• Mixed Economy</li>
                      <li>• Sustainable Development</li>
                      <li>• Renewable Energy</li>
                      <li>• Circular Economy</li>
                    </ul>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Total Implementation:</span>
                        <span className="font-medium">$545,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Annual Maintenance:</span>
                        <span className="font-medium">$275,000</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Environmental Focus
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Heart className="h-4 w-4 text-red-600" />
                      Social Welfare Model
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-muted-foreground mb-2 space-y-1 text-xs">
                      <li>• Social Market Economy</li>
                      <li>• Protected Workers</li>
                      <li>• Education First</li>
                    </ul>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Total Implementation:</span>
                        <span className="font-medium">$400,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Annual Maintenance:</span>
                        <span className="font-medium">$215,000</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Social Democracies
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tips & Best Practices Section */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Tips & Best Practices
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Start Small, Scale Smart
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground text-xs">
                      Begin with 3-4 complementary components that match your nation's development
                      stage. Add more components as your economy grows and can support higher costs.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-blue-600" />
                      Match Your Vision
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground text-xs">
                      Choose components that align with your national priorities. A tech-focused
                      nation needs different components than an agricultural or resource-based
                      economy.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Calculator className="h-4 w-4 text-purple-600" />
                      Calculate Total Costs
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground text-xs">
                      Consider both implementation and ongoing maintenance costs. Annual maintenance
                      costs accumulate over time and can strain your budget if you select too many
                      components.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      Leverage Synergies
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground text-xs">
                      Look for components with synergies. Three components with mutual synergies
                      provide +15% effectiveness bonus, making them much more powerful together.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Avoid Conflicts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground text-xs">
                      Don't select conflicting components. They reduce effectiveness by -15% each
                      and waste resources. Free Market and Planned Economy cannot coexist
                      effectively.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-indigo-600" />
                      Consider Cross-Builder Effects
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground text-xs">
                      Economic components interact with your government and tax systems. Ensure your
                      economic model aligns with your government structure and tax policies.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <Separator />

          {/* Warning Section */}
          <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                  Exceeding Capacity Limits
                </p>
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  Each component requires government capacity. If your total required capacity
                  exceeds your government's capacity, components will operate at reduced
                  effectiveness. Build government capacity first, then add economic components to
                  match your capacity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
