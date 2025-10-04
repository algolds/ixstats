// src/components/quickactions/PolicyTemplateSelector.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Progress } from '~/components/ui/progress';
import {
  ChevronRight,
  Search,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Info,
  Sparkles,
  DollarSign,
  Users,
  AlertTriangle,
  Lightbulb,
  Target
} from 'lucide-react';
import {
  type PolicyTemplate,
  policyTaxonomy,
  searchPolicyTemplates,
  getPolicyTemplateById,
  getPolicyTemplatePath
} from '~/lib/policy-taxonomy';
import { cn } from '~/lib/utils';
import { NumberFlowDisplay } from '~/components/ui/number-flow';

interface PolicyTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: PolicyTemplate) => void;
  economicData?: {
    gdp: number;
    unemployment: number;
    inflation: number;
    taxRevenue: number;
  };
}

export function PolicyTemplateSelector({
  open,
  onOpenChange,
  onSelect,
  economicData
}: PolicyTemplateSelectorProps) {
  const [currentLevel, setCurrentLevel] = useState<PolicyTemplate[]>(policyTaxonomy);
  const [breadcrumb, setBreadcrumb] = useState<PolicyTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<PolicyTemplate | null>(null);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchPolicyTemplates(searchQuery);
  }, [searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  const handleNavigate = (template: PolicyTemplate) => {
    if (template.children && template.children.length > 0) {
      // Navigate deeper
      setBreadcrumb([...breadcrumb, template]);
      setCurrentLevel(template.children);
      setSelectedTemplate(null);
    } else {
      // Leaf template - can be selected
      setSelectedTemplate(template);
    }
  };

  const handleBack = () => {
    if (breadcrumb.length === 0) return;

    const newBreadcrumb = breadcrumb.slice(0, -1);
    setBreadcrumb(newBreadcrumb);

    if (newBreadcrumb.length === 0) {
      setCurrentLevel(policyTaxonomy);
    } else {
      const parent = newBreadcrumb[newBreadcrumb.length - 1];
      setCurrentLevel(parent!.children || policyTaxonomy);
    }
    setSelectedTemplate(null);
  };

  const handleSelectFromSearch = (template: PolicyTemplate) => {
    setSelectedTemplate(template);
    setSearchQuery('');
  };

  const handleConfirmSelection = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
      handleReset();
      onOpenChange(false);
    }
  };

  const handleReset = () => {
    setCurrentLevel(policyTaxonomy);
    setBreadcrumb([]);
    setSearchQuery('');
    setSelectedTemplate(null);
  };

  const getPolicyTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      economic: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200',
      social: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200',
      infrastructure: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200',
      diplomatic: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200',
      governance: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200',
    };
    return colors[type] || 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-blue-500 text-white',
      low: 'bg-gray-500 text-white',
    };
    return colors[priority] || 'bg-gray-500 text-white';
  };

  const calculateImpact = (template: PolicyTemplate) => {
    if (!economicData) return null;

    const impacts: Array<{ label: string; value: number; color: string; suffix?: string }> = [];

    if (template.gdpEffect) {
      impacts.push({
        label: 'GDP',
        value: template.gdpEffect,
        color: template.gdpEffect > 0 ? 'text-green-600' : 'text-red-600',
        suffix: '%'
      });
    }

    if (template.employmentEffect) {
      impacts.push({
        label: 'Unemployment',
        value: template.employmentEffect,
        color: template.employmentEffect < 0 ? 'text-green-600' : 'text-red-600',
        suffix: '%'
      });
    }

    if (template.inflationEffect) {
      impacts.push({
        label: 'Inflation',
        value: template.inflationEffect,
        color: Math.abs(template.inflationEffect) < 0.5 ? 'text-green-600' : 'text-orange-600',
        suffix: '%'
      });
    }

    if (template.taxRevenueEffect) {
      impacts.push({
        label: 'Tax Revenue',
        value: template.taxRevenueEffect,
        color: template.taxRevenueEffect > 0 ? 'text-green-600' : 'text-red-600',
        suffix: '%'
      });
    }

    return impacts;
  };

  const renderTemplate = (template: PolicyTemplate, index: number, isSearch = false) => {
    const hasChildren = template.children && template.children.length > 0;
    const isSelectable = !hasChildren;
    const impacts = calculateImpact(template);

    return (
      <motion.button
        key={template.id}
        type="button"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: isSearch ? 0 : index * 0.05 }}
        onClick={() => isSearch ? handleSelectFromSearch(template) : handleNavigate(template)}
        className={cn(
          "w-full p-5 rounded-xl text-left transition-all group relative overflow-hidden",
          "glass-hierarchy-child hover:glass-hierarchy-interactive",
          "border border-white/20 hover:border-blue-400/50",
          "hover:scale-[1.02] active:scale-[0.98]",
          selectedTemplate?.id === template.id && "glass-hierarchy-interactive border-blue-500 shadow-lg shadow-blue-500/20"
        )}
        style={{
          background: selectedTemplate?.id === template.id
            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.05))'
            : 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(10px) saturate(150%)'
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h4 className="font-medium">{template.name}</h4>
              {isSelectable && selectedTemplate?.id === template.id && (
                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
              )}
              <Badge variant="outline" className={cn("text-xs flex-shrink-0", getPolicyTypeColor(template.policyType))}>
                {template.policyType}
              </Badge>
              <Badge className={cn("text-xs flex-shrink-0", getPriorityColor(template.priority))}>
                {template.priority}
              </Badge>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-2">{template.description}</p>

            {/* Economic Effects Preview */}
            {impacts && impacts.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {impacts.map((impact) => (
                  <div key={impact.label} className="flex items-center gap-1.5 text-sm px-2 py-1 rounded-md bg-white/40">
                    {impact.value > 0 ? (
                      <TrendingUp className={cn("h-4 w-4", impact.color)} />
                    ) : (
                      <TrendingDown className={cn("h-4 w-4", impact.color)} />
                    )}
                    <span className="text-gray-700 font-medium">{impact.label}:</span>
                    <span className={cn("font-semibold", impact.color)}>
                      {impact.value > 0 ? '+' : ''}{impact.value.toFixed(1)}{impact.suffix || ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Costs */}
            {template.implementationCost !== undefined && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  <span>
                    Implementation: <NumberFlowDisplay value={template.implementationCost} prefix="$" />
                  </span>
                </div>
                {template.maintenanceCost !== undefined && template.maintenanceCost > 0 && (
                  <div className="flex items-center gap-1">
                    <span>
                      Annual: <NumberFlowDisplay value={template.maintenanceCost} prefix="$" />
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Objectives */}
            {template.objectives && template.objectives.length > 0 && (
              <div className="text-xs text-muted-foreground mb-2">
                <div className="flex items-center gap-1 mb-1">
                  <Target className="h-3 w-3" />
                  <span className="font-medium">Objectives:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 ml-4">
                  {template.objectives.slice(0, 3).map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Estimated Benefit */}
            {template.estimatedBenefit && (
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 text-yellow-600" />
                  <span>{template.estimatedBenefit}</span>
                </div>
              </div>
            )}
          </div>

          {/* Navigation indicator */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {hasChildren && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                <span>{template.children!.length} option{template.children!.length !== 1 ? 's' : ''}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            )}
          </div>
        </div>
      </motion.button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) handleReset();
    }}>
      <DialogContent
        className="glass-hierarchy-modal flex flex-col"
        style={{
          width: '100vw',
          maxWidth: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          padding: '32px',
          margin: '0px',
          overflowY: 'auto',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px) saturate(180%)',
          border: 'none'
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onOpenChange(false);
        }}
      >
        <DialogHeader className="mb-6">
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            Select Policy Template
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Browse our comprehensive library of policy templates with realistic economic effects based on real-world data
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search policies... (e.g., 'stimulus', 'healthcare', 'tax')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7"
              onClick={() => setSearchQuery('')}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Breadcrumb Navigation */}
        {!isSearching && breadcrumb.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>Home</span>
              {breadcrumb.map((item, index) => (
                <React.Fragment key={item.id}>
                  <ChevronRight className="h-4 w-4" />
                  <span className={index === breadcrumb.length - 1 ? 'text-foreground font-medium' : ''}>
                    {item.name}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <ScrollArea className="flex-1 pr-4">
          <AnimatePresence mode="wait">
            {isSearching ? (
              // Search Results View
              <motion.div
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {searchResults.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">
                      Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </p>
                    {searchResults.map((template, index) => renderTemplate(template, index, true))}
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No policies found for "{searchQuery}"</p>
                    <p className="text-sm mt-2">Try different keywords or browse by category</p>
                  </div>
                )}
              </motion.div>
            ) : (
              // Browse Hierarchical View
              <motion.div
                key="browse"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {currentLevel.map((template, index) => renderTemplate(template, index, false))}
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Footer with Selection */}
        {selectedTemplate && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">Selected: {selectedTemplate.name}</p>
                <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                {selectedTemplate.estimatedBenefit && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <Lightbulb className="h-3 w-3 inline mr-1 text-yellow-600" />
                    {selectedTemplate.estimatedBenefit}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedTemplate(null);
                  onOpenChange(false);
                  handleReset();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSelection}
                className="flex-1"
              >
                Use This Template
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
