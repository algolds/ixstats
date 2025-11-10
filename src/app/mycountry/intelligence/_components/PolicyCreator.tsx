"use client";

/**
 * PolicyCreator - Comprehensive policy creation component with full builder integration
 *
 * This component provides a multi-step wizard for creating policies that integrate with:
 * - Government Builder: Department selection and atomic component analysis
 * - Economy Builder: Economic impact projections and sector effects
 * - Tax System: Revenue implications and fiscal impact
 *
 * Features:
 * - 5-step creation wizard with validation
 * - Real-time impact calculations and projections
 * - Builder context integration (government, economy, tax)
 * - Policy templates and AI-powered suggestions
 * - Draft saving/loading with autosave
 * - Interactive visualizations (charts, impact preview)
 * - Cost-benefit analysis
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  TrendingUp,
  Calendar,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Save,
  FileText,
  DollarSign,
  Users,
  Sparkles,
  AlertCircle,
  Info,
  Target,
  Activity,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { LoadingState } from "~/components/shared/feedback";
import {
  ATOMIC_COMPONENTS,
  type ComponentType,
} from "~/components/government/atoms/AtomicGovernmentComponents";
import { usePolicyCreator } from "~/hooks/usePolicyCreator";
import {
  POLICY_TEMPLATES,
  POLICY_TYPE_CONFIG,
  type PolicyType,
  type PolicyPriority,
} from "~/lib/policy-templates";

// Step definitions
const STEPS = [
  { id: 1, title: "Policy Type", icon: FileText },
  { id: 2, title: "Department", icon: Building2 },
  { id: 3, title: "Impact Configuration", icon: TrendingUp },
  { id: 4, title: "Timeline", icon: Calendar },
  { id: 5, title: "Review", icon: CheckCircle },
] as const;

interface PolicyCreatorProps {
  countryId: string;
  userId: string;
  onComplete?: (policyId: string) => void;
  onCancel?: () => void;
  initialDraft?: any;
}

export function PolicyCreator({
  countryId,
  userId,
  onComplete,
  onCancel,
  initialDraft,
}: PolicyCreatorProps) {
  // Use policy creator hook for all state and logic
  const policy = usePolicyCreator({
    countryId,
    userId,
    onSuccess: onComplete,
    initialDraft,
  });

  // Render step content
  const renderStepContent = () => {
    switch (policy.currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Policy Templates */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <Sparkles className="h-4 w-4 text-yellow-600" />
                Quick Start Templates
              </Label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {POLICY_TEMPLATES.map((template) => {
                  const config = POLICY_TYPE_CONFIG[template.policyType];
                  const Icon = config.icon;

                  return (
                    <motion.div
                      key={template.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card
                        className="hover:border-primary cursor-pointer border-2 transition-all hover:shadow-md"
                        onClick={() => policy.applyTemplate(template)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`rounded-lg p-2 ${config.bg}`}>
                              <Icon className={`h-5 w-5 ${config.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="mb-1 text-sm font-semibold">{template.name}</h4>
                              <p className="text-muted-foreground line-clamp-2 text-xs">
                                {template.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Policy Type Selection */}
            <div className="space-y-3">
              <Label htmlFor="policyType" className="text-base font-semibold">
                Policy Type *
              </Label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {(Object.keys(POLICY_TYPE_CONFIG) as PolicyType[]).map((type) => {
                  const config = POLICY_TYPE_CONFIG[type];
                  const Icon = config.icon;
                  const isSelected = policy.formData.policyType === type;

                  return (
                    <motion.div key={type} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <div
                        className={`cursor-pointer rounded-lg border-2 p-4 text-center transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => policy.updateField("policyType", type)}
                      >
                        <Icon className={`mx-auto mb-2 h-6 w-6 ${config.color}`} />
                        <p className="text-xs font-medium capitalize">{type}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Policy Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-semibold">
                Policy Name *
              </Label>
              <Input
                id="name"
                value={policy.formData.name}
                onChange={(e) => policy.updateField("name", e.target.value)}
                placeholder="Enter a clear, descriptive policy name"
                className="text-base"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">
                Description *
              </Label>
              <Textarea
                id="description"
                value={policy.formData.description}
                onChange={(e) => policy.updateField("description", e.target.value)}
                placeholder="Describe the policy's goals, scope, and expected outcomes"
                rows={4}
                className="text-base"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category" className="text-base font-semibold">
                Category
              </Label>
              <Input
                id="category"
                value={policy.formData.category}
                onChange={(e) => policy.updateField("category", e.target.value)}
                placeholder="e.g., healthcare, education, defense"
                className="text-base"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Select a government department and atomic components that will implement this
                policy. This helps calculate effectiveness and synergy effects.
              </AlertDescription>
            </Alert>

            {/* Department Selection */}
            {policy.governmentData?.departments && policy.governmentData.departments.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Implementing Department</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {policy.governmentData.departments.map((dept: any, index: number) => (
                    <Card
                      key={index}
                      className={`cursor-pointer border-2 transition-all hover:shadow-md ${
                        policy.formData.selectedDepartment === index.toString()
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                      onClick={() => policy.updateField("selectedDepartment", index.toString())}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 rounded-lg p-2">
                            <Building2 className="text-primary h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">{dept.name}</h4>
                            <p className="text-muted-foreground text-xs">{dept.description}</p>
                          </div>
                          {policy.formData.selectedDepartment === index.toString() && (
                            <CheckCircle className="text-primary h-5 w-5" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Atomic Component Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Related Government Components
                <Badge variant="outline" className="ml-2">
                  {policy.formData.selectedComponents.length} selected
                </Badge>
              </Label>
              <p className="text-muted-foreground text-sm">
                Select components that influence or are affected by this policy
              </p>

              <div className="grid max-h-96 grid-cols-1 gap-3 overflow-y-auto p-1 md:grid-cols-2">
                {Object.entries(ATOMIC_COMPONENTS)
                  .slice(0, 20)
                  .map(([key, component]) => {
                    if (!component) return null;
                    const isSelected = policy.formData.selectedComponents.includes(
                      key as ComponentType
                    );

                    return (
                      <Card
                        key={key}
                        className={`cursor-pointer border transition-all hover:shadow-sm ${
                          isSelected ? "border-primary bg-primary/5" : "border-border"
                        }`}
                        onClick={() => {
                          policy.updateField(
                            "selectedComponents",
                            isSelected
                              ? policy.formData.selectedComponents.filter((c) => c !== key)
                              : [...policy.formData.selectedComponents, key as ComponentType]
                          );
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h5 className="mb-1 text-sm font-medium">{component.name}</h5>
                              <p className="text-muted-foreground line-clamp-2 text-xs">
                                {component.description}
                              </p>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {component.effectiveness}%
                              </Badge>
                              {isSelected && <CheckCircle className="text-primary h-4 w-4" />}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Impact Preview */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5" />
                  Projected Impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="bg-background rounded-lg p-3 text-center">
                    <TrendingUp className="mx-auto mb-1 h-5 w-5 text-green-600" />
                    <p className="text-2xl font-bold text-green-600">
                      {policy.calculatedImpact.gdpImpact > 0 ? "+" : ""}
                      {policy.calculatedImpact.gdpImpact}%
                    </p>
                    <p className="text-muted-foreground text-xs">GDP Impact</p>
                  </div>
                  <div className="bg-background rounded-lg p-3 text-center">
                    <DollarSign className="mx-auto mb-1 h-5 w-5 text-blue-600" />
                    <p className="text-2xl font-bold text-blue-600">
                      ${(policy.calculatedImpact.revenueImpact / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-muted-foreground text-xs">Revenue Impact</p>
                  </div>
                  <div className="bg-background rounded-lg p-3 text-center">
                    <Users className="mx-auto mb-1 h-5 w-5 text-purple-600" />
                    <p className="text-2xl font-bold text-purple-600">
                      {policy.calculatedImpact.employmentImpact > 0 ? "+" : ""}
                      {policy.calculatedImpact.employmentImpact}%
                    </p>
                    <p className="text-muted-foreground text-xs">Employment</p>
                  </div>
                  <div className="bg-background rounded-lg p-3 text-center">
                    <Target className="mx-auto mb-1 h-5 w-5 text-orange-600" />
                    <p className="text-2xl font-bold text-orange-600">
                      {policy.calculatedImpact.effectiveness}%
                    </p>
                    <p className="text-muted-foreground text-xs">Effectiveness</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Configuration */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="implementationCost" className="text-base font-semibold">
                  Implementation Cost *
                </Label>
                <div className="flex items-center gap-4">
                  <Slider
                    id="implementationCost"
                    min={100000}
                    max={50000000}
                    step={100000}
                    value={[policy.formData.implementationCost]}
                    onValueChange={([value]) =>
                      policy.updateField("implementationCost", value || 100000)
                    }
                    className="flex-1"
                  />
                  <div className="w-32">
                    <Input
                      type="number"
                      value={policy.formData.implementationCost}
                      onChange={(e) =>
                        policy.updateField("implementationCost", Number(e.target.value))
                      }
                      className="text-right"
                    />
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">
                  ${(policy.formData.implementationCost / 1000000).toFixed(2)}M implementation cost
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenanceCost" className="text-base font-semibold">
                  Annual Maintenance Cost
                </Label>
                <div className="flex items-center gap-4">
                  <Slider
                    id="maintenanceCost"
                    min={0}
                    max={10000000}
                    step={50000}
                    value={[policy.formData.maintenanceCost]}
                    onValueChange={([value]) => policy.updateField("maintenanceCost", value || 0)}
                    className="flex-1"
                  />
                  <div className="w-32">
                    <Input
                      type="number"
                      value={policy.formData.maintenanceCost}
                      onChange={(e) =>
                        policy.updateField("maintenanceCost", Number(e.target.value))
                      }
                      className="text-right"
                    />
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">
                  ${(policy.formData.maintenanceCost / 1000000).toFixed(2)}M annual maintenance
                </p>
              </div>
            </div>

            {/* Priority Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Priority Level *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(["critical", "high", "medium", "low"] as PolicyPriority[]).map((level) => (
                  <Button
                    key={level}
                    variant={policy.formData.priority === level ? "default" : "outline"}
                    onClick={() => policy.updateField("priority", level)}
                    className="capitalize"
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>

            {/* Budget Impact Warning */}
            {policy.economyData && policy.calculatedImpact.budgetBalance < 0 && (
              <Alert className="border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                  <span className="font-semibold text-red-600">Budget Deficit Warning:</span> This
                  policy will create a budget deficit of $
                  {Math.abs(policy.calculatedImpact.budgetBalance / 1000000).toFixed(2)}M. Consider
                  reducing costs or adjusting your budget.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {/* Timeline Configuration */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate" className="text-base font-semibold">
                  Effective Date
                </Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={policy.formData.effectiveDate?.toISOString().split("T")[0] || ""}
                  onChange={(e) =>
                    policy.updateField(
                      "effectiveDate",
                      e.target.value ? new Date(e.target.value) : null
                    )
                  }
                />
                <p className="text-muted-foreground text-sm">
                  When should this policy take effect? (Leave blank for immediate)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate" className="text-base font-semibold">
                  Expiry Date
                </Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={policy.formData.expiryDate?.toISOString().split("T")[0] || ""}
                  onChange={(e) =>
                    policy.updateField(
                      "expiryDate",
                      e.target.value ? new Date(e.target.value) : null
                    )
                  }
                  min={policy.formData.effectiveDate?.toISOString().split("T")[0] || ""}
                />
                <p className="text-muted-foreground text-sm">
                  When should this policy expire? (Leave blank for permanent)
                </p>
              </div>
            </div>

            {/* Auto-Activation */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="autoActivate" className="text-base font-semibold">
                      Auto-Activate Policy
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      Activate this policy immediately after creation
                    </p>
                  </div>
                  <Switch
                    id="autoActivate"
                    checked={policy.formData.autoActivate}
                    onCheckedChange={(checked) => policy.updateField("autoActivate", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Implementation Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estimated Implementation Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Planning Phase</span>
                    <Badge>1-2 weeks</Badge>
                  </div>
                  <Progress value={100} className="h-1" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Implementation Phase</span>
                    <Badge>2-4 weeks</Badge>
                  </div>
                  <Progress value={60} className="h-1" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Monitoring Phase</span>
                    <Badge>Ongoing</Badge>
                  </div>
                  <Progress value={20} className="h-1" />
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            {/* Policy Summary */}
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Policy Review
                </CardTitle>
                <CardDescription>Review your policy before creation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Basic Info */}
                <div>
                  <h4 className="mb-2 text-lg font-semibold">{policy.formData.name}</h4>
                  <p className="text-muted-foreground mb-2 text-sm">
                    {policy.formData.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {policy.formData.policyType}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {policy.formData.priority} Priority
                    </Badge>
                    {policy.formData.category && (
                      <Badge variant="outline">{policy.formData.category}</Badge>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-muted space-y-2 rounded-lg p-4">
                  <h5 className="mb-2 font-semibold">Financial Summary</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Implementation Cost</p>
                      <p className="font-semibold">
                        ${(policy.formData.implementationCost / 1000000).toFixed(2)}M
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Annual Maintenance</p>
                      <p className="font-semibold">
                        ${(policy.formData.maintenanceCost / 1000000).toFixed(2)}M
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Projected GDP Impact</p>
                      <p className="font-semibold text-green-600">
                        {policy.calculatedImpact.gdpImpact > 0 ? "+" : ""}
                        {policy.calculatedImpact.gdpImpact}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Effectiveness Score</p>
                      <p className="font-semibold text-blue-600">
                        {policy.calculatedImpact.effectiveness}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                {(policy.formData.effectiveDate || policy.formData.expiryDate) && (
                  <div className="bg-muted space-y-2 rounded-lg p-4">
                    <h5 className="mb-2 font-semibold">Timeline</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {policy.formData.effectiveDate && (
                        <div>
                          <p className="text-muted-foreground">Effective Date</p>
                          <p className="font-semibold">
                            {policy.formData.effectiveDate.toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {policy.formData.expiryDate && (
                        <div>
                          <p className="text-muted-foreground">Expiry Date</p>
                          <p className="font-semibold">
                            {policy.formData.expiryDate.toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Components */}
                {policy.formData.selectedComponents.length > 0 && (
                  <div>
                    <h5 className="mb-2 font-semibold">Related Components</h5>
                    <div className="flex flex-wrap gap-2">
                      {policy.formData.selectedComponents.map((comp) => (
                        <Badge key={comp} variant="secondary">
                          {ATOMIC_COMPONENTS[comp]?.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {policy.calculatedImpact.budgetBalance < 0 && (
                  <Alert className="border-yellow-200 dark:border-yellow-800">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription>
                      This policy will create a budget deficit. Ensure adequate funding is
                      available.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="glass-surface glass-refraction">
        <CardHeader>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="text-2xl">Create New Policy</CardTitle>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = policy.currentStep === step.id;
              const isComplete = policy.currentStep > step.id;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                        isComplete
                          ? "bg-green-600 text-white"
                          : isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>
                    <p className={`text-center text-xs ${isActive ? "font-semibold" : ""}`}>
                      {step.title}
                    </p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className="bg-muted mx-2 mt-5 h-0.5 flex-1">
                      <div
                        className={`h-full transition-all ${
                          isComplete ? "bg-green-600" : "bg-transparent"
                        }`}
                        style={{ width: isComplete ? "100%" : "0%" }}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Progress Bar */}
          <Progress value={(policy.currentStep / 5) * 100} className="mt-4 h-2" />
        </CardHeader>
      </Card>

      {/* Step Content */}
      <Card className="glass-surface glass-refraction">
        <CardContent className="pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={policy.currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card className="glass-surface glass-refraction">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={policy.prevStep}
              disabled={policy.currentStep === 1 || policy.isProcessing}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>

            <div className="flex items-center gap-3">
              {onCancel && (
                <Button variant="ghost" onClick={onCancel} disabled={policy.isProcessing}>
                  Cancel
                </Button>
              )}

              {policy.currentStep < 5 ? (
                <Button onClick={policy.nextStep} disabled={!policy.canProceed}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={policy.handleSubmit}
                  disabled={policy.isProcessing || !policy.canProceed}
                  className="min-w-32"
                >
                  {policy.isProcessing ? (
                    <>
                      <LoadingState variant="spinner" size="sm" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Policy
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
