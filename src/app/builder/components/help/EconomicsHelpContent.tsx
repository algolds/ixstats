"use client";

import React from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Building2, 
  Calculator,
  BarChart3,
  PieChart,
  Target,
  AlertTriangle,
  CheckCircle,
  Info,
  Globe,
  Zap,
  Heart,
  Shield,
  Trees,
  GraduationCap,
  Factory,
  Ship,
  Activity,
  Gauge,
  Clock,
  Settings,
  Play,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { FieldHelpTooltip, SectionHelpTooltip } from './GovernmentHelpSystem';

/**
 * Comprehensive help content for Economics section
 * Provides detailed explanations for each economic indicator and configuration option
 */

// Core Indicators Help Content
export const CoreIndicatorsHelp = {
  title: "Core Economic Indicators",
  description: "Fundamental economic metrics that define your nation's economic profile",
  icon: <BarChart3 className="h-5 w-5 text-green-600" />,
  content: (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            GDP & Growth
          </h4>
          <ul className="space-y-2 text-muted-foreground text-xs">
            <li>
              <strong>Nominal GDP:</strong> Total economic output in current market prices. 
              This represents the total value of all goods and services produced in your nation.
            </li>
            <li>
              <strong>GDP per Capita:</strong> Economic output per person, calculated by dividing 
              total GDP by population. Higher values indicate greater individual prosperity.
            </li>
            <li>
              <strong>Real GDP Growth Rate:</strong> Economic growth adjusted for inflation. 
              Positive values indicate economic expansion, negative values indicate contraction.
            </li>
            <li>
              <strong>Inflation Rate:</strong> Annual percentage change in price levels. 
              Moderate inflation (2-3%) is generally healthy, while high inflation can destabilize economies.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            Population & Demographics
          </h4>
          <ul className="space-y-2 text-muted-foreground text-xs">
            <li>
              <strong>Total Population:</strong> Number of citizens in your nation. 
              Larger populations provide more labor and consumer markets but require more resources.
            </li>
            <li>
              <strong>Population Growth Rate:</strong> Annual percentage change in population. 
              Positive growth increases labor force but requires more infrastructure investment.
            </li>
            <li>
              <strong>Urbanization Rate:</strong> Percentage of population living in cities. 
              Higher urbanization typically correlates with higher productivity and GDP per capita.
            </li>
            <li>
              <strong>Age Distribution:</strong> Population breakdown by age groups. 
              Younger populations provide more labor, older populations require more healthcare spending.
            </li>
          </ul>
        </div>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Real-World Reference Points
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              GDP per capita ranges from ~$1,000 (developing nations) to $100,000+ (developed nations). 
              Growth rates typically range from -5% to +10% annually. Use real country data as reference points.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
};

// Labor & Employment Help Content
export const LaborEmploymentHelp = {
  title: "Labor & Employment",
  description: "Workforce characteristics and labor market conditions",
  icon: <Users className="h-5 w-5 text-blue-600" />,
  content: (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">Employment Metrics</h4>
          <ul className="space-y-2 text-muted-foreground text-xs">
            <li>
              <strong>Unemployment Rate:</strong> Percentage of labor force without jobs. 
              Healthy rates are typically 3-7% for developed nations, 5-15% for developing nations.
            </li>
            <li>
              <strong>Labor Force Participation:</strong> Percentage of working-age population in the workforce. 
              Higher participation increases economic output but may affect work-life balance.
            </li>
            <li>
              <strong>Average Wage:</strong> Typical worker compensation. Higher wages increase consumer spending 
              but may reduce business competitiveness.
            </li>
            <li>
              <strong>Working Hours:</strong> Average hours worked per week. Longer hours increase productivity 
              but may affect worker well-being and family life.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-2">Labor Protections</h4>
          <ul className="space-y-2 text-muted-foreground text-xs">
            <li>
              <strong>Minimum Wage:</strong> Legal minimum compensation. Higher minimum wages reduce poverty 
              but may increase unemployment among low-skilled workers.
            </li>
            <li>
              <strong>Worker Rights:</strong> Labor protection laws including safety regulations, 
              anti-discrimination laws, and collective bargaining rights.
            </li>
            <li>
              <strong>Unionization Rate:</strong> Percentage of workers in labor unions. Higher unionization 
              typically leads to better wages and working conditions but may reduce labor market flexibility.
            </li>
            <li>
              <strong>Benefits:</strong> Healthcare, retirement, vacation, and other worker benefits. 
              Comprehensive benefits improve worker satisfaction but increase business costs.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
};

// Fiscal System Help Content
export const FiscalSystemHelp = {
  title: "Fiscal System",
  description: "Government revenue, taxation, and budget management",
  icon: <Calculator className="h-5 w-5 text-purple-600" />,
  content: (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">Government Revenue</h4>
          <ul className="space-y-2 text-muted-foreground text-xs">
            <li>
              <strong>Tax Revenue:</strong> Income from various forms of taxation. 
              Higher tax rates increase revenue but may reduce economic incentives.
            </li>
            <li>
              <strong>Non-Tax Revenue:</strong> Income from fees, licenses, state enterprises, 
              and natural resources. Diversified revenue sources provide stability.
            </li>
            <li>
              <strong>Debt-to-GDP Ratio:</strong> Government debt relative to economic output. 
              Ratios above 60% may indicate fiscal stress, while ratios below 30% indicate fiscal health.
            </li>
            <li>
              <strong>Budget Surplus/Deficit:</strong> Difference between revenue and spending. 
              Surpluses allow debt reduction, deficits require borrowing or tax increases.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-2">Tax Structure</h4>
          <ul className="space-y-2 text-muted-foreground text-xs">
            <li>
              <strong>Income Tax:</strong> Progressive or flat rate taxation on personal income. 
              Progressive rates reduce inequality but may discourage high earners.
            </li>
            <li>
              <strong>Corporate Tax:</strong> Taxation on business profits. Lower rates may attract 
              investment but reduce government revenue.
            </li>
            <li>
              <strong>Sales Tax/VAT:</strong> Consumption taxation on goods and services. 
              Regressive impact on lower-income households but broad revenue base.
            </li>
            <li>
              <strong>Property Tax:</strong> Taxation on real estate and assets. 
              Stable revenue source but may affect property ownership costs.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
};

// Government Spending Help Content
export const GovernmentSpendingHelp = {
  title: "Government Spending",
  description: "Budget allocation across government sectors and programs",
  icon: <PieChart className="h-5 w-5 text-amber-600" />,
  content: (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">Spending Categories</h4>
          <ul className="space-y-2 text-muted-foreground text-xs">
            <li>
              <strong>Healthcare:</strong> Medical services, public health programs, and medical research. 
              Essential for citizen well-being and economic productivity.
            </li>
            <li>
              <strong>Education:</strong> Schools, universities, vocational training, and research. 
              Investment in human capital drives long-term economic growth.
            </li>
            <li>
              <strong>Defense:</strong> Military, national security, and intelligence services. 
              Necessary for national security but competes with social spending.
            </li>
            <li>
              <strong>Infrastructure:</strong> Transportation, utilities, communications, and technology. 
              Critical for economic competitiveness and quality of life.
            </li>
            <li>
              <strong>Social Services:</strong> Welfare, pensions, unemployment benefits, and housing. 
              Reduces inequality and provides social safety nets.
            </li>
            <li>
              <strong>Environment:</strong> Environmental protection, climate action, and sustainability. 
              Essential for long-term environmental and economic health.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-2">Allocation Strategies</h4>
          <ul className="space-y-2 text-muted-foreground text-xs">
            <li>
              <strong>Growth Focus:</strong> Prioritize education and infrastructure for long-term development.
            </li>
            <li>
              <strong>Welfare Focus:</strong> Emphasize healthcare and social services for citizen well-being.
            </li>
            <li>
              <strong>Security Focus:</strong> Maintain strong defense spending for national security.
            </li>
            <li>
              <strong>Green Focus:</strong> Prioritize environmental protection and sustainability.
            </li>
            <li>
              <strong>Balanced Approach:</strong> Distribute spending across all sectors for comprehensive development.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
};

// Economic Sectors Help Content
export const EconomicSectorsHelp = {
  title: "Economic Sectors",
  description: "Primary, secondary, and tertiary economic activities",
  icon: <Factory className="h-5 w-5 text-orange-600" />,
  content: (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Trees className="h-4 w-4 text-green-600" />
            Primary Sector
          </h4>
          <ul className="space-y-1 text-muted-foreground text-xs">
            <li>• Agriculture & farming</li>
            <li>• Mining & extraction</li>
            <li>• Fishing & forestry</li>
            <li>• Energy production</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Foundation of the economy, provides raw materials and food security.
          </p>
        </div>
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Factory className="h-4 w-4 text-blue-600" />
            Secondary Sector
          </h4>
          <ul className="space-y-1 text-muted-foreground text-xs">
            <li>• Manufacturing</li>
            <li>• Construction</li>
            <li>• Processing</li>
            <li>• Assembly</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Transforms raw materials into finished goods, drives industrialization.
          </p>
        </div>
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-600" />
            Tertiary Sector
          </h4>
          <ul className="space-y-1 text-muted-foreground text-xs">
            <li>• Services & retail</li>
            <li>• Finance & banking</li>
            <li>• Technology & IT</li>
            <li>• Tourism & hospitality</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Provides services and supports other sectors, typically largest in developed nations.
          </p>
        </div>
      </div>
    </div>
  )
};

// Economic Health Metrics Help Content
export const EconomicHealthHelp = {
  title: "Economic Health Metrics",
  description: "Key indicators of economic performance and sustainability",
  icon: <Activity className="h-5 w-5 text-green-600" />,
  content: (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">Performance Indicators</h4>
          <ul className="space-y-2 text-muted-foreground text-xs">
            <li>
              <strong>Economic Health Score:</strong> Overall economic performance rating (0-100). 
              Combines growth, stability, and sustainability metrics.
            </li>
            <li>
              <strong>GDP Growth Rate:</strong> Annual economic expansion rate. 
              Sustainable growth is typically 2-4% annually for developed nations.
            </li>
            <li>
              <strong>Inflation Rate:</strong> Price stability indicator. 
              Target range is typically 2-3% for developed nations.
            </li>
            <li>
              <strong>Unemployment Rate:</strong> Labor market health indicator. 
              Natural unemployment rate is typically 3-7%.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-2">Sustainability Metrics</h4>
          <ul className="space-y-2 text-muted-foreground text-xs">
            <li>
              <strong>Debt-to-GDP Ratio:</strong> Fiscal sustainability indicator. 
              Sustainable levels are typically below 60% for developed nations.
            </li>
            <li>
              <strong>Gini Coefficient:</strong> Income inequality measure (0-1). 
              Lower values indicate more equal income distribution.
            </li>
            <li>
              <strong>Human Development Index:</strong> Quality of life indicator. 
              Combines income, education, and health metrics.
            </li>
            <li>
              <strong>Environmental Score:</strong> Sustainability and environmental protection rating.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
};

// Tips and Best Practices
export const EconomicsTipsHelp = {
  title: "Tips & Best Practices",
  description: "Guidelines for creating realistic and effective economic configurations",
  icon: <Sparkles className="h-5 w-5 text-purple-600" />,
  content: (
    <div className="space-y-4">
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
              Growth rates usually fall between -5% and +10% annually.
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
              Consider both short-term needs and long-term goals.
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
              These investments typically yield the highest returns over time.
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
              High debt levels can constrain future economic policy options.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
};

// Export all help content for easy access
export const EconomicsHelpContent = {
  coreIndicators: CoreIndicatorsHelp,
  laborEmployment: LaborEmploymentHelp,
  fiscalSystem: FiscalSystemHelp,
  governmentSpending: GovernmentSpendingHelp,
  economicSectors: EconomicSectorsHelp,
  economicHealth: EconomicHealthHelp,
  tips: EconomicsTipsHelp
};
