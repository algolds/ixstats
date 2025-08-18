"use client";

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import { BarChart3, LineChart, PieChart, Settings, Palette, Play } from 'lucide-react';
import {
  GlassChart,
  GlassBarChart,
  GlassLineChart,
  GlassPieChart,
  GoogleLineChart,
  GoogleBarChart,
  GooglePieChart,
  GoogleGeoChart,
  GoogleGaugeChart,
  GoogleAreaChart,
  GlassNumberPicker,
  GlassDial,
  GlassToggle,
  GlassSlider,
  type ChartTheme
} from './index';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../glass/GlassCard';

interface ChartShowcaseProps {
  className?: string;
}

// Sample data for demonstrations
const sampleData = {
  bar: [
    { name: 'Jan', value: 400, value2: 240 },
    { name: 'Feb', value: 300, value2: 139 },
    { name: 'Mar', value: 200, value2: 980 },
    { name: 'Apr', value: 278, value2: 390 },
    { name: 'May', value: 189, value2: 480 },
    { name: 'Jun', value: 239, value2: 380 }
  ],
  line: [
    { name: 'Jan', gdp: 2400, population: 2400 },
    { name: 'Feb', gdp: 1398, population: 2210 },
    { name: 'Mar', gdp: 9800, population: 2290 },
    { name: 'Apr', gdp: 3908, population: 2000 },
    { name: 'May', gdp: 4800, population: 2181 },
    { name: 'Jun', gdp: 3800, population: 2500 }
  ],
  pie: [
    { name: 'Healthcare', value: 30 },
    { name: 'Education', value: 25 },
    { name: 'Defense', value: 20 },
    { name: 'Infrastructure', value: 15 },
    { name: 'Other', value: 10 }
  ],
  google: {
    line: [
      ['Month', 'GDP Growth', 'Population Growth'],
      ['Jan', 1000, 400],
      ['Feb', 1170, 460],
      ['Mar', 660, 1120],
      ['Apr', 1030, 540],
      ['May', 1230, 620],
      ['Jun', 1450, 720]
    ],
    pie: [
      ['Category', 'Percentage'],
      ['Healthcare', 30],
      ['Education', 25],
      ['Defense', 20],
      ['Infrastructure', 15],
      ['Other', 10]
    ],
    geo: [
      ['Country', 'Economic Score'],
      ['United States', 85],
      ['China', 82],
      ['Germany', 78],
      ['Japan', 75],
      ['United Kingdom', 72],
      ['France', 70],
      ['India', 65],
      ['Brazil', 60]
    ],
    gauge: [
      ['Label', 'Value'],
      ['Economic Health', 74]
    ]
  }
};

export function ChartShowcase({ className }: ChartShowcaseProps) {
  const [selectedTheme, setSelectedTheme] = useState<ChartTheme>('default');
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [chartHeight, setChartHeight] = useState(300);
  const [sampleValue1, setSampleValue1] = useState(50);
  const [sampleValue2, setSampleValue2] = useState(75);
  const [dialValue, setDialValue] = useState(60);
  const [toggleValue, setToggleValue] = useState(true);

  const themes: ChartTheme[] = ['default', 'gold', 'blue', 'emerald', 'purple'];

  const chartSections = [
    {
      title: 'Recharts Integration',
      description: 'Interactive charts with React and smooth animations',
      charts: [
        {
          title: 'Glass Bar Chart',
          icon: BarChart3,
          component: (
            <GlassBarChart
              data={sampleData.bar}
              xKey="name"
              yKey={['value', 'value2']}
              title="Monthly Performance"
              description="Comparing two metrics over time"
              height={chartHeight}
              theme={selectedTheme}
            />
          )
        },
        {
          title: 'Glass Line Chart',
          icon: LineChart,
          component: (
            <GlassLineChart
              data={sampleData.line}
              xKey="name"
              yKey={['gdp', 'population']}
              title="Economic Trends"
              description="GDP and population growth patterns"
              height={chartHeight}
              theme={selectedTheme}
              area={false}
            />
          )
        },
        {
          title: 'Glass Pie Chart',
          icon: PieChart,
          component: (
            <GlassPieChart
              data={sampleData.pie}
              dataKey="value"
              nameKey="name"
              title="Budget Allocation"
              description="Government spending by category"
              height={chartHeight}
              theme={selectedTheme}
            />
          )
        }
      ]
    },
    {
      title: 'Google Charts Integration',
      description: 'Professional charts with Google Charts API',
      charts: [
        {
          title: 'Google Line Chart',
          icon: LineChart,
          component: (
            <GoogleLineChart
              data={sampleData.google.line}
              title="Growth Metrics"
              description="Economic indicators over time"
              height={chartHeight}
              theme={selectedTheme}
            />
          )
        },
        {
          title: 'Google Area Chart',
          icon: BarChart3,
          component: (
            <GoogleAreaChart
              data={sampleData.google.line}
              title="Cumulative Growth"
              description="Stacked area representation"
              height={chartHeight}
              theme={selectedTheme}
              stacked={true}
            />
          )
        },
        {
          title: 'Google Geo Chart',
          icon: BarChart3,
          component: (
            <GoogleGeoChart
              data={sampleData.google.geo}
              title="Global Economic Scores"
              description="World economic performance map"
              height={chartHeight}
              theme={selectedTheme}
              region="world"
            />
          )
        },
        {
          title: 'Google Gauge Chart',
          icon: PieChart,
          component: (
            <GoogleGaugeChart
              data={sampleData.google.gauge}
              title="Economic Health Indicator"
              description="Real-time economic status gauge"
              height={chartHeight}
              theme={selectedTheme}
              min={0}
              max={100}
            />
          )
        }
      ]
    }
  ];

  return (
    <div className={cn('space-y-8', className)}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
          Chart & Control Showcase
        </h1>
        <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto">
          Comprehensive data visualization library with glass physics integration,
          interactive controls, and multiple chart library support.
        </p>
      </motion.div>

      {/* Global Controls */}
      <GlassCard depth="elevated" className="sticky top-4 z-50">
        <GlassCardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-[var(--color-brand-primary)]" />
              <h3 className="font-semibold text-[var(--color-text-primary)]">
                Global Settings
              </h3>
            </div>
            <GlassToggle
              checked={showControls}
              onChange={setShowControls}
              label="Show Controls"
              size="sm"
              theme={selectedTheme}
            />
          </div>
        </GlassCardHeader>
        
        {showControls && (
          <GlassCardContent>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {/* Theme Selector */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  <Palette className="h-4 w-4 inline mr-2" />
                  Chart Theme
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {themes.map((theme) => (
                    <motion.button
                      key={theme}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedTheme(theme)}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        selectedTheme === theme
                          ? 'border-white shadow-lg scale-110'
                          : 'border-[var(--color-border-primary)] hover:border-[var(--color-border-secondary)]'
                      )}
                      style={{
                        backgroundColor: 
                          theme === 'default' ? 'hsl(var(--color-brand-primary-hsl))' :
                          theme === 'gold' ? '#F59E0B' :
                          theme === 'blue' ? '#3B82F6' :
                          theme === 'emerald' ? '#10B981' :
                          theme === 'purple' ? '#8B5CF6' : 'hsl(var(--color-brand-primary-hsl))'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Chart Height */}
              <GlassNumberPicker
                label="Chart Height"
                value={chartHeight}
                onChange={setChartHeight}
                min={200}
                max={500}
                step={50}
                unit="px"
                theme={selectedTheme}
              />

              {/* Animation Speed */}
              <GlassSlider
                label="Animation Speed"
                value={animationSpeed}
                onChange={setAnimationSpeed}
                min={0.5}
                max={2}
                step={0.1}
                unit="x"
                theme={selectedTheme}
              />

              {/* Sample Dial */}
              <GlassDial
                label="Sample Dial"
                value={dialValue}
                onChange={setDialValue}
                min={0}
                max={100}
                unit="%"
                theme={selectedTheme}
              />
            </motion.div>
          </GlassCardContent>
        )}
      </GlassCard>

      {/* Interactive Controls Demo */}
      {showControls && (
        <GlassCard depth="base">
          <GlassCardHeader>
            <h3 className="font-semibold text-[var(--color-text-primary)]">
              Interactive Controls Demo
            </h3>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <GlassNumberPicker
                label="Sample Number"
                value={sampleValue1}
                onChange={setSampleValue1}
                min={0}
                max={100}
                step={5}
                unit="%"
                theme={selectedTheme}
              />

              <GlassSlider
                label="Sample Slider"
                value={sampleValue2}
                onChange={setSampleValue2}
                min={0}
                max={100}
                step={1}
                unit="%"
                theme={selectedTheme}
                showTicks={true}
                tickCount={6}
              />

              <GlassDial
                label="Interactive Dial"
                value={dialValue}
                onChange={setDialValue}
                min={0}
                max={100}
                unit="%"
                theme={selectedTheme}
                size="lg"
              />

              <GlassToggle
                label="Feature Toggle"
                description="Enable advanced features"
                checked={toggleValue}
                onChange={setToggleValue}
                theme={selectedTheme}
                size="lg"
              />
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Chart Sections */}
      {chartSections.map((section, sectionIndex) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sectionIndex * 0.2 }}
          className="space-y-6"
        >
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {section.title}
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              {section.description}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {section.charts.map((chart, chartIndex) => (
              <motion.div
                key={chart.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  delay: (sectionIndex * 0.2) + (chartIndex * 0.1),
                  duration: 0.5 * animationSpeed
                }}
              >
                {chart.component}
              </motion.div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Performance Stats */}
      <GlassCard depth="base">
        <GlassCardHeader>
          <h3 className="font-semibold text-[var(--color-text-primary)]">
            Component Performance
          </h3>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-[var(--color-success)]">
                {chartSections.reduce((acc, section) => acc + section.charts.length, 0)}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Active Charts
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--color-brand-primary)]">
                {themes.length}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Available Themes
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--color-warning)]">
                {showControls ? '4' : '0'}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Interactive Controls
              </div>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}