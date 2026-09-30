"use client";
// src/components/defense/stability/StabilityHelpDialog.tsx

import React from "react";
import {
  Group as Users,
  Shield,
  Activity,
  Heart,
  Eye,
  WarningTriangle as AlertTriangle,
  HelpCircle,
  InfoCircle as Info,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export const StabilityHelpDialog = React.memo(function StabilityHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <HelpCircle className="text-muted-foreground hover:text-primary h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Understanding Internal Stability Metrics
          </DialogTitle>
          <DialogDescription>
            How stability metrics are calculated and what they mean for your country
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {/* Overall Score */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4" />
              Overall Stability Score (0-100)
            </h4>
            <p className="text-muted-foreground">
              A composite metric combining social cohesion (25%), trust in government (20%), low
              crime rates (20%), low ethnic tension (15%), low riot risk (10%), and effective
              policing (10%). Higher scores indicate greater internal stability.
            </p>
            <div className="space-y-1 pl-4 text-xs">
              <p>
                • <strong>80-100:</strong> Highly stable, minimal security concerns
              </p>
              <p>
                • <strong>60-79:</strong> Stable with manageable challenges
              </p>
              <p>
                • <strong>40-59:</strong> Moderate instability, active management needed
              </p>
              <p>
                • <strong>20-39:</strong> Unstable, significant security risks
              </p>
              <p>
                • <strong>0-19:</strong> Critical instability, immediate intervention required
              </p>
            </div>
          </div>

          <Separator />

          {/* Crime Metrics */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <Shield className="h-4 w-4" />
              Crime & Law Enforcement
            </h4>
            <div className="space-y-3 pl-4">
              <div>
                <p className="font-medium">Crime Rate (per 100k population)</p>
                <p className="text-muted-foreground">
                  Calculated from unemployment (x0.8), income inequality (x0.15), poverty (x0.6),
                  and youth unemployment (x0.4). Higher urbanization and lower policing budgets
                  increase crime rates.
                </p>
              </div>
              <div>
                <p className="font-medium">Organized Crime Level (0-100%)</p>
                <p className="text-muted-foreground">
                  Based on corruption (x0.4), political instability (x8), weak institutions (x0.3),
                  and economic desperation (x0.2). High corruption enables organized crime to
                  flourish.
                </p>
              </div>
              <div>
                <p className="font-medium">Policing Effectiveness (0-100%)</p>
                <p className="text-muted-foreground">
                  Determined by policing budget per capita (up to 50%) minus corruption penalties
                  (x0.3). Higher budgets and lower corruption improve effectiveness.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Public Order */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <Activity className="h-4 w-4" />
              Public Order
            </h4>
            <div className="space-y-3 pl-4">
              <div>
                <p className="font-medium">Protest Frequency (events/year)</p>
                <p className="text-muted-foreground">
                  Driven by political polarization (x0.15), unemployment (x0.5), inequality (x8),
                  recent unpopular policies (x0.1), and democracy level (x10). More democratic
                  societies allow more protests.
                </p>
              </div>
              <div>
                <p className="font-medium">Riot Risk (0-100%)</p>
                <p className="text-muted-foreground">
                  Calculated from polarization (x0.3), economic desperation (x0.3), existing crime
                  (x0.2), weak policing (x20), and frequent protests (x0.5). Multiple risk factors
                  compound dangerously.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Social Metrics */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <Heart className="h-4 w-4" />
              Social Cohesion
            </h4>
            <div className="space-y-3 pl-4">
              <div>
                <p className="font-medium">Social Cohesion (0-100%)</p>
                <p className="text-muted-foreground">
                  Economic growth (+3 per %), political stability (+20%), minus penalties for
                  inequality (x30%) and polarization (x0.3). Strong economies and stable politics
                  build cohesion.
                </p>
              </div>
              <div>
                <p className="font-medium">Ethnic Tension (0-100%)</p>
                <p className="text-muted-foreground">
                  Diversity alone doesn't cause tension (x0.15), but economic scarcity (x0.3),
                  inequality (x0.2), and political polarization (x0.2) can inflame it. Address root
                  economic causes.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Trust Metrics */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <Eye className="h-4 w-4" />
              Public Confidence
            </h4>
            <div className="space-y-3 pl-4">
              <div>
                <p className="font-medium">Trust in Government (0-100%)</p>
                <p className="text-muted-foreground">
                  Democracy (+30%), economic growth (+4 per %), political stability (+20%), minus
                  corruption (x0.4) and polarization (x0.15). Corruption is the biggest destroyer of
                  trust.
                </p>
              </div>
              <div>
                <p className="font-medium">Trust in Police (0-100%)</p>
                <p className="text-muted-foreground">
                  Effective policing (+0.5 per %), minus corruption (x0.35) and high crime (x0.2).
                  Corruption in law enforcement is particularly damaging.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Event Generation */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Automatic Security Event System
            </h4>
            <p className="text-muted-foreground">
              <strong>Events are generated automatically</strong> based on your country's actual
              metrics using advanced Markov chains and NPC threat actor personalities. The system
              continuously monitors stability conditions and triggers events when thresholds are
              crossed or conditions align.
            </p>
            <div className="mt-2 space-y-2 pl-4 text-xs">
              <p className="font-medium">Automatic Triggers:</p>
              <p>
                • <strong>Threshold Triggers:</strong> Critical instability (score &lt;30), severe
                crime (&gt;800), high riot risk (&gt;70%), ethnic tensions (&gt;75%), weak borders,
                cyber vulnerability
              </p>
              <p>
                • <strong>Cascade Triggers:</strong> Multiple crisis conditions converging (Perfect
                Storm, Security Vacuum, Failed State scenarios)
              </p>
              <p>
                • <strong>Cooldown System:</strong> Prevents event spam with 2-day minimum cooldown
                between events, 7-day category cooldown, max 5 events per 30 days
              </p>
              <p className="mt-2 font-medium">Event Severity:</p>
              <p>
                • <strong>Critical/Existential:</strong> 50-500 casualties, massive economic impact,
                immediate response required
              </p>
              <p>
                • <strong>High Severity:</strong> 10-100 casualties, significant disruption
              </p>
              <p>
                • <strong>Moderate:</strong> 2-20 casualties, localized impact
              </p>
              <p>
                • <strong>Low:</strong> Minimal casualties, routine incidents
              </p>
              <p className="mt-2 font-medium">NPC Threat Actors:</p>
              <p>
                Each event features unique threat actors with personalities: Jihadist Cells,
                Separatist Movements, Organized Crime, Cyber Attackers, Foreign Agents, Lone Wolves.
                Their behavior adapts to your country's conditions.
              </p>
            </div>
          </div>

          <Separator />

          {/* Improvement Tips */}
          <div className="space-y-2">
            <h4 className="font-semibold text-green-600">How to Improve Stability</h4>
            <div className="space-y-2 pl-4 text-xs">
              <p>
                <strong>Reduce unemployment</strong> - Biggest factor in crime and unrest
              </p>
              <p>
                <strong>Address inequality</strong> - Lower Gini index reduces tension
              </p>
              <p>
                <strong>Fight corruption</strong> - Improves trust, policing, and institutions
              </p>
              <p>
                <strong>Increase policing budget</strong> - Higher per-capita spending improves
                effectiveness
              </p>
              <p>
                <strong>Promote economic growth</strong> - Builds cohesion and reduces desperation
              </p>
              <p>
                <strong>Avoid polarizing policies</strong> - Popular, consensus policies prevent
                protests
              </p>
              <p>
                <strong>Strengthen democratic institutions</strong> - Improves trust and stability
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
