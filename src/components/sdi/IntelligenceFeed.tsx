import React from 'react';
import { GlassCard } from '../ui/enhanced-card';
import { InfiniteMovingCards } from '../ui/infinite-moving-cards';

const mockFeed = [
  {
    quote: 'Major trade agreement signed between Latium and Sarpedon.',
    name: 'Economic Intelligence Division',
    title: 'Economic',
  },
  {
    quote: 'Severe flooding impacts three nations in the Sarpedon region.',
    name: 'Crisis Management Center',
    title: 'Crisis',
  },
  {
    quote: 'New diplomatic envoy established with the United Republics.',
    name: 'Diplomatic Relations Matrix',
    title: 'Diplomacy',
  },
  {
    quote: 'Cyber threat level raised for all advanced nations.',
    name: 'Strategic Threat Assessment',
    title: 'Security',
  },
  {
    quote: 'Global GDP growth forecast revised upward.',
    name: 'Economic Intelligence Division',
    title: 'Economic',
  },
  {
    quote: 'International summit on climate change announced.',
    name: 'Global Events Calendar',
    title: 'Events',
  },
];

// Map feed to add a unique key
const feedWithKeys = mockFeed.map((item, idx) => ({ ...item, key: `${item.name}-${item.title}-${idx}` }));

export default function IntelligenceFeed() {
  return (
    <GlassCard variant="diplomatic" blur="prominent" glow="hover" className="p-0 lg:p-0 sdi-hero-card overflow-hidden relative animate-fade-in">
      {/* Aurora overlay for cinematic effect */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="aurora-bg opacity-40" />
      </div>
      <div className="relative z-10 p-8 lg:p-12">
        <h2 className="text-3xl font-bold mb-8 text-blue-100 tracking-tight diplomatic-header">Intelligence Feed</h2>
        <InfiniteMovingCards
          items={feedWithKeys}
          direction="left"
          speed="normal"
          pauseOnHover={true}
          className="bg-transparent sdi-intel-feed"
        />
      </div>
    </GlassCard>
  );
} 