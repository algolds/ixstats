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
import type { CrisisEvent } from '~/types/sdi';

interface CrisisEventForm {
  id?: string;
  title: string;
  type: CrisisEvent['type'];
  severity: CrisisEvent['severity'];
  affectedCountries: string[];
  casualties: number;
  economicImpact: number;
  responseStatus: CrisisEvent['responseStatus'];
  description: string;
  location: string;
}

export function SdiCrisisAdmin() {
  const { data: crises = [], isLoading, error, refetch } = api.sdi.getActiveCrises.useQuery(undefined, { refetchInterval: 5000 });
  const createMutation = api.sdi.createCrisisEvent.useMutation({ onSuccess: () => refetch() });
  const updateMutation = api.sdi.updateCrisisEvent.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = api.sdi.deleteCrisisEvent.useMutation({ onSuccess: () => refetch() });

  const [showDialog, setShowDialog] = useState(false);
  const [editCrisis, setEditCrisis] = useState<CrisisEventForm | null>(null);
  const [form, setForm] = useState<CrisisEventForm>({
    title: '',
    type: 'natural_disaster',
    severity: 'medium',
    affectedCountries: [],
    casualties: 0,
    economicImpact: 0,
    responseStatus: 'monitoring',
    description: '',
    location: '',
  });

  const handleOpen = (crisis?: CrisisEvent) => {
    if (crisis) {
      const formData: CrisisEventForm = {
        id: crisis.id,
        title: crisis.title,
        type: crisis.type,
        severity: crisis.severity,
        affectedCountries: crisis.affectedCountries || [],
        casualties: crisis.casualties,
        economicImpact: crisis.economicImpact,
        responseStatus: crisis.responseStatus,
        description: crisis.description,
        location: crisis.location || '',
      };
      setEditCrisis(formData);
      setForm(formData);
    } else {
      setEditCrisis(null);
      setForm({
        title: '', type: 'natural_disaster', severity: 'medium', affectedCountries: [], casualties: 0, economicImpact: 0, responseStatus: 'monitoring', description: '', location: '',
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (editCrisis?.id) {
      await updateMutation.mutateAsync({ id: editCrisis.id, ...form });
    } else {
      await createMutation.mutateAsync(form);
    }
    setShowDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this crisis event?')) {
      await deleteMutation.mutateAsync({ id });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Crisis Events</h3>
        <Button onClick={() => handleOpen()}>New Crisis</Button>
      </div>
      {isLoading && <div className="text-blue-400 py-4">Loading...</div>}
      {error && <div className="text-red-400 py-4">Error: {error.message}</div>}
      <Accordion type="single" collapsible className="mb-4">
        {crises.map((crisis: CrisisEvent) => (
          <AccordionItem key={crisis.id} value={crisis.id}>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{crisis.severity}</Badge>
                <span className="font-medium">{crisis.title}</span>
                <span className="text-xs text-muted-foreground">{crisis.type}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <GlassCard variant="glass" className="mb-2">
                <CardContent>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                    <div>
                      <div className="font-semibold">{crisis.title}</div>
                      <div className="text-sm text-muted-foreground">{crisis.description}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleOpen(crisis)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(crisis.id)}>Delete</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><b>Type:</b> {crisis.type}</div>
                    <div><b>Severity:</b> {crisis.severity}</div>
                    <div><b>Status:</b> {crisis.responseStatus}</div>
                    <div><b>Location:</b> {crisis.location}</div>
                    <div><b>Casualties:</b> <AnimatedNumber value={crisis.casualties} duration={800} /></div>
                    <div><b>Economic Impact:</b> <AnimatedNumber value={crisis.economicImpact} duration={800} prefix="$" /></div>
                    <div><b>Affected:</b> {(crisis.affectedCountries || []).join(', ')}</div>
                  </div>
                </CardContent>
              </GlassCard>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCrisis ? 'Edit Crisis' : 'New Crisis Event'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={form.title} onChange={e => setForm((f: CrisisEventForm) => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Type" value={form.type} onChange={e => setForm((f: CrisisEventForm) => ({ ...f, type: e.target.value as CrisisEvent['type'] }))} />
            <Input placeholder="Severity" value={form.severity} onChange={e => setForm((f: CrisisEventForm) => ({ ...f, severity: e.target.value as CrisisEvent['severity'] }))} />
            <Input placeholder="Status" value={form.responseStatus} onChange={e => setForm((f: CrisisEventForm) => ({ ...f, responseStatus: e.target.value as CrisisEvent['responseStatus'] }))} />
            <Input placeholder="Location" value={form.location} onChange={e => setForm((f: CrisisEventForm) => ({ ...f, location: e.target.value }))} />
            <Input placeholder="Casualties" type="number" value={form.casualties} onChange={e => setForm((f: CrisisEventForm) => ({ ...f, casualties: Number(e.target.value) }))} />
            <Input placeholder="Economic Impact" type="number" value={form.economicImpact} onChange={e => setForm((f: CrisisEventForm) => ({ ...f, economicImpact: Number(e.target.value) }))} />
            <Input placeholder="Affected Countries (comma separated)" value={form.affectedCountries.join(', ')} onChange={e => setForm((f: CrisisEventForm) => ({ ...f, affectedCountries: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} />
            <Textarea placeholder="Description" value={form.description} onChange={e => setForm((f: CrisisEventForm) => ({ ...f, description: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>{editCrisis ? 'Save' : 'Create'}</Button>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 