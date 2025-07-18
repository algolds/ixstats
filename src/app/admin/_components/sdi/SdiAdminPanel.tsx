import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs';
import { GlassCard, EnhancedCard } from '~/components/ui/enhanced-card';
import { Cover } from '~/components/ui/cover';
import { SdiCrisisAdmin } from './SdiCrisisAdmin';
import { SdiIntelligenceAdmin } from './SdiIntelligenceAdmin';
import { SdiEconomicAdmin } from './SdiEconomicAdmin';
import { SdiDiplomaticAdmin } from './SdiDiplomaticAdmin';

export function SdiAdminPanel() {
  const [tab, setTab] = useState('crisis');
  return (
    <GlassCard variant="diplomatic" className="mb-8">
      <div className="p-6">
        <Cover className="text-2xl font-bold mb-2">SDI Data Management</Cover>
        <div className="text-lg text-muted-foreground mb-4">Administer all SDI modules in real time</div>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-4 bg-gradient-to-r from-blue-500/20 via-green-400/20 to-purple-400/20 shadow-glass-lg">
            <TabsTrigger value="crisis">Crisis</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="economic">Economic</TabsTrigger>
            <TabsTrigger value="diplomatic">Diplomatic</TabsTrigger>
          </TabsList>
          <TabsContent value="crisis"><SdiCrisisAdmin /></TabsContent>
          <TabsContent value="intelligence"><SdiIntelligenceAdmin /></TabsContent>
          <TabsContent value="economic"><SdiEconomicAdmin /></TabsContent>
          <TabsContent value="diplomatic"><SdiDiplomaticAdmin /></TabsContent>
        </Tabs>
      </div>
    </GlassCard>
  );
} 