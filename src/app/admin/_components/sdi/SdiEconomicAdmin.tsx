import React, { useState } from 'react';
import { GlassCard, EnhancedCard } from '~/components/ui/enhanced-card';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Badge } from '~/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '~/components/ui/dialog';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '~/components/ui/accordion';
import { AnimatedNumber } from '~/components/ui/animated-number';
import { api } from '~/trpc/react';

export function SdiEconomicAdmin() {
  // Use correct input for getEconomicIndicators and getEconomicAlerts (empty object for all)
  const { data: indicators = [], isLoading: loadingIndicators, error: errorIndicators, refetch: refetchIndicators } = api.sdi.getEconomicIndicators.useQuery(undefined);
  const { data: alerts = [], isLoading: loadingAlerts, error: errorAlerts, refetch: refetchAlerts } = api.sdi.getEconomicAlerts.useQuery(undefined);
  // Use void refetch() in onSuccess
  const createIndicator = api.sdi.createEconomicIndicator.useMutation({ onSuccess: () => { void refetchIndicators(); } });
  const updateIndicator = api.sdi.updateEconomicIndicator.useMutation({ onSuccess: () => { void refetchIndicators(); } });
  const deleteIndicator = api.sdi.deleteEconomicIndicator.useMutation({ onSuccess: () => { void refetchIndicators(); } });

  // Economic Indicator Form
  const [showIndicatorDialog, setShowIndicatorDialog] = useState(false);
  const [editIndicator, setEditIndicator] = useState<any>(null);
  const [indicatorForm, setIndicatorForm] = useState<any>({
    globalGDP: 0,
    globalGrowth: 0,
    inflationRate: 0,
    unemploymentRate: 0,
    tradeVolume: 0,
    currencyVolatility: 0,
  });

  // Economic Alert Form
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [editAlert, setEditAlert] = useState<any>(null);
  const [alertForm, setAlertForm] = useState<any>({
    type: 'market_volatility',
    title: '',
    severity: 'medium',
    description: '',
    affectedRegions: [],
    economicImpact: 0,
  });

  // Indicator CRUD
  const handleOpenIndicator = (indicator?: any) => {
    if (indicator) {
      setEditIndicator(indicator);
      setIndicatorForm({ ...indicator });
    } else {
      setEditIndicator(null);
      setIndicatorForm({ globalGDP: 0, globalGrowth: 0, inflationRate: 0, unemploymentRate: 0, tradeVolume: 0, currencyVolatility: 0 });
    }
    setShowIndicatorDialog(true);
  };
  const handleSaveIndicator = async () => {
    if (editIndicator) {
      await updateIndicator.mutateAsync({ id: editIndicator.id, ...indicatorForm });
    } else {
      await createIndicator.mutateAsync(indicatorForm);
    }
    setShowIndicatorDialog(false);
  };
  const handleDeleteIndicator = async (id: string) => {
    if (window.confirm('Delete this economic indicator?')) {
      await deleteIndicator.mutateAsync({ id });
    }
  };

  // Alert view only (no CRUD, backend does not support mutations)
  const handleOpenAlert = (alert?: any) => {
    if (alert) {
      setEditAlert(alert);
      setAlertForm({ ...alert });
      setShowAlertDialog(true);
    }
  };

  // Defensive: always map over arrays
  const indicatorsArr = Array.isArray(indicators) ? indicators : [];
  const alertsArr = Array.isArray(alerts) ? alerts : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Economic Indicators</h3>
        <Button onClick={() => handleOpenIndicator()}>New Indicator</Button>
      </div>
      {loadingIndicators && <div className="text-blue-400 py-4">Loading...</div>}
      {errorIndicators && <div className="text-red-400 py-4">Error: {errorIndicators.message}</div>}
      <Accordion type="single" collapsible className="mb-4">
        {indicatorsArr.map((indicator: any) => (
          <AccordionItem key={indicator.id || indicator.name || `indicator-${Math.random()}`} value={indicator.id || indicator.name || `indicator-${Math.random()}`}>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{indicator.globalGDP}</Badge>
                <span className="font-medium">{indicator.globalGrowth}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <GlassCard variant="glass" className="mb-2">
                <CardContent>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                    <div>
                      <div className="font-semibold">GDP: <AnimatedNumber value={indicator.globalGDP} duration={800} prefix="$" /></div>
                      <div className="text-sm text-muted-foreground">Growth: <AnimatedNumber value={indicator.globalGrowth} duration={800} suffix="%" /></div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleOpenIndicator(indicator)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteIndicator(indicator.id)}>Delete</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><b>Inflation:</b> <AnimatedNumber value={indicator.inflationRate} duration={800} suffix="%" /></div>
                    <div><b>Unemployment:</b> <AnimatedNumber value={indicator.unemploymentRate} duration={800} suffix="%" /></div>
                    <div><b>Trade Volume:</b> <AnimatedNumber value={indicator.tradeVolume} duration={800} /></div>
                    <div><b>Currency Volatility:</b> <AnimatedNumber value={indicator.currencyVolatility} duration={800} /></div>
                  </div>
                </CardContent>
              </GlassCard>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Dialog open={showIndicatorDialog} onOpenChange={setShowIndicatorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editIndicator ? 'Edit Indicator' : 'New Economic Indicator'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Global GDP" type="number" value={indicatorForm.globalGDP} onChange={e => setIndicatorForm((f: any) => ({ ...f, globalGDP: Number(e.target.value) }))} />
            <Input placeholder="Global Growth" type="number" value={indicatorForm.globalGrowth} onChange={e => setIndicatorForm((f: any) => ({ ...f, globalGrowth: Number(e.target.value) }))} />
            <Input placeholder="Inflation Rate" type="number" value={indicatorForm.inflationRate} onChange={e => setIndicatorForm((f: any) => ({ ...f, inflationRate: Number(e.target.value) }))} />
            <Input placeholder="Unemployment Rate" type="number" value={indicatorForm.unemploymentRate} onChange={e => setIndicatorForm((f: any) => ({ ...f, unemploymentRate: Number(e.target.value) }))} />
            <Input placeholder="Trade Volume" type="number" value={indicatorForm.tradeVolume} onChange={e => setIndicatorForm((f: any) => ({ ...f, tradeVolume: Number(e.target.value) }))} />
            <Input placeholder="Currency Volatility" type="number" value={indicatorForm.currencyVolatility} onChange={e => setIndicatorForm((f: any) => ({ ...f, currencyVolatility: Number(e.target.value) }))} />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveIndicator} disabled={createIndicator.isPending || updateIndicator.isPending}>{editIndicator ? 'Save' : 'Create'}</Button>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex justify-between items-center mb-4 mt-8">
        <h3 className="text-xl font-semibold">Economic Alerts</h3>
      </div>
      {loadingAlerts && <div className="text-blue-400 py-4">Loading...</div>}
      {errorAlerts && <div className="text-red-400 py-4">Error: {errorAlerts.message}</div>}
      <Accordion type="single" collapsible className="mb-4">
        {alertsArr.map((alert: any) => (
          <AccordionItem key={alert.id} value={alert.id}>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{alert.severity}</Badge>
                <span className="font-medium">{alert.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <GlassCard variant="glass" className="mb-2">
                <CardContent>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                    <div>
                      <div className="font-semibold">{alert.title}</div>
                      <div className="text-sm text-muted-foreground">{alert.description}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><b>Severity:</b> {alert.severity}</div>
                  </div>
                </CardContent>
              </GlassCard>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAlert ? 'Edit Alert' : 'New Economic Alert'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Type" value={alertForm.type} onChange={e => setAlertForm((f: any) => ({ ...f, type: e.target.value }))} />
            <Input placeholder="Title" value={alertForm.title} onChange={e => setAlertForm((f: any) => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Severity" value={alertForm.severity} onChange={e => setAlertForm((f: any) => ({ ...f, severity: e.target.value }))} />
            <Textarea placeholder="Description" value={alertForm.description} onChange={e => setAlertForm((f: any) => ({ ...f, description: e.target.value }))} />
            <Input placeholder="Affected Regions (comma separated)" value={alertForm.affectedRegions?.join(', ') || ''} onChange={e => setAlertForm((f: any) => ({ ...f, affectedRegions: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} />
            <Input placeholder="Economic Impact" type="number" value={alertForm.economicImpact} onChange={e => setAlertForm((f: any) => ({ ...f, economicImpact: Number(e.target.value) }))} />
          </div>
          <DialogFooter>
            {/* No Save/Create for alerts, as alerts are read-only */}
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 