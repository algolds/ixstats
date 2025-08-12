"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
import { IxTime } from "~/lib/ixtime";
import { IxnayWikiService, type CountryInfobox } from "~/lib/mediawiki-service";
import {
  // Wiki Icons
  RiBookOpenLine,
  RiGlobalLine,
  RiMapLine,
  RiBuildingLine,
  RiMoneyDollarCircleLine,
  RiTeamLine,
  RiHistoryLine,
  RiHeartLine,
  // Intelligence Icons
  RiShieldLine,
  RiEyeLine,
  RiLockLine,
  RiInformationLine,
  RiAlertLine,
  RiExternalLinkLine,
  RiRefreshLine,
  // Media Icons
  RiImageLine,
  RiVideoLine,
  RiFileLine
} from "react-icons/ri";

// Enhanced wiki data types
interface WikiSection {
  id: string;
  title: string;
  content: string;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  importance: 'critical' | 'high' | 'medium' | 'low';
  lastModified: string;
  wordCount: number;
}

interface WikiIntelligenceData {
  countryName: string;
  infobox: CountryInfobox | null;
  sections: WikiSection[];
  lastUpdated: number;
  confidence: number;
  isLoading: boolean;
  error?: string;
}

interface DataConflict {
  field: string;
  wikiValue: string | undefined;
  ixStatsValue: string | number | undefined;
  type: 'missing_in_wiki' | 'missing_in_ixstats' | 'value_mismatch' | 'format_difference';
  severity: 'low' | 'medium' | 'high';
}

interface WikiIntelligenceTabProps {
  countryName: string;
  countryData: {
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    economicTier: string;
    continent?: string;
    region?: string;
    governmentType?: string;
    leader?: string;
    capital?: string;
    religion?: string;
  };
  viewerClearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  flagColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const CLASSIFICATION_STYLES = {
  'PUBLIC': {
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    label: 'PUBLIC'
  },
  'RESTRICTED': {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'RESTRICTED'
  },
  'CONFIDENTIAL': {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'CONFIDENTIAL'
  }
} as const;

const SECTION_ICONS = {
  'geography': RiMapLine,
  'government': RiBuildingLine,
  'economy': RiMoneyDollarCircleLine,
  'demographics': RiTeamLine,
  'history': RiHistoryLine,
  'culture': RiHeartLine,
  'default': RiBookOpenLine
} as const;

export const WikiIntelligenceTab: React.FC<WikiIntelligenceTabProps> = ({
  countryName,
  countryData,
  viewerClearanceLevel = 'PUBLIC',
  flagColors = { primary: '#3b82f6', secondary: '#6366f1', accent: '#8b5cf6' }
}) => {
  const [wikiData, setWikiData] = useState<WikiIntelligenceData>({
    countryName,
    infobox: null,
    sections: [],
    lastUpdated: 0,
    confidence: 0,
    isLoading: true,
    error: undefined
  });
  
  const [activeView, setActiveView] = useState<'infobox' | 'sections' | 'conflicts'>('infobox');
  const [refreshing, setRefreshing] = useState(false);

  // Initialize wiki service
  const wikiService = useMemo(() => new IxnayWikiService(), []);

  // Load wiki data
  useEffect(() => {
    const loadWikiData = async () => {
      try {
        setWikiData(prev => ({ ...prev, isLoading: true, error: undefined }));
        
        console.log(`[WikiIntelligence] Loading data for: ${countryName}`);
        
        // Get country infobox
        const infobox = await wikiService.getCountryInfobox(countryName);
        console.log(`[WikiIntelligence] Infobox loaded:`, infobox ? 'Success' : 'Failed');
        
        // Mock sections for now - will implement real section extraction later
        const mockSections: WikiSection[] = [
          {
            id: 'geography',
            title: 'Geography',
            content: `${countryName} is located in ${countryData.continent || 'an undisclosed region'}. The country covers a significant area with diverse geographical features including mountains, plains, and coastal regions.`,
            classification: 'PUBLIC',
            importance: 'high',
            lastModified: new Date().toISOString(),
            wordCount: 150
          },
          {
            id: 'government',
            title: 'Government',
            content: `The government of ${countryName} operates under a ${countryData.governmentType || 'democratic'} system. ${countryData.leader ? `The current leader is ${countryData.leader}.` : 'Leadership information is updated regularly.'} The political structure maintains stability while adapting to modern governance needs.`,
            classification: 'PUBLIC',
            importance: 'high',
            lastModified: new Date().toISOString(),
            wordCount: 120
          },
          {
            id: 'economy',
            title: 'Economy',
            content: `${countryName} maintains a ${countryData.economicTier.toLowerCase()} economy with a GDP per capita of approximately $${countryData.currentGdpPerCapita.toLocaleString()}. The economy demonstrates strong fundamentals with diverse sectors contributing to growth.`,
            classification: viewerClearanceLevel !== 'PUBLIC' ? 'RESTRICTED' : 'PUBLIC',
            importance: 'critical',
            lastModified: new Date().toISOString(),
            wordCount: 200
          }
        ];
        
        setWikiData({
          countryName,
          infobox,
          sections: mockSections,
          lastUpdated: Date.now(),
          confidence: infobox ? 85 : 45,
          isLoading: false,
          error: undefined
        });
        
      } catch (error) {
        console.error(`[WikiIntelligence] Error loading data for ${countryName}:`, error);
        setWikiData(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load wiki data'
        }));
      }
    };

    loadWikiData();
  }, [countryName, wikiService, countryData, viewerClearanceLevel]);

  // Calculate data conflicts
  const dataConflicts: DataConflict[] = useMemo(() => {
    if (!wikiData.infobox) return [];
    
    const conflicts: DataConflict[] = [];
    
    // Check population conflicts
    if (wikiData.infobox.population_estimate) {
      const wikiPop = parseInt(wikiData.infobox.population_estimate.replace(/[^0-9]/g, ''));
      const ixStatsPop = countryData.currentPopulation;
      if (Math.abs(wikiPop - ixStatsPop) / ixStatsPop > 0.1) { // 10% difference
        conflicts.push({
          field: 'Population',
          wikiValue: wikiData.infobox.population_estimate,
          ixStatsValue: ixStatsPop.toLocaleString(),
          type: 'value_mismatch',
          severity: 'high'
        });
      }
    }
    
    // Check capital conflicts
    if (wikiData.infobox.capital && countryData.capital) {
      if (wikiData.infobox.capital.toLowerCase() !== countryData.capital.toLowerCase()) {
        conflicts.push({
          field: 'Capital',
          wikiValue: wikiData.infobox.capital,
          ixStatsValue: countryData.capital,
          type: 'value_mismatch',
          severity: 'medium'
        });
      }
    }
    
    // Check government type conflicts
    if (wikiData.infobox.government_type && countryData.governmentType) {
      if (!wikiData.infobox.government_type.toLowerCase().includes(countryData.governmentType.toLowerCase())) {
        conflicts.push({
          field: 'Government Type',
          wikiValue: wikiData.infobox.government_type,
          ixStatsValue: countryData.governmentType,
          type: 'value_mismatch',
          severity: 'low'
        });
      }
    }
    
    return conflicts;
  }, [wikiData.infobox, countryData]);

  // Refresh wiki data
  const handleRefresh = async () => {
    setRefreshing(true);
    // Force refresh by clearing cache (implementation would depend on service)
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
    window.location.reload(); // Temporary - would implement proper refresh
  };

  // Check access permissions
  const hasAccess = (classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL') => {
    const levels = { 'PUBLIC': 1, 'RESTRICTED': 2, 'CONFIDENTIAL': 3 };
    return levels[viewerClearanceLevel] >= levels[classification];
  };

  if (wikiData.isLoading) {
    return (
      <div className="space-y-6">
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (wikiData.error) {
    return (
      <Card className="glass-hierarchy-child">
        <CardContent className="p-8 text-center">
          <RiAlertLine className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <h3 className="text-lg font-semibold mb-2">Wiki Intelligence Unavailable</h3>
          <p className="text-muted-foreground mb-4">{wikiData.error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RiRefreshLine className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-hierarchy-child rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <RiBookOpenLine className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Wiki Intelligence</h2>
              <p className="text-sm text-muted-foreground">
                MediaWiki integration • Confidence: {wikiData.confidence}%
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
              {wikiData.infobox ? 'CONNECTED' : 'LIMITED'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
            >
              <RiRefreshLine className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'infobox', label: 'Country Infobox', icon: RiInformationLine },
            { id: 'sections', label: 'Strategic Sections', icon: RiBookOpenLine },
            { id: 'conflicts', label: `Data Analysis ${dataConflicts.length > 0 ? `(${dataConflicts.length})` : ''}`, icon: RiShieldLine }
          ].map((view) => {
            const ViewIcon = view.icon;
            return (
              <Button
                key={view.id}
                variant={activeView === view.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView(view.id as any)}
                className="flex items-center gap-2"
              >
                <ViewIcon className="h-4 w-4" />
                {view.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeView === 'infobox' && (
            <div className="space-y-6">
              {wikiData.infobox ? (
                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RiGlobalLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                      Country Infobox Intelligence
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Government Section */}
                      {(wikiData.infobox.government_type || wikiData.infobox.leader_name1 || wikiData.infobox.capital) && (
                        <div className="space-y-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <RiBuildingLine className="h-4 w-4" style={{ color: flagColors.secondary }} />
                            Government Intelligence
                          </h4>
                          <div className="space-y-2 text-sm">
                            {wikiData.infobox.government_type && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">System:</span>
                                <span>{wikiData.infobox.government_type}</span>
                              </div>
                            )}
                            {wikiData.infobox.leader_name1 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Leader:</span>
                                <span>{wikiData.infobox.leader_name1}</span>
                              </div>
                            )}
                            {wikiData.infobox.capital && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Capital:</span>
                                <span>{wikiData.infobox.capital}</span>
                              </div>
                            )}
                            {wikiData.infobox.leader_title1 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Title:</span>
                                <span>{wikiData.infobox.leader_title1}</span>
                              </div>
                            )}
                            {wikiData.infobox.established_date1 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Established:</span>
                                <span>{wikiData.infobox.established_date1}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Geographic Section */}
                      {(wikiData.infobox.continent || wikiData.infobox.area_km2 || wikiData.infobox.population_estimate) && (
                        <div className="space-y-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <RiMapLine className="h-4 w-4" style={{ color: flagColors.accent }} />
                            Geographic Intelligence
                          </h4>
                          <div className="space-y-2 text-sm">
                            {wikiData.infobox.continent && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Continent:</span>
                                <span>{wikiData.infobox.continent}</span>
                              </div>
                            )}
                            {wikiData.infobox.area_km2 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Area:</span>
                                <span>{wikiData.infobox.area_km2} km²</span>
                              </div>
                            )}
                            {wikiData.infobox.population_estimate && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Population:</span>
                                <span>{wikiData.infobox.population_estimate}</span>
                              </div>
                            )}
                            {wikiData.infobox.area_total && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Area:</span>
                                <span>{wikiData.infobox.area_total}</span>
                              </div>
                            )}
                            {wikiData.infobox.population_density && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Density:</span>
                                <span>{wikiData.infobox.population_density}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Economic Section */}
                      {(wikiData.infobox.currency || wikiData.infobox.gdp_nominal || wikiData.infobox.GDP_PPP_per_capita) && (
                        <div className="space-y-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <RiMoneyDollarCircleLine className="h-4 w-4" style={{ color: flagColors.primary }} />
                            Economic Intelligence
                          </h4>
                          <div className="space-y-2 text-sm">
                            {wikiData.infobox.currency && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Currency:</span>
                                <span>{wikiData.infobox.currency}</span>
                              </div>
                            )}
                            {wikiData.infobox.gdp_nominal && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">GDP (Nominal):</span>
                                <span>{wikiData.infobox.gdp_nominal}</span>
                              </div>
                            )}
                            {wikiData.infobox.GDP_PPP_per_capita && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">GDP PPP per Capita:</span>
                                <span>{wikiData.infobox.GDP_PPP_per_capita}</span>
                              </div>
                            )}
                            {wikiData.infobox.ethnic_groups && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Ethnic Groups:</span>
                                <span>{wikiData.infobox.ethnic_groups}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Cultural Section */}
                      {(wikiData.infobox.official_languages || wikiData.infobox.religion || wikiData.infobox.currency) && (
                        <div className="space-y-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <RiHeartLine className="h-4 w-4" style={{ color: flagColors.primary }} />
                            Cultural Intelligence
                          </h4>
                          <div className="space-y-2 text-sm">
                            {wikiData.infobox.official_languages && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Languages:</span>
                                <span>{wikiData.infobox.official_languages}</span>
                              </div>
                            )}
                            {wikiData.infobox.religion && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Religion:</span>
                                <span>{wikiData.infobox.religion}</span>
                              </div>
                            )}
                            {wikiData.infobox.time_zone && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Time Zone:</span>
                                <span>{wikiData.infobox.time_zone}</span>
                              </div>
                            )}
                            {wikiData.infobox.calling_code && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Calling Code:</span>
                                <span>{wikiData.infobox.calling_code}</span>
                              </div>
                            )}
                            {wikiData.infobox.cctld && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Domain:</span>
                                <span>{wikiData.infobox.cctld}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Raw infobox data for advanced users */}
                    {viewerClearanceLevel !== 'PUBLIC' && (
                      <div className="mt-6 pt-6 border-t border-border/50">
                        <details className="group">
                          <summary className="cursor-pointer text-sm font-medium text-muted-foreground group-open:text-foreground">
                            Raw Intelligence Data ({Object.keys(wikiData.infobox).length} fields)
                          </summary>
                          <div className="mt-3 p-3 bg-muted/30 rounded text-xs font-mono max-h-64 overflow-auto">
                            <pre>{JSON.stringify(wikiData.infobox, null, 2)}</pre>
                          </div>
                        </details>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass-hierarchy-child">
                  <CardContent className="p-8 text-center">
                    <RiBookOpenLine className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Infobox Data Available</h3>
                    <p className="text-muted-foreground mb-4">
                      Wiki infobox data could not be retrieved for {countryName}.
                    </p>
                    <Button onClick={handleRefresh} variant="outline">
                      <RiRefreshLine className="h-4 w-4 mr-2" />
                      Retry Connection
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeView === 'sections' && (
            <div className="space-y-4">
              {wikiData.sections
                .filter(section => hasAccess(section.classification))
                .map((section) => {
                const SectionIcon = SECTION_ICONS[section.id as keyof typeof SECTION_ICONS] || SECTION_ICONS.default;
                return (
                  <Card key={section.id} className="glass-hierarchy-child">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <SectionIcon className="h-5 w-5" style={{ color: flagColors.primary }} />
                          {section.title}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline"
                            className={cn(
                              "text-xs",
                              CLASSIFICATION_STYLES[section.classification].color
                            )}
                          >
                            {section.classification}
                          </Badge>
                          <Badge 
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              section.importance === 'critical' && "bg-red-500/20 text-red-400",
                              section.importance === 'high' && "bg-orange-500/20 text-orange-400",
                              section.importance === 'medium' && "bg-blue-500/20 text-blue-400",
                              section.importance === 'low' && "bg-gray-500/20 text-gray-400"
                            )}
                          >
                            {section.importance.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{section.content}</p>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{section.wordCount} words</span>
                          <span>Last modified: {new Date(section.lastModified).toLocaleDateString()}</span>
                        </div>
                        <Button variant="ghost" size="sm">
                          <RiExternalLinkLine className="h-4 w-4 mr-2" />
                          View Full Article
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {activeView === 'conflicts' && (
            <div className="space-y-6">
              {dataConflicts.length > 0 ? (
                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RiShieldLine className="h-5 w-5 text-orange-400" />
                      Data Intelligence Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dataConflicts.map((conflict, index) => (
                        <div 
                          key={index}
                          className={cn(
                            "p-4 rounded-lg border-l-4",
                            conflict.severity === 'high' && "border-red-500 bg-red-500/10",
                            conflict.severity === 'medium' && "border-yellow-500 bg-yellow-500/10",
                            conflict.severity === 'low' && "border-blue-500 bg-blue-500/10"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{conflict.field} Discrepancy</h4>
                              <div className="mt-2 space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Wiki:</span>
                                  <span>{conflict.wikiValue || 'Not specified'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">IxStats:</span>
                                  <span>{conflict.ixStatsValue || 'Not specified'}</span>
                                </div>
                              </div>
                            </div>
                            <Badge 
                              variant="outline"
                              className={cn(
                                "ml-4",
                                conflict.severity === 'high' && "border-red-500/30 text-red-400",
                                conflict.severity === 'medium' && "border-yellow-500/30 text-yellow-400",
                                conflict.severity === 'low' && "border-blue-500/30 text-blue-400"
                              )}
                            >
                              {conflict.severity.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass-hierarchy-child">
                  <CardContent className="p-8 text-center">
                    <RiShieldLine className="h-12 w-12 mx-auto mb-4 text-green-400" />
                    <h3 className="text-lg font-semibold mb-2">Data Integrity Confirmed</h3>
                    <p className="text-muted-foreground">
                      No significant conflicts detected between Wiki and IxStats data.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Footer */}
      <div className="glass-hierarchy-child rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Wiki data last updated: {IxTime.formatIxTime(wikiData.lastUpdated, true)} • 
            Confidence: {wikiData.confidence}%
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              MediaWiki API
            </Badge>
            <Badge variant="outline" className="text-xs">
              {wikiData.sections.length} sections
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WikiIntelligenceTab;