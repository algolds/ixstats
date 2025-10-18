"use client";

import React from 'react';
import {
  HelpCircle,
  Info,
  TrendingUp,
  DollarSign,
  Building2,
  Users,
  Shield,
  Target,
  AlertTriangle,
  CheckCircle,
  BookOpen,
  Calculator,
  BarChart3,
  PieChart,
  Settings,
  Crown,
  Coins,
  Globe,
  Zap,
  Heart,
  Scale,
  GraduationCap,
  Sparkles,
  Trees,
  Eye,
  Wifi
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';
import { HelpIcon } from '~/components/ui/help-icon';
import { cn } from '~/lib/utils';

interface HelpSystemProps {
  section: 'components' | 'structure' | 'spending' | 'preview';
  className?: string;
}

/**
 * Comprehensive Help System for MyGovernment Builder
 * 
 * Provides contextual help for each section of the government builder:
 * - Components: Atomic government components selection
 * - Structure: Government builder interface
 * - Spending: Budget allocation and policies
 * - Preview: Final review and validation
 */
export function GovernmentHelpSystem({ section, className }: HelpSystemProps) {
  const helpContent = getHelpContent(section);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <HelpCircle className="h-4 w-4" />
          Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {helpContent.icon}
            {helpContent.title}
          </DialogTitle>
          <DialogDescription>
            {helpContent.description}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 text-sm">
          {helpContent.sections.map((section, index) => (
            <div key={index}>
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                {section.icon}
                {section.title}
              </h3>
              <div className="space-y-3">
                {section.content}
              </div>
              {index < helpContent.sections.length - 1 && <Separator className="my-6" />}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Help content for Economics Section
 */
export function EconomicsHelpSystem({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <HelpCircle className="h-4 w-4" />
          Economics Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Economics Section Guide
          </DialogTitle>
          <DialogDescription>
            Complete guide to configuring your nation's economic system
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 text-sm">
          {/* Getting Started */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Getting Started
            </h3>
            <div className="space-y-3">
              <p className="text-muted-foreground">
                The Economics section allows you to configure your nation's complete economic profile. 
                This includes core indicators, labor markets, fiscal systems, and government spending.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Core Indicators
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Set GDP, population, growth rates, and inflation. These form the foundation of your economic model.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      Labor & Employment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Configure workforce distribution, unemployment rates, and labor protections.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <Separator />

          {/* Core Indicators Help */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              Core Economic Indicators
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    GDP & Growth
                  </h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Nominal GDP:</strong> Total economic output in current prices</li>
                    <li><strong>GDP per Capita:</strong> Economic output per person</li>
                    <li><strong>Real GDP Growth:</strong> Economic growth adjusted for inflation</li>
                    <li><strong>Inflation Rate:</strong> Price level changes over time</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    Population & Demographics
                  </h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Total Population:</strong> Number of citizens</li>
                    <li><strong>Population Growth:</strong> Annual population change rate</li>
                    <li><strong>Urbanization:</strong> Percentage living in cities</li>
                    <li><strong>Age Distribution:</strong> Population by age groups</li>
                  </ul>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Pro Tip: Use Real Country Data
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Start with real country data for more realistic simulations. You can import data from the IxWiki 
                      or use our built-in country templates to get started quickly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Labor & Employment Help */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Labor & Employment
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Employment Metrics</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Unemployment Rate:</strong> Percentage of workforce without jobs</li>
                    <li><strong>Labor Force Participation:</strong> Percentage of working-age population in workforce</li>
                    <li><strong>Average Wage:</strong> Typical worker compensation</li>
                    <li><strong>Working Hours:</strong> Average hours worked per week</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Labor Protections</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Minimum Wage:</strong> Legal minimum compensation</li>
                    <li><strong>Worker Rights:</strong> Labor protection laws</li>
                    <li><strong>Unionization:</strong> Percentage of workers in unions</li>
                    <li><strong>Benefits:</strong> Healthcare, retirement, etc.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Fiscal System Help */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-purple-600" />
              Fiscal System
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Government Revenue</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Tax Revenue:</strong> Income from taxation</li>
                    <li><strong>Non-Tax Revenue:</strong> Fees, licenses, state enterprises</li>
                    <li><strong>Debt-to-GDP Ratio:</strong> Government debt relative to economy</li>
                    <li><strong>Budget Surplus/Deficit:</strong> Revenue vs. spending</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Tax Structure</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Income Tax:</strong> Progressive or flat rate taxation</li>
                    <li><strong>Corporate Tax:</strong> Business taxation rates</li>
                    <li><strong>Sales Tax/VAT:</strong> Consumption taxation</li>
                    <li><strong>Property Tax:</strong> Real estate taxation</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Government Policies Help */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Settings className="h-5 w-5 text-amber-600" />
              Government Policies
            </h3>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Select policies that align with your government's atomic components and strategic priorities.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Policy Categories</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Budget Management:</strong> Performance-based, Zero-based budgeting</li>
                    <li><strong>Social Welfare:</strong> Healthcare, education, housing</li>
                    <li><strong>Technology:</strong> Digital government, R&D, innovation</li>
                    <li><strong>Environment:</strong> Green investment, carbon neutrality</li>
                    <li><strong>Economic:</strong> Progressive taxation, UBI, wealth tax</li>
                    <li><strong>Security:</strong> Cybersecurity, border security, disaster prep</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Policy Effects</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Synergies:</strong> Policies boost atomic component effects</li>
                    <li><strong>Conflicts:</strong> Misalignment reduces effectiveness</li>
                    <li><strong>Costs:</strong> Implementation and maintenance expenses</li>
                    <li><strong>Impact:</strong> Economic growth, stability, satisfaction</li>
                    <li><strong>Presets:</strong> Quick-start policy packages available</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tips & Best Practices */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Tips & Best Practices
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Realistic Values
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Use real-world data as reference points. GDP per capita typically ranges from $1,000 to $100,000+.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      Balanced Approach
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Balance different economic priorities. High spending in one area affects others.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Growth Focus
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Invest in education and infrastructure for long-term economic growth.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Debt Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Keep debt-to-GDP ratio reasonable (typically under 60% for developed nations).
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Help content for Government Policies section
 */
export function GovernmentSpendingHelpSystem({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <HelpCircle className="h-4 w-4" />
          Policies Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-amber-600" />
            Government Policies Guide
          </DialogTitle>
          <DialogDescription>
            Learn how to select and implement government policies that align with your atomic components
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 text-sm">
          {/* Overview */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600" />
              What are Government Policies?
            </h3>
            <p className="text-muted-foreground mb-3">
              Government policies are strategic initiatives that define how your government operates and delivers services.
              Each policy has unique effects on your nation's performance, economy, and citizen satisfaction.
            </p>
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Policy-Component Synergies
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Policies work best when they align with your selected atomic components. For example,
                    Participatory Budgeting synergizes with Democratic Process components, while Performance-Based
                    Budgeting works well with Technocratic Process components.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Policy Categories */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Policy Categories
            </h3>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Policies are organized into strategic categories based on their primary focus:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Budget Management
                  </h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Performance-Based Budgeting:</strong> Link spending to measurable outcomes</li>
                    <li><strong>Zero-Based Budgeting:</strong> Rebuild budget from zero each year</li>
                    <li><strong>Emergency Reserve Fund:</strong> Maintain crisis response funds</li>
                    <li><strong>Infrastructure Bank:</strong> Dedicated infrastructure investment</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-600" />
                    Social Welfare
                  </h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Universal Healthcare:</strong> Free healthcare for all citizens</li>
                    <li><strong>Free Education:</strong> Education from kindergarten to university</li>
                    <li><strong>Affordable Housing:</strong> Subsidized housing programs</li>
                    <li><strong>Mental Health Services:</strong> Free counseling and treatment</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-purple-600" />
                    Technology & Innovation
                  </h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Digital Government:</strong> Digitize all government services</li>
                    <li><strong>R&D Funding:</strong> Support scientific research and innovation</li>
                    <li><strong>Startup Incubators:</strong> Government-funded accelerators</li>
                    <li><strong>Smart City Initiative:</strong> Integrate technology into infrastructure</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Trees className="h-4 w-4 text-green-600" />
                    Environment
                  </h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li><strong>Green Investment Priority:</strong> Sustainable project focus</li>
                    <li><strong>Carbon Neutrality:</strong> Net-zero emissions target</li>
                    <li><strong>Renewable Energy:</strong> Transition to clean energy</li>
                    <li><strong>Biodiversity Protection:</strong> Protect natural habitats</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Policy Mechanics */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-purple-600" />
              Policy Mechanics
            </h3>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Each policy has specific costs and effects that influence your government's effectiveness:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Implementation Costs</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• <strong>Initial Cost:</strong> One-time setup and implementation expense</li>
                    <li>• <strong>Maintenance Cost:</strong> Ongoing operational expenses</li>
                    <li>• <strong>Policy Count Impact:</strong> More policies increase complexity</li>
                    <li>• <strong>Budget Allocation:</strong> Some policies require minimum spending levels</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Policy Effects</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• <strong>Economic Growth:</strong> Impact on GDP and development</li>
                    <li>• <strong>Stability:</strong> Effect on economic and social stability</li>
                    <li>• <strong>Citizen Satisfaction:</strong> Impact on public approval</li>
                    <li>• <strong>Efficiency Score:</strong> Government effectiveness rating</li>
                  </ul>
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Balancing Act
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      While more policies can enhance government capabilities, each policy adds complexity and cost.
                      Choose policies strategically based on your government's priorities and available resources.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Atomic Component Integration */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              Atomic Component Integration
            </h3>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Policies interact with your atomic components to create synergies or conflicts:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Synergies (Boost Effectiveness)
                  </h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• Democratic Process + Participatory Budgeting</li>
                    <li>• Technocratic Process + Performance-Based Budgeting</li>
                    <li>• Welfare State + Universal Healthcare</li>
                    <li>• Digital Government + Digital Infrastructure</li>
                    <li>• Environmental Protection + Green Investment</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Conflicts (Reduce Effectiveness)
                  </h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• Autocratic Process + Participatory Budgeting</li>
                    <li>• Free Market + Universal Basic Services</li>
                    <li>• Minimal State + Welfare Programs</li>
                    <li>• Isolationist + Foreign Aid Programs</li>
                    <li>• Centralized Power + Participatory Democracy</li>
                  </ul>
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Strategic Alignment
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      The system automatically calculates synergies and conflicts. Policies that align with your
                      atomic components receive effectiveness bonuses, while conflicting policies may have reduced impact.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Policy Presets */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Policy Presets
            </h3>
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Quick-start with curated policy packages designed for specific government strategies:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      Balanced
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Well-rounded mix of efficiency, social services, and infrastructure policies.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-600" />
                      Social Welfare
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Focus on healthcare, education, housing, and comprehensive social services.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Economic Growth
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Infrastructure investment, R&D, innovation, and development-focused policies.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      Innovation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Technology, research, digital government, and cutting-edge innovation policies.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tips & Best Practices */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Best Practices
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      Match Your Components
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Select policies that synergize with your atomic components for maximum effectiveness.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Scale className="h-4 w-4 text-blue-600" />
                      Balance Costs & Benefits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Consider both implementation and maintenance costs when selecting policies.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Crown className="h-4 w-4 text-purple-600" />
                      Strategic Priorities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Focus on 5-8 core policies rather than trying to implement everything at once.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4 text-green-600" />
                      Long-Term Thinking
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Some policies have delayed benefits but create significant long-term value.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Get help content for specific section
 */
function getHelpContent(section: string) {
  const helpContentMap = {
    components: {
      icon: <Settings className="h-6 w-6 text-blue-600" />,
      title: "Atomic Components Guide",
      description: "Learn about atomic government components and their effects",
      sections: [
        {
          icon: <Target className="h-5 w-5 text-blue-600" />,
          title: "What are Atomic Components?",
          content: (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Atomic components are fundamental building blocks that define your government's core characteristics. 
                Each component adds unique capabilities and influences your nation's calculations.
              </p>
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Component Synergies
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Some components work better together and create powerful synergies. 
                      Others may conflict and reduce effectiveness.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        },
        {
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          title: "Component Categories",
          content: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Government Structure</h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Democracy, Autocracy, Federalism</li>
                  <li>• Parliamentary, Presidential</li>
                  <li>• Unitary, Federal, Confederal</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Economic Systems</h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Free Market, Planned Economy</li>
                  <li>• Welfare State, Social Democracy</li>
                  <li>• Mixed Economy, State Capitalism</li>
                </ul>
              </div>
            </div>
          )
        }
      ]
    },
    structure: {
      icon: <Crown className="h-6 w-6 text-purple-600" />,
      title: "Government Builder Guide",
      description: "Build your complete government structure with departments and budget allocation",
      sections: [
        {
          icon: <Building2 className="h-5 w-5 text-purple-600" />,
          title: "Government Structure",
          content: (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Create departments and agencies that reflect your government's priorities and atomic components.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Department Types</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• Executive departments</li>
                    <li>• Regulatory agencies</li>
                    <li>• Public services</li>
                    <li>• Specialized agencies</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Budget Allocation</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• Set department budgets</li>
                    <li>• Define revenue sources</li>
                    <li>• Balance expenditures</li>
                    <li>• Monitor utilization</li>
                  </ul>
                </div>
              </div>
            </div>
          )
        }
      ]
    },
    spending: {
      icon: <Settings className="h-6 w-6 text-amber-600" />,
      title: "Government Policies Guide",
      description: "Select and implement policies that align with your atomic components",
      sections: [
        {
          icon: <Target className="h-5 w-5 text-amber-600" />,
          title: "Policy Selection",
          content: (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Choose policies that align with your government's atomic components and strategic goals.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Policy Categories</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• Budget Management</li>
                    <li>• Social Welfare</li>
                    <li>• Technology & Innovation</li>
                    <li>• Environmental Protection</li>
                    <li>• Economic Development</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Selection Tips</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• Match atomic components</li>
                    <li>• Consider synergies</li>
                    <li>• Balance costs</li>
                    <li>• Focus on priorities</li>
                  </ul>
                </div>
              </div>
            </div>
          )
        }
      ]
    },
    preview: {
      icon: <Eye className="h-6 w-6 text-green-600" />,
      title: "Preview & Validation Guide",
      description: "Review your government configuration before finalizing",
      sections: [
        {
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          title: "Validation Checklist",
          content: (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Review your government configuration to ensure it's complete and balanced.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Required Elements</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• At least 3 atomic components</li>
                    <li>• Complete government structure</li>
                    <li>• Balanced budget allocation</li>
                    <li>• Validated policies</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Quality Checks</h4>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    <li>• Component synergies</li>
                    <li>• Budget efficiency</li>
                    <li>• Policy compatibility</li>
                    <li>• Economic impact</li>
                  </ul>
                </div>
              </div>
            </div>
          )
        }
      ]
    }
  };

  return helpContentMap[section as keyof typeof helpContentMap] || helpContentMap.components;
}

/**
 * Inline help tooltip for specific fields
 */
export function FieldHelpTooltip({ 
  content, 
  title, 
  className 
}: { 
  content: React.ReactNode; 
  title?: string; 
  className?: string; 
}) {
  return (
    <HelpIcon
      content={content}
      title={title}
      className={className}
      side="top"
      variant="help"
    />
  );
}

/**
 * Section help tooltip for section headers
 */
export function SectionHelpTooltip({ 
  content, 
  title, 
  className 
}: { 
  content: React.ReactNode; 
  title?: string; 
  className?: string; 
}) {
  return (
    <HelpIcon
      content={content}
      title={title}
      className={className}
      side="top"
      variant="info"
    />
  );
}
