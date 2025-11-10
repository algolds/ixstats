"use client";

/**
 * Diplomatic Operations Hub
 *
 * Main orchestrator component for diplomatic operations management.
 * Thin wrapper that composes custom hook and UI components.
 *
 * @module app/mycountry/intelligence/_components/DiplomaticOperationsHub
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Building2, Globe, Target, Heart, FileText, Plus, Filter, Calendar } from "lucide-react";
import { LoadingState } from "~/components/shared";
import {
  EmbassyCard,
  MissionCard,
  NetworkMetrics,
} from "~/components/diplomatic/diplomatic-operations";
import { useDiplomaticOperations } from "~/hooks/useDiplomaticOperations";

interface DiplomaticOperationsHubProps {
  countryId: string;
  countryName: string;
}

/**
 * Diplomatic Operations Hub - Main component for managing diplomatic operations
 */
export function DiplomaticOperationsHub({ countryId, countryName }: DiplomaticOperationsHubProps) {
  const operations = useDiplomaticOperations({ countryId, countryName });

  if (operations.embassiesLoading && !operations.embassies) {
    return <LoadingState variant="spinner" size="lg" message="Loading diplomatic operations..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-surface glass-refraction border-blue-200 dark:border-blue-800/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-6 w-6 text-blue-600" />
                Diplomatic Operations Management
              </CardTitle>
              <CardDescription>Manage embassies, missions, and cultural exchanges</CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {countryName}
            </Badge>
          </div>
        </CardHeader>

        {/* Network Overview */}
        {operations.networkMetrics && (
          <CardContent>
            <NetworkMetrics metrics={operations.networkMetrics} />
          </CardContent>
        )}
      </Card>

      {/* Tabs */}
      <Tabs
        value={operations.activeTab}
        onValueChange={operations.handleTabChange}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="embassy-network" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Embassy Network</span>
            <span className="sm:hidden">Network</span>
          </TabsTrigger>
          <TabsTrigger value="missions" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Missions</span>
            <span className="sm:hidden">Missions</span>
          </TabsTrigger>
          <TabsTrigger value="cultural-exchanges" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Cultural Exchanges</span>
            <span className="sm:hidden">Exchanges</span>
          </TabsTrigger>
          <TabsTrigger value="treaties" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Treaties</span>
            <span className="sm:hidden">Treaties</span>
          </TabsTrigger>
        </TabsList>

        {/* Embassy Network Tab */}
        <TabsContent value="embassy-network" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Your Embassy Network</h3>
            <Button onClick={operations.openEstablishEmbassyDialog} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Establish Embassy
            </Button>
          </div>

          {operations.embassies && operations.embassies.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {operations.embassies.map((embassy) => (
                <EmbassyCard
                  key={embassy.id}
                  embassy={embassy}
                  isExpanded={operations.expandedEmbassy === embassy.id}
                  onToggle={() => operations.handleEmbassyToggle(embassy.id)}
                  onUpgrade={() => operations.handleEmbassyUpgrade(embassy.id)}
                  onStartMission={() => operations.handleEmbassyStartMission(embassy.id)}
                  onAllocateBudget={() => operations.handleEmbassyAllocateBudget(embassy.id)}
                />
              ))}
            </div>
          ) : (
            <Card className="glass-surface glass-refraction">
              <CardContent className="py-12 text-center">
                <Building2 className="text-muted-foreground mx-auto mb-4 h-16 w-16 opacity-50" />
                <h3 className="mb-2 text-lg font-semibold">No Embassies Yet</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Establish your first embassy to begin building diplomatic relationships
                </p>
                <Button onClick={operations.openEstablishEmbassyDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Establish First Embassy
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Missions Tab */}
        <TabsContent value="missions" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Diplomatic Missions</h3>
            <div className="flex items-center gap-2">
              <Select
                value={operations.missionFilter}
                onValueChange={operations.handleMissionFilterChange}
              >
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Missions</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={operations.openStartMissionDialog}
                size="sm"
                disabled={!operations.selectedEmbassy}
              >
                <Plus className="mr-2 h-4 w-4" />
                Start Mission
              </Button>
            </div>
          </div>

          {!operations.selectedEmbassy ? (
            <Card className="glass-surface glass-refraction">
              <CardContent className="py-12 text-center">
                <Target className="text-muted-foreground mx-auto mb-4 h-16 w-16 opacity-50" />
                <h3 className="mb-2 text-lg font-semibold">Select an Embassy</h3>
                <p className="text-muted-foreground text-sm">
                  Go to the Embassy Network tab and select an embassy to view and start missions
                </p>
              </CardContent>
            </Card>
          ) : operations.missionsLoading ? (
            <LoadingState variant="spinner" message="Loading missions..." />
          ) : operations.filteredMissions.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {operations.filteredMissions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onComplete={
                    (mission as any).status === "active" && (mission as any).progress >= 100
                      ? () => operations.handleCompleteMission(mission.id)
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <Card className="glass-surface glass-refraction">
              <CardContent className="py-12 text-center">
                <Target className="text-muted-foreground mx-auto mb-4 h-16 w-16 opacity-50" />
                <h3 className="mb-2 text-lg font-semibold">
                  No {operations.missionFilter !== "all" ? operations.missionFilter : ""} Missions
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {operations.missionFilter === "all"
                    ? "Start your first diplomatic mission to expand your influence"
                    : `No ${operations.missionFilter} missions at this time`}
                </p>
                {operations.missionFilter === "all" && (
                  <Button onClick={operations.openStartMissionDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Start First Mission
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cultural Exchanges Tab */}
        <TabsContent value="cultural-exchanges" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Cultural Exchange Programs</h3>
            <div className="flex items-center gap-2">
              <Select
                value={operations.exchangeFilter}
                onValueChange={operations.handleExchangeFilterChange}
              >
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exchanges</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={operations.openCreateExchangeDialog} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create Exchange
              </Button>
            </div>
          </div>

          {operations.exchangesLoading ? (
            <LoadingState variant="spinner" message="Loading exchanges..." />
          ) : operations.filteredExchanges.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {operations.filteredExchanges.map((exchange) => (
                <Card
                  key={exchange.id}
                  className="glass-surface glass-refraction transition-shadow hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Heart className="h-5 w-5 text-pink-600" />
                          {exchange.title}
                        </CardTitle>
                        <CardDescription className="mt-1">{exchange.description}</CardDescription>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {exchange.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Type</p>
                        <p className="font-semibold capitalize">{exchange.type}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Participants</p>
                        <p className="font-semibold">{exchange.metrics?.participants ?? 0}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Cultural Impact</span>
                        <span className="font-semibold">
                          {exchange.metrics?.culturalImpact ?? 0}/100
                        </span>
                      </div>
                      <Progress value={exchange.metrics?.culturalImpact ?? 0} className="h-2" />
                    </div>

                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(exchange.startDate).toLocaleDateString()} -{" "}
                        {new Date(exchange.endDate).toLocaleDateString()}
                      </span>
                    </div>

                    {(exchange.participatingCountries?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-2 text-xs">
                          Participating Countries
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(exchange.participatingCountries ?? [])
                            .slice(0, 3)
                            .map((country: any) => (
                              <Badge key={country.id} variant="outline" className="text-xs">
                                {country.name}
                              </Badge>
                            ))}
                          {(exchange.participatingCountries?.length ?? 0) > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{(exchange.participatingCountries?.length ?? 0) - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass-surface glass-refraction">
              <CardContent className="py-12 text-center">
                <Heart className="text-muted-foreground mx-auto mb-4 h-16 w-16 opacity-50" />
                <h3 className="mb-2 text-lg font-semibold">
                  No {operations.exchangeFilter !== "all" ? operations.exchangeFilter : ""} Cultural
                  Exchanges
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {operations.exchangeFilter === "all"
                    ? "Create your first cultural exchange to strengthen international ties"
                    : `No ${operations.exchangeFilter} exchanges at this time`}
                </p>
                {operations.exchangeFilter === "all" && (
                  <Button onClick={operations.openCreateExchangeDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Exchange
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Treaties Tab */}
        <TabsContent value="treaties" className="space-y-4">
          <h3 className="text-lg font-semibold">Active Treaties</h3>

          {operations.relationships && operations.relationships.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {operations.relationships
                .filter((r) => r.treaties && r.treaties.length > 0)
                .map((relationship) => (
                  <Card key={relationship.id} className="glass-surface glass-refraction">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-5 w-5 text-blue-600" />
                        {relationship.targetCountry}
                      </CardTitle>
                      <CardDescription>
                        Relationship:{" "}
                        <span className="font-semibold capitalize">
                          {relationship.relationship}
                        </span>{" "}
                        • Strength: {relationship.strength}%
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-2 text-xs">Active Treaties</p>
                      <div className="flex flex-wrap gap-2">
                        {relationship.treaties.map((treaty: string, idx: number) => (
                          <Badge key={idx} variant="outline">
                            {treaty}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <Card className="glass-surface glass-refraction">
              <CardContent className="py-12 text-center">
                <FileText className="text-muted-foreground mx-auto mb-4 h-16 w-16 opacity-50" />
                <h3 className="mb-2 text-lg font-semibold">No Active Treaties</h3>
                <p className="text-muted-foreground text-sm">
                  Build diplomatic relationships to negotiate and sign treaties
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Establish Embassy Dialog */}
      <Dialog
        open={operations.establishEmbassyOpen}
        onOpenChange={operations.setEstablishEmbassyOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Establish New Embassy</DialogTitle>
            <DialogDescription>
              Create a new diplomatic mission in another country
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="host-country">Host Country *</Label>
              <Select
                value={operations.newEmbassyData.hostCountry}
                onValueChange={operations.handleHostCountrySelect}
                disabled={operations.countriesLoading || operations.hostCountryOptions.length === 0}
              >
                <SelectTrigger id="host-country">
                  <SelectValue
                    placeholder={
                      operations.countriesLoading ? "Loading countries..." : "Select a country"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {operations.hostCountryOptions.map((option) => (
                    <SelectItem
                      key={option.id}
                      value={option.id}
                      disabled={operations.existingGuestEmbassyHosts.has(option.id)}
                    >
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="embassy-name">Embassy Name *</Label>
              <Input
                id="embassy-name"
                placeholder="e.g., Embassy of [Your Country] in [Host Country]"
                value={operations.newEmbassyData.name}
                onChange={operations.handleEmbassyNameChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                placeholder="e.g., Capital City"
                value={operations.newEmbassyData.location}
                onChange={operations.handleEmbassyLocationChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ambassador">Ambassador Name (Optional)</Label>
              <Input
                id="ambassador"
                placeholder="Name of appointed ambassador"
                value={operations.newEmbassyData.ambassador}
                onChange={operations.handleEmbassyAmbassadorChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => operations.setEstablishEmbassyOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={operations.handleEstablishEmbassy}
              disabled={
                operations.establishEmbassyMutation.isPending ||
                operations.hostCountryOptions.length === 0
              }
            >
              {operations.establishEmbassyMutation.isPending
                ? "Establishing..."
                : "Establish Embassy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Mission Dialog */}
      <Dialog open={operations.startMissionOpen} onOpenChange={operations.setStartMissionOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Start Diplomatic Mission</DialogTitle>
            <DialogDescription>Launch a new mission from your selected embassy</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mission-type">Mission Type</Label>
              <Select
                value={operations.newMissionData.type}
                onValueChange={operations.handleMissionTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trade_negotiation">Trade Negotiation</SelectItem>
                  <SelectItem value="intelligence_gathering">Intelligence Gathering</SelectItem>
                  <SelectItem value="cultural_outreach">Cultural Outreach</SelectItem>
                  <SelectItem value="security_cooperation">Security Cooperation</SelectItem>
                  <SelectItem value="research_collaboration">Research Collaboration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-count">Staff to Assign</Label>
              <Input
                id="staff-count"
                type="number"
                min="1"
                max="5"
                value={operations.newMissionData.staff}
                onChange={operations.handleMissionStaffChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority Level</Label>
              <Select
                value={operations.newMissionData.priority}
                onValueChange={operations.handleMissionPriorityChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (Slower, lower cost)</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High (Faster, higher success)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => operations.setStartMissionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={operations.handleStartMission}
              disabled={operations.startMissionMutation.isPending}
            >
              {operations.startMissionMutation.isPending ? "Starting..." : "Start Mission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Cultural Exchange Dialog */}
      <Dialog open={operations.createExchangeOpen} onOpenChange={operations.setCreateExchangeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Cultural Exchange</DialogTitle>
            <DialogDescription>Organize a new cultural exchange program</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="exchange-title">Title *</Label>
              <Input
                id="exchange-title"
                placeholder="e.g., International Arts Festival"
                value={operations.newExchangeData.title}
                onChange={operations.handleExchangeTitleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exchange-type">Type</Label>
              <Select
                value={operations.newExchangeData.type}
                onValueChange={operations.handleExchangeTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="festival">Festival</SelectItem>
                  <SelectItem value="exhibition">Exhibition</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="cuisine">Cuisine</SelectItem>
                  <SelectItem value="arts">Arts</SelectItem>
                  <SelectItem value="sports">Sports</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="diplomacy">Diplomacy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exchange-description">Description *</Label>
              <Textarea
                id="exchange-description"
                placeholder="Describe the cultural exchange program..."
                rows={3}
                value={operations.newExchangeData.description}
                onChange={operations.handleExchangeDescriptionChange}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={operations.newExchangeData.startDate}
                  onChange={operations.handleExchangeStartDateChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={operations.newExchangeData.endDate}
                  onChange={operations.handleExchangeEndDateChange}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => operations.setCreateExchangeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={operations.handleCreateExchange}
              disabled={operations.createExchangeMutation.isPending}
            >
              {operations.createExchangeMutation.isPending ? "Creating..." : "Create Exchange"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocate Budget Dialog */}
      <Dialog open={operations.allocateBudgetOpen} onOpenChange={operations.setAllocateBudgetOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Allocate Embassy Budget</DialogTitle>
            <DialogDescription>Add additional funding to your embassy</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="budget-amount">Amount to Allocate</Label>
              <Input
                id="budget-amount"
                type="number"
                min="1000"
                max="1000000"
                step="1000"
                value={operations.budgetAmount}
                onChange={operations.handleBudgetAmountChange}
              />
              <p className="text-muted-foreground text-xs">
                Amount: ${operations.budgetAmount.toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => operations.setAllocateBudgetOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={operations.handleAllocateBudget}
              disabled={operations.allocateBudgetMutation.isPending}
            >
              {operations.allocateBudgetMutation.isPending ? "Allocating..." : "Allocate Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Embassy Dialog */}
      <Dialog open={operations.upgradeEmbassyOpen} onOpenChange={operations.setUpgradeEmbassyOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Upgrade Embassy</DialogTitle>
            <DialogDescription>
              Invest in targeted upgrades to improve embassy effectiveness and mission success.
            </DialogDescription>
          </DialogHeader>

          {!operations.selectedEmbassy ? (
            <div className="text-muted-foreground py-6 text-center text-sm">
              Select an embassy from the network list to view upgrade options.
            </div>
          ) : operations.upgradesLoading ? (
            <LoadingState variant="spinner" message="Loading upgrade options..." />
          ) : operations.availableUpgrades && operations.availableUpgrades.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="upgrade-type">Upgrade Focus</Label>
                <Select
                  value={operations.selectedUpgradeType}
                  onValueChange={operations.handleUpgradeTypeChange}
                >
                  <SelectTrigger id="upgrade-type">
                    <SelectValue placeholder="Select upgrade" />
                  </SelectTrigger>
                  <SelectContent>
                    {operations.availableUpgrades
                      .filter((upgrade) => upgrade !== null)
                      .map((upgrade) => (
                        <SelectItem key={upgrade.upgradeType} value={upgrade.upgradeType}>
                          {upgrade.upgradeType.replace(/_/g, " ")} (Lvl {upgrade.nextLevel})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {operations.selectedUpgrade && (
                <div className="grid gap-3 rounded-lg border border-purple-200/60 bg-purple-50/40 p-4 dark:border-purple-900/60 dark:bg-purple-950/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold capitalize">
                        {operations.selectedUpgrade.upgradeType.replace(/_/g, " ")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Level {operations.selectedUpgrade.nextLevel} upgrade
                      </p>
                    </div>
                    <Badge variant="outline">
                      {operations.selectedUpgrade.duration} day project
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-white/60 p-3 dark:bg-black/40">
                      <p className="text-muted-foreground text-xs">Cost</p>
                      <p className="font-semibold">
                        ${operations.selectedUpgrade.cost.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-md bg-white/60 p-3 dark:bg-black/40">
                      <p className="text-muted-foreground text-xs">Requirements</p>
                      <p className="font-semibold">
                        Level {operations.selectedUpgrade.requirements.embassyLevel}+ | Budget $
                        {operations.selectedUpgrade.requirements.budget.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {operations.selectedUpgrade.effects && (
                    <div className="bg-muted/50 rounded-md p-3 text-xs">
                      <p className="mb-1 font-semibold">Projected Effects</p>
                      <ul className="space-y-1">
                        {Object.entries(operations.selectedUpgrade.effects).map(([key, value]) => (
                          <li key={key} className="flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize">
                              {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                            </Badge>
                            <span className="font-medium">+{String(value)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-md border border-dashed border-green-300/60 p-3 text-green-700 dark:border-green-700/60 dark:text-green-300">
                      {operations.selectedUpgrade.canAfford
                        ? "Budget available"
                        : "Insufficient budget"}
                    </div>
                    <div className="rounded-md border border-dashed border-blue-300/60 p-3 text-blue-700 dark:border-blue-700/60 dark:text-blue-300">
                      {operations.selectedUpgrade.meetsLevelReq
                        ? "Level requirement met"
                        : `Requires embassy level ${operations.selectedUpgrade.requirements.embassyLevel}`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground py-6 text-center text-sm">
              No upgrades are currently available for this embassy.
            </div>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => operations.setUpgradeEmbassyOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={operations.handleUpgradeEmbassy}
              disabled={
                operations.upgradeEmbassyMutation.isPending ||
                !operations.selectedEmbassy ||
                !operations.selectedUpgrade ||
                !operations.selectedUpgrade.canAfford ||
                !operations.selectedUpgrade.meetsLevelReq
              }
            >
              {operations.upgradeEmbassyMutation.isPending
                ? "Starting Upgrade..."
                : "Start Upgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
