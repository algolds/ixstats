"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  LineChart,
  Wallet,
  Coins,
  CreditCard,
  Building,
  Factory,
  Store,
  Globe,
  Package,
  Truck,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

// ============================================
// ATOMIC ECONOMIC INDICATOR
// ============================================

interface AtomicEconomicIndicatorProps {
  type: 'gdp' | 'inflation' | 'unemployment' | 'trade' | 'debt' | 'growth';
  value: number;
  previousValue?: number;
  unit?: string;
  label?: string;
  showTrend?: boolean;
  thresholds?: {
    good: number;
    warning: number;
    critical: number;
  };
  className?: string;
}

export const AtomicEconomicIndicator: React.FC<AtomicEconomicIndicatorProps> = ({
  type,
  value,
  previousValue,
  unit = '%',
  label,
  showTrend = true,
  thresholds,
  className
}) => {
  const indicatorConfig = {
    gdp: { icon: DollarSign, label: 'GDP Growth', color: 'text-green-500' },
    inflation: { icon: TrendingUp, label: 'Inflation Rate', color: 'text-orange-500' },
    unemployment: { icon: Building, label: 'Unemployment', color: 'text-red-500' },
    trade: { icon: Globe, label: 'Trade Balance', color: 'text-blue-500' },
    debt: { icon: CreditCard, label: 'Debt to GDP', color: 'text-purple-500' },
    growth: { icon: BarChart3, label: 'Growth Rate', color: 'text-emerald-500' }
  };

  const config = indicatorConfig[type];
  const Icon = config.icon;

  const trend = previousValue !== undefined
    ? value > previousValue ? 'up' : value < previousValue ? 'down' : 'stable'
    : 'stable';

  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : null;

  const getStatus = () => {
    if (!thresholds) return 'neutral';
    if (type === 'unemployment' || type === 'inflation' || type === 'debt') {
      // Lower is better
      if (value <= thresholds.good) return 'success';
      if (value <= thresholds.warning) return 'warning';
      return 'error';
    } else {
      // Higher is better
      if (value >= thresholds.good) return 'success';
      if (value >= thresholds.warning) return 'warning';
      return 'error';
    }
  };

  const status = getStatus();
  const statusColors = {
    success: 'bg-green-500/20 text-green-500',
    warning: 'bg-yellow-500/20 text-yellow-500',
    error: 'bg-red-500/20 text-red-500',
    neutral: 'bg-gray-500/20 text-gray-500'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        "glass-hierarchy-interactive rounded-lg p-4 border border-border/50",
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-lg", statusColors[status])}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {label || config.label}
          </span>
        </div>
        {showTrend && TrendIcon && (
          <TrendIcon className={cn(
            "h-5 w-5",
            trend === 'up' && (type === 'gdp' || type === 'growth') ? 'text-green-500' :
            trend === 'down' && (type === 'unemployment' || type === 'inflation') ? 'text-green-500' :
            'text-red-500'
          )} />
        )}
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold">{value.toFixed(2)}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>

      {previousValue !== undefined && (
        <div className="mt-2 text-xs text-muted-foreground">
          Previous: {previousValue.toFixed(2)}{unit}
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// ATOMIC SECTOR BREAKDOWN
// ============================================

interface SectorData {
  name: string;
  value: number;
  growth: number;
  employment: number;
}

interface AtomicSectorBreakdownProps {
  sectors: SectorData[];
  totalGDP: number;
  className?: string;
}

export const AtomicSectorBreakdown: React.FC<AtomicSectorBreakdownProps> = ({
  sectors,
  totalGDP,
  className
}) => {
  const sectorIcons = {
    'Agriculture': Factory,
    'Manufacturing': Factory,
    'Services': Store,
    'Technology': Globe,
    'Finance': CreditCard,
    'Construction': Building,
    'Transport': Truck,
    'Energy': TrendingUp
  };

  const sortedSectors = useMemo(() => {
    return [...sectors].sort((a, b) => b.value - a.value);
  }, [sectors]);

  return (
    <div className={cn("glass-hierarchy-child rounded-lg p-4 space-y-3", className)}>
      <h3 className="font-semibold flex items-center gap-2">
        <PieChart className="h-5 w-5 text-primary" />
        Economic Sectors
      </h3>

      <div className="space-y-2">
        {sortedSectors.map((sector, index) => {
          const Icon = sectorIcons[sector.name as keyof typeof sectorIcons] || Package;
          const percentage = (sector.value / totalGDP) * 100;

          return (
            <motion.div
              key={sector.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-hierarchy-interactive rounded-md p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{sector.name}</span>
                </div>
                <span className="text-sm font-bold">{percentage.toFixed(1)}%</span>
              </div>

              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500"
                />
              </div>

              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Growth: {sector.growth > 0 ? '+' : ''}{sector.growth.toFixed(1)}%</span>
                <span>Employment: {sector.employment.toLocaleString()}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// ATOMIC TAX COMPONENT
// ============================================

interface TaxComponentData {
  name: string;
  rate: number;
  revenue: number;
  efficiency: number;
  isActive: boolean;
}

interface AtomicTaxComponentProps {
  component: TaxComponentData;
  onToggle?: () => void;
  onAdjustRate?: (newRate: number) => void;
  className?: string;
}

export const AtomicTaxComponent: React.FC<AtomicTaxComponentProps> = ({
  component,
  onToggle,
  onAdjustRate,
  className
}) => {
  const taxIcons = {
    'Income Tax': Wallet,
    'Corporate Tax': Building,
    'Sales Tax': Store,
    'Property Tax': Building,
    'Capital Gains': TrendingUp,
    'Import Duties': Globe,
    'Export Duties': Package
  };

  const Icon = taxIcons[component.name as keyof typeof taxIcons] || Percent;

  const getEfficiencyColor = () => {
    if (component.efficiency >= 80) return 'text-green-500';
    if (component.efficiency >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "glass-hierarchy-interactive rounded-lg p-4",
        component.isActive ? 'border-primary' : 'opacity-75',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-2 rounded-lg",
            component.isActive ? 'bg-primary/20 text-primary' : 'bg-muted'
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-medium">{component.name}</h4>
            <p className="text-xs text-muted-foreground">
              Revenue: ₡{component.revenue.toLocaleString()}
            </p>
          </div>
        </div>

        {onToggle && (
          <button
            onClick={onToggle}
            className={cn(
              "px-2 py-1 rounded text-xs font-medium transition-colors",
              component.isActive
                ? 'bg-primary/20 text-primary'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            {component.isActive ? 'Active' : 'Inactive'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Rate</span>
          <span className="font-medium">{component.rate}%</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Efficiency</span>
          <span className={cn("font-medium", getEfficiencyColor())}>
            {component.efficiency}%
          </span>
        </div>
      </div>

      {onAdjustRate && component.isActive && (
        <div className="mt-3">
          <input
            type="range"
            min="0"
            max="50"
            value={component.rate}
            onChange={(e) => onAdjustRate(Number(e.target.value))}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          />
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// ATOMIC BUDGET ALLOCATOR
// ============================================

interface BudgetCategory {
  name: string;
  allocation: number;
  spent: number;
  priority: 'high' | 'medium' | 'low';
  efficiency: number;
}

interface AtomicBudgetAllocatorProps {
  categories: BudgetCategory[];
  totalBudget: number;
  onAdjust?: (category: string, newAllocation: number) => void;
  className?: string;
}

export const AtomicBudgetAllocator: React.FC<AtomicBudgetAllocatorProps> = ({
  categories,
  totalBudget,
  onAdjust,
  className
}) => {
  const categoryIcons = {
    'Defense': Building,
    'Education': Building,
    'Healthcare': Building,
    'Infrastructure': Building,
    'Social Services': Building,
    'Research': LineChart
  };

  const priorityColors = {
    high: 'border-red-500',
    medium: 'border-yellow-500',
    low: 'border-green-500'
  };

  return (
    <div className={cn("glass-hierarchy-child rounded-lg p-4 space-y-3", className)}>
      <h3 className="font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Budget Allocation
      </h3>

      <div className="space-y-3">
        {categories.map((category, index) => {
          const Icon = categoryIcons[category.name as keyof typeof categoryIcons] || Coins;
          const percentage = (category.allocation / totalBudget) * 100;
          const utilization = (category.spent / category.allocation) * 100;

          return (
            <motion.div
              key={category.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "glass-hierarchy-interactive rounded-md p-3 border-l-2",
                priorityColors[category.priority]
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{category.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{percentage.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">
                    ₡{(category.allocation / 1000000).toFixed(1)}M
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-primary"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className="relative h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "absolute top-0 left-0 h-full",
                      utilization > 100 ? 'bg-red-500' :
                      utilization > 80 ? 'bg-yellow-500' :
                      'bg-green-500'
                    )}
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Utilization: {utilization.toFixed(0)}%</span>
                <span>Efficiency: {category.efficiency}%</span>
              </div>

              {onAdjust && (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={(e) => onAdjust(category.name, (Number(e.target.value) / 100) * totalBudget)}
                  className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer mt-2"
                />
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-border/50">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Budget</span>
          <span className="font-bold">₡{(totalBudget / 1000000).toFixed(1)}M</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted-foreground">Allocated</span>
          <span className={cn(
            "font-medium",
            categories.reduce((sum, c) => sum + c.allocation, 0) > totalBudget
              ? 'text-red-500'
              : 'text-green-500'
          )}>
            {((categories.reduce((sum, c) => sum + c.allocation, 0) / totalBudget) * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ATOMIC TRADE FLOW
// ============================================

interface TradePartner {
  name: string;
  exports: number;
  imports: number;
  balance: number;
}

interface AtomicTradeFlowProps {
  partners: TradePartner[];
  className?: string;
}

export const AtomicTradeFlow: React.FC<AtomicTradeFlowProps> = ({
  partners,
  className
}) => {
  const sortedPartners = useMemo(() => {
    return [...partners].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [partners]);

  const totalExports = partners.reduce((sum, p) => sum + p.exports, 0);
  const totalImports = partners.reduce((sum, p) => sum + p.imports, 0);
  const tradeBalance = totalExports - totalImports;

  return (
    <div className={cn("glass-hierarchy-child rounded-lg p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Trade Flow
        </h3>
        <div className={cn(
          "text-sm font-medium",
          tradeBalance >= 0 ? 'text-green-500' : 'text-red-500'
        )}>
          {tradeBalance >= 0 ? '+' : ''}₡{(tradeBalance / 1000000).toFixed(1)}M
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="glass-hierarchy-interactive rounded-md p-2">
          <div className="text-xs text-muted-foreground">Exports</div>
          <div className="font-bold text-green-500">
            ₡{(totalExports / 1000000).toFixed(1)}M
          </div>
        </div>
        <div className="glass-hierarchy-interactive rounded-md p-2">
          <div className="text-xs text-muted-foreground">Imports</div>
          <div className="font-bold text-red-500">
            ₡{(totalImports / 1000000).toFixed(1)}M
          </div>
        </div>
        <div className="glass-hierarchy-interactive rounded-md p-2">
          <div className="text-xs text-muted-foreground">Balance</div>
          <div className={cn(
            "font-bold",
            tradeBalance >= 0 ? 'text-green-500' : 'text-red-500'
          )}>
            {tradeBalance >= 0 ? '+' : ''}₡{(tradeBalance / 1000000).toFixed(1)}M
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {sortedPartners.slice(0, 5).map((partner, index) => (
          <motion.div
            key={partner.name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">{partner.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-green-500">↑{(partner.exports / 1000000).toFixed(1)}M</span>
              <span className="text-red-500">↓{(partner.imports / 1000000).toFixed(1)}M</span>
              <span className={cn(
                "font-medium",
                partner.balance >= 0 ? 'text-green-500' : 'text-red-500'
              )}>
                {partner.balance >= 0 ? '+' : ''}₡{(partner.balance / 1000000).toFixed(1)}M
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default {
  AtomicEconomicIndicator,
  AtomicSectorBreakdown,
  AtomicTaxComponent,
  AtomicBudgetAllocator,
  AtomicTradeFlow
};