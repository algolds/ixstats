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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

export const StabilityHelpDialog = React.memo(function StabilityHelpDialog() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="About internal stability metrics"
        >
          <HelpCircle className="text-label-secondary h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Info aria-hidden="true" className="text-label-secondary h-5 w-5" />
            Understanding internal stability metrics
          </SheetTitle>
          <SheetDescription>
            How stability metrics are calculated and what they mean for your country
          </SheetDescription>
        </SheetHeader>

        <div className="text-body space-y-6">
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4" />
              Overall Stability Score (0-100)
            </h4>
            <p className="text-label-secondary">
              A composite metric combining social cohesion (25%), trust in government (20%), low
              crime rates (20%), low ethnic tension (15%), low riot risk (10%), and effective
              policing (10%). Higher scores indicate greater internal stability.
            </p>
            <div className="text-footnote space-y-1 pl-4">
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

          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <Shield className="h-4 w-4" />
              Crime & law enforcement
            </h4>
            <div className="space-y-3 pl-4">
              <div>
                <p className="font-medium">Crime Rate (per 100k population)</p>
                <p className="text-label-secondary">
                  Calculated from unemployment (x0.8), income inequality (x0.15), poverty (x0.6),
                  and youth unemployment (x0.4). Higher urbanization and lower policing budgets
                  increase crime rates.
                </p>
              </div>
              <div>
                <p className="font-medium">Organized Crime Level (0-100%)</p>
                <p className="text-label-secondary">
                  Based on corruption (x0.4), political instability (x8), weak institutions (x0.3),
                  and economic desperation (x0.2). High corruption enables organized crime to
                  flourish.
                </p>
              </div>
              <div>
                <p className="font-medium">Policing Effectiveness (0-100%)</p>
                <p className="text-label-secondary">
                  Determined by policing budget per capita (up to 50%) minus corruption penalties
                  (x0.3). Higher budgets and lower corruption improve effectiveness.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <Activity className="h-4 w-4" />
              Public order
            </h4>
            <div className="space-y-3 pl-4">
              <div>
                <p className="font-medium">Protest Frequency (events/year)</p>
                <p className="text-label-secondary">
                  Driven by political polarization (x0.15), unemployment (x0.5), inequality (x8),
                  recent unpopular policies (x0.1), and democracy level (x10). More democratic
                  societies allow more protests.
                </p>
              </div>
              <div>
                <p className="font-medium">Riot Risk (0-100%)</p>
                <p className="text-label-secondary">
                  Calculated from polarization (x0.3), economic desperation (x0.3), existing crime
                  (x0.2), weak policing (x20), and frequent protests (x0.5). Multiple risk factors
                  compound dangerously.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <Heart className="h-4 w-4" />
              Social cohesion
            </h4>
            <div className="space-y-3 pl-4">
              <div>
                <p className="font-medium">Social Cohesion (0-100%)</p>
                <p className="text-label-secondary">
                  Economic growth (+3 per %), political stability (+20%), minus penalties for
                  inequality (x30%) and polarization (x0.3). Strong economies and stable politics
                  build cohesion.
                </p>
              </div>
              <div>
                <p className="font-medium">Ethnic Tension (0-100%)</p>
                <p className="text-label-secondary">
                  Diversity alone doesn't cause tension (x0.15), but economic scarcity (x0.3),
                  inequality (x0.2), and political polarization (x0.2) can inflame it. Address root
                  economic causes.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <Eye className="h-4 w-4" />
              Public confidence
            </h4>
            <div className="space-y-3 pl-4">
              <div>
                <p className="font-medium">Trust in Government (0-100%)</p>
                <p className="text-label-secondary">
                  Democracy (+30%), economic growth (+4 per %), political stability (+20%), minus
                  corruption (x0.4) and polarization (x0.15). Corruption is the biggest destroyer of
                  trust.
                </p>
              </div>
              <div>
                <p className="font-medium">Trust in Police (0-100%)</p>
                <p className="text-label-secondary">
                  Effective policing (+0.5 per %), minus corruption (x0.35) and high crime (x0.2).
                  Corruption in law enforcement is particularly damaging.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Automatic security event system
            </h4>
            <p className="text-label-secondary">
              <strong>Events are generated automatically</strong> based on your country's actual
              metrics using advanced Markov chains and NPC threat actor personalities. The system
              continuously monitors stability conditions and triggers events when thresholds are
              crossed or conditions align.
            </p>
            <div className="text-footnote mt-2 space-y-2 pl-4">
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

          <div className="space-y-2">
            <h4 className="text-label font-semibold">How to improve stability</h4>
            <div className="text-footnote space-y-2 pl-4">
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
      </SheetContent>
    </Sheet>
  );
});
