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

interface IntelligenceItemForm {
  title: string;
  content: string;
  category: 'economic' | 'crisis' | 'diplomatic' | 'security' | 'technology' | 'environment';
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  region: string;
  affectedCountries: string[];
}

export function SdiIntelligenceAdmin() {
  // Use correct input for getIntelligenceFeed (empty object for all)
  const { data, isLoading, error, refetch } = api.sdi.getIntelligenceFeed.useQuery({});
  // Only use createIntelligenceItem mutation (update/delete not implemented in backend)
  const createMutation = api.sdi.createIntelligenceItem.useMutation({ onSuccess: () => { void refetch(); } });

  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<IntelligenceItemForm>({
    title: '',
    content: '',
    category: 'economic',
    priority: 'medium',
    source: '',
    region: '',
    affectedCountries: [],
  });

  const handleOpen = () => {
    setForm({ title: '', content: '', category: 'economic', priority: 'medium', source: '', region: '', affectedCountries: [] });
    setShowDialog(true);
  };

  const handleSave = async () => {
    await createMutation.mutateAsync({
      title: form.title,
      content: form.content,
      category: form.category,
      priority: form.priority,
      source: form.source,
      region: form.region,
      affectedCountries: form.affectedCountries,
    });
    setShowDialog(false);
  };

  // Defensive: data?.data is the array of alerts
  const alerts = Array.isArray(data?.data) ? data.data : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Intelligence Alerts</h3>
        <Button onClick={handleOpen}>New Alert</Button>
      </div>
      {isLoading && <div className="text-blue-400 py-4">Loading...</div>}
      {error && <div className="text-red-400 py-4">Error: {error.message}</div>}
      <Accordion type="single" collapsible className="mb-4">
        {alerts.map((alert: any) => (
          <AccordionItem key={alert.id} value={alert.id}>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{alert.priority}</Badge>
                <span className="font-medium">{alert.title}</span>
                <span className="text-xs text-muted-foreground">{alert.category}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <GlassCard variant="glass" className="mb-2">
                <CardContent>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                    <div>
                      <div className="font-semibold">{alert.title}</div>
                      <div className="text-sm text-muted-foreground">{alert.content}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><b>Category:</b> {alert.category}</div>
                    <div><b>Priority:</b> {alert.priority}</div>
                    <div><b>Source:</b> {alert.source}</div>
                    <div><b>Region:</b> {alert.region}</div>
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
            <DialogTitle>New Intelligence Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={form.title} onChange={e => setForm((f: IntelligenceItemForm) => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Content" value={form.content} onChange={e => setForm((f: IntelligenceItemForm) => ({ ...f, content: e.target.value }))} />
            <Input placeholder="Category" value={form.category} onChange={e => setForm((f: IntelligenceItemForm) => ({ ...f, category: e.target.value as IntelligenceItemForm['category'] }))} />
            <Input placeholder="Priority" value={form.priority} onChange={e => setForm((f: IntelligenceItemForm) => ({ ...f, priority: e.target.value as IntelligenceItemForm['priority'] }))} />
            <Input placeholder="Source" value={form.source} onChange={e => setForm((f: IntelligenceItemForm) => ({ ...f, source: e.target.value }))} />
            <Input placeholder="Region" value={form.region} onChange={e => setForm((f: IntelligenceItemForm) => ({ ...f, region: e.target.value }))} />
            <Input placeholder="Affected Countries (comma separated)" value={form.affectedCountries.join(', ')} onChange={e => setForm((f: IntelligenceItemForm) => ({ ...f, affectedCountries: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} />
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={createMutation.isPending}>Create</Button>
            <DialogClose className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">Cancel</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 