"use client";

import React from 'react';
import { Crown, Lock, Star, Zap, Shield, TrendingUp, Users, Globe, ArrowRight } from 'lucide-react';
import { GlassButton } from './glass-button';

interface PremiumGateProps {
  feature: 'sdi' | 'eci' | 'intelligence' | 'analytics';
  title?: string;
  description?: string;
  className?: string;
}

const featureConfig = {
  sdi: {
    icon: Shield,
    title: 'SDI Dashboard',
    description: 'Access real-time crisis monitoring, diplomatic intelligence, and security analytics',
    features: [
      'Real-time crisis monitoring',
      'Diplomatic intelligence feeds',
      'Security threat assessment',
      'International economic indicators'
    ],
    color: 'from-red-500/20 to-red-600/20',
    iconColor: 'text-red-400'
  },
  eci: {
    icon: TrendingUp,
    title: 'ECI Command Center',
    description: 'Executive control interface with AI-powered policy recommendations and analytics',
    features: [
      'AI policy recommendations',
      'Executive decision support',
      'Predictive economic modeling',
      'Strategic planning tools'
    ],
    color: 'from-indigo-500/20 to-indigo-600/20',
    iconColor: 'text-indigo-400'
  },
  intelligence: {
    icon: Globe,
    title: 'Intelligence Network',
    description: 'Comprehensive intelligence gathering and analysis system',
    features: [
      'Global intelligence feeds',
      'Secure messaging system',
      'Classified information access',
      'Intelligence analytics'
    ],
    color: 'from-purple-500/20 to-purple-600/20',
    iconColor: 'text-purple-400'
  },
  analytics: {
    icon: Zap,
    title: 'Advanced Analytics',
    description: 'Deep data insights and advanced visualization tools',
    features: [
      'Advanced data modeling',
      'Custom dashboards',
      'Export capabilities',
      'Historical trend analysis'
    ],
    color: 'from-green-500/20 to-green-600/20',
    iconColor: 'text-green-400'
  }
};

export function PremiumGate({ feature, title, description, className = '' }: PremiumGateProps) {
  const config = featureConfig[feature];
  const Icon = config.icon;

  return (
    <div className={`relative min-h-[400px] flex items-center justify-center p-8 ${className}`}>
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.color} rounded-xl`} />

      {/* Glass Effect */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10" />

      {/* Content */}
      <div className="relative z-10 max-w-lg text-center space-y-6">
        {/* Lock Icon */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-black/20 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-white/60" />
            </div>
            <div className="absolute -top-1 -right-1">
              <Crown className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Feature Icon */}
        <div className="flex justify-center">
          <Icon className={`w-12 h-12 ${config.iconColor}`} />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white">
          {title || config.title}
        </h2>

        {/* Description */}
        <p className="text-white/80 text-lg leading-relaxed">
          {description || config.description}
        </p>

        {/* Features List */}
        <div className="space-y-3 text-left">
          {config.features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-3">
              <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-white/90">{feature}</span>
            </div>
          ))}
        </div>

        {/* Premium Badge */}
        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full border border-yellow-400/30">
          <Crown className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-200 font-semibold">MyCountry Premium Required</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <GlassButton
            variant="primary"
            className="flex-1 group"
            onClick={() => {
              // TODO: Implement upgrade flow
              alert('Premium upgrade flow will be implemented here');
            }}
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Premium
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </GlassButton>

          <GlassButton
            variant="secondary"
            className="flex-1"
            onClick={() => {
              // TODO: Implement learn more
              alert('Learn more about premium features');
            }}
          >
            <Users className="w-4 h-4 mr-2" />
            Learn More
          </GlassButton>
        </div>

        {/* Pricing Hint */}
        <p className="text-white/60 text-sm">
          Starting at $9.99/month • Cancel anytime
        </p>
      </div>
    </div>
  );
}

export default PremiumGate;