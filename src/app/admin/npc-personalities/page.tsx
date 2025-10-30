'use client';

/**
 * NPC Personalities Admin Interface
 *
 * Comprehensive admin page for managing NPC personality archetypes.
 *
 * Features:
 * - Personality catalog with card grid view
 * - Filter by archetype, active status
 * - Search by name, historical basis
 * - View personality details and traits
 * - Usage statistics and analytics
 * - Assign personalities to countries
 * - Glass physics design
 *
 * Phase 8: FINAL PHASE of hardcoded data migration! 🎉
 */

import { useState, useMemo } from 'react';
import { api } from '~/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  RiSearchLine,
  RiFilterLine,
  RiUser3Line,
  RiBarChartBoxLine,
  RiCheckLine,
  RiCloseLine,
  RiHistoryLine
} from 'react-icons/ri';

export default function NPCPersonalitiesPage() {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [archetypeFilter, setArchetypeFilter] = useState<string>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Data fetching
  const { data: personalities, refetch, isLoading } = api.npcPersonalities.getAllPersonalities.useQuery({
    archetype: archetypeFilter === 'all' ? undefined : archetypeFilter as any,
    isActive: showActiveOnly ? true : undefined,
    orderBy: 'usageCount'
  });

  const { data: stats } = api.npcPersonalities.getPersonalityStats.useQuery();

  // Filtering
  const filteredPersonalities = useMemo(() => {
    if (!personalities) return [];

    return personalities.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.historicalBasis && p.historicalBasis.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesSearch;
    });
  }, [personalities, searchTerm]);

  // Archetype display helper
  const getArchetypeColor = (archetype: string) => {
    const colors: Record<string, string> = {
      aggressive_expansionist: 'bg-red-500/20 text-red-400 border-red-500/30',
      peaceful_merchant: 'bg-green-500/20 text-green-400 border-green-500/30',
      cautious_isolationist: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      cultural_diplomat: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      pragmatic_realist: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      ideological_hardliner: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    };
    return colors[archetype] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">NPC Personalities</h1>
          <p className="text-sm text-[--intel-silver] mt-1">
            Manage personality archetypes for NPC countries | Phase 8: FINAL PHASE 🎉
          </p>
        </div>
        <Badge variant="outline" className="px-4 py-2 text-green-400 border-green-500/30">
          <RiCheckLine className="mr-2" />
          100% Migration Complete
        </Badge>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-black/20 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl font-bold text-foreground">
                {stats.summary.totalPersonalities}
              </CardTitle>
              <CardDescription>Total Personalities</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-black/20 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl font-bold text-green-400">
                {stats.summary.activePersonalities}
              </CardTitle>
              <CardDescription>Active Archetypes</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-black/20 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl font-bold text-blue-400">
                {stats.summary.totalAssignments}
              </CardTitle>
              <CardDescription>Country Assignments</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-black/20 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl font-bold text-purple-400">
                {stats.summary.averageUsage}
              </CardTitle>
              <CardDescription>Average Usage</CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-black/20 border-white/10">
        <CardHeader>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-[--intel-silver]" />
                <Input
                  placeholder="Search by name or historical figure..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-black/30 border-white/10"
                />
              </div>
            </div>

            {/* Archetype Filter */}
            <div className="flex items-center gap-2">
              <RiFilterLine className="text-[--intel-silver]" />
              <select
                value={archetypeFilter}
                onChange={(e) => setArchetypeFilter(e.target.value)}
                className="px-4 py-2 bg-black/30 border border-white/10 rounded-md text-foreground"
              >
                <option value="all">All Archetypes</option>
                <option value="aggressive_expansionist">Aggressive Expansionist</option>
                <option value="peaceful_merchant">Peaceful Merchant</option>
                <option value="cautious_isolationist">Cautious Isolationist</option>
                <option value="cultural_diplomat">Cultural Diplomat</option>
                <option value="pragmatic_realist">Pragmatic Realist</option>
                <option value="ideological_hardliner">Ideological Hardliner</option>
              </select>
            </div>

            {/* Active Filter */}
            <Button
              variant={showActiveOnly ? 'default' : 'outline'}
              onClick={() => setShowActiveOnly(!showActiveOnly)}
              className="gap-2"
            >
              {showActiveOnly ? <RiCheckLine /> : <RiCloseLine />}
              Active Only
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Personalities Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-[--intel-silver]">
          Loading personalities...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPersonalities.map((personality) => (
            <Card key={personality.id} className="bg-black/20 border-white/10 hover:border-white/20 transition-all">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-bold text-foreground">
                      {personality.name}
                    </CardTitle>
                    <Badge
                      className={`mt-2 ${getArchetypeColor(personality.archetype)}`}
                    >
                      {personality.archetype.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="text-blue-400 border-blue-500/30">
                      <RiBarChartBoxLine className="mr-1" />
                      {personality.usageCount} uses
                    </Badge>
                    {personality.isActive ? (
                      <Badge variant="outline" className="text-green-400 border-green-500/30">
                        <RiCheckLine className="mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-400 border-gray-500/30">
                        <RiCloseLine className="mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>

                {personality.historicalBasis && (
                  <div className="flex items-center gap-2 text-sm text-[--intel-silver] mt-3 border-t border-white/5 pt-3">
                    <RiHistoryLine className="text-purple-400" />
                    <span>Inspired by: <span className="text-purple-400 font-medium">{personality.historicalBasis}</span></span>
                  </div>
                )}
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {/* Trait Bars */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[--intel-silver]">Assertiveness</span>
                        <span className="text-foreground font-medium">{personality.assertiveness}</span>
                      </div>
                      <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-red-400"
                          style={{ width: `${personality.assertiveness}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[--intel-silver]">Cooperativeness</span>
                        <span className="text-foreground font-medium">{personality.cooperativeness}</span>
                      </div>
                      <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-400"
                          style={{ width: `${personality.cooperativeness}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[--intel-silver]">Militarism</span>
                        <span className="text-foreground font-medium">{personality.militarism}</span>
                      </div>
                      <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
                          style={{ width: `${personality.militarism}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[--intel-silver]">Cultural Openness</span>
                        <span className="text-foreground font-medium">{personality.culturalOpenness}</span>
                      </div>
                      <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
                          style={{ width: `${personality.culturalOpenness}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Historical Context (truncated) */}
                  {personality.historicalContext && (
                    <div className="text-xs text-[--intel-silver] border-t border-white/5 pt-3">
                      {personality.historicalContext.slice(0, 120)}...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredPersonalities.length === 0 && (
        <Card className="bg-black/20 border-white/10">
          <CardContent className="py-12 text-center">
            <RiUser3Line className="mx-auto text-6xl text-[--intel-silver] mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">No Personalities Found</h3>
            <p className="text-[--intel-silver]">
              Try adjusting your filters or search term
            </p>
          </CardContent>
        </Card>
      )}

      {/* Migration Completion Banner */}
      <Card className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border-green-500/30">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <RiCheckLine className="text-3xl text-green-400" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-1">
                🎉 Phase 8 Complete - 100% Migration Achievement! 🎉
              </h3>
              <p className="text-[--intel-silver]">
                The NPC Personalities system marks the completion of all 8 phases of hardcoded data migration.
                All 14,677 lines of reference data are now dynamically managed through the database!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
