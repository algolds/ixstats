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

export function SdiDiplomaticAdmin() {
  // Use correct input for queries (empty object for all)
  const { data: relations = [], isLoading: loadingRelations, error: errorRelations, refetch: refetchRelations } = api.sdi.getDiplomaticRelations.useQuery(undefined);
  const { data: treaties = [], isLoading: loadingTreaties, error: errorTreaties, refetch: refetchTreaties } = api.sdi.getActiveTreaties.useQuery(undefined);
  const { data: events = [], isLoading: loadingEvents, error: errorEvents, refetch: refetchEvents } = api.sdi.getDiplomaticEvents.useQuery(undefined);
  const createRelation = api.sdi.createDiplomaticRelation.useMutation({ onSuccess: () => { void refetchRelations(); } });
  const updateRelation = api.sdi.updateDiplomaticRelation.useMutation({ onSuccess: () => { void refetchRelations(); } });
  const deleteRelation = api.sdi.deleteDiplomaticRelation.useMutation({ onSuccess: () => { void refetchRelations(); } });
  const createTreaty = api.sdi.createTreaty.useMutation({ onSuccess: () => { void refetchTreaties(); } });
  const updateTreaty = api.sdi.updateTreaty.useMutation({ onSuccess: () => { void refetchTreaties(); } });
  const deleteTreaty = api.sdi.deleteTreaty.useMutation({ onSuccess: () => { void refetchTreaties(); } });
  // No createDiplomaticEvent/update/delete in backend, so remove those

  // Diplomatic Relation Form
  const [showRelationDialog, setShowRelationDialog] = useState(false);
  const [editRelation, setEditRelation] = useState<any>(null);
  const [relationForm, setRelationForm] = useState<any>({
    country1: '',
    country2: '',
    relationship: 'neutral',
    strength: 50,
    status: 'active',
    treaties: [],
    diplomaticChannels: [],
  });

  // Treaty Form
  const [showTreatyDialog, setShowTreatyDialog] = useState(false);
  const [editTreaty, setEditTreaty] = useState<any>(null);
  const [treatyForm, setTreatyForm] = useState<any>({
    name: '',
    type: 'economic',
    status: 'active',
    parties: [],
    signedDate: '',
    expiryDate: '',
    description: '',
    complianceRate: 100,
  });

  // Event Form (read-only, no CRUD)
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [eventForm, setEventForm] = useState<any>({
    title: '',
    type: 'summit',
    status: 'scheduled',
    participants: [],
    date: '',
  });

  // Relation CRUD
  const handleOpenRelation = (relation?: any) => {
    if (relation) {
      setEditRelation(relation);
      setRelationForm({ ...relation, treaties: relation.treaties || [], diplomaticChannels: relation.diplomaticChannels || [] });
    } else {
      setEditRelation(null);
      setRelationForm({ country1: '', country2: '', relationship: 'neutral', strength: 50, status: 'active', treaties: [], diplomaticChannels: [] });
    }
    setShowRelationDialog(true);
  };
  const handleSaveRelation = async () => {
    if (editRelation) {
      await updateRelation.mutateAsync({ id: editRelation.id, ...relationForm });
    } else {
      await createRelation.mutateAsync(relationForm);
    }
    setShowRelationDialog(false);
  };
  const handleDeleteRelation = async (id: string) => {
    if (window.confirm('Delete this diplomatic relation?')) {
      await deleteRelation.mutateAsync({ id });
    }
  };

  // Treaty CRUD
  const handleOpenTreaty = (treaty?: any) => {
    if (treaty) {
      setEditTreaty(treaty);
      setTreatyForm({ ...treaty, parties: treaty.parties || [] });
    } else {
      setEditTreaty(null);
      setTreatyForm({ name: '', type: 'economic', status: 'active', parties: [], signedDate: '', expiryDate: '', description: '', complianceRate: 100 });
    }
    setShowTreatyDialog(true);
  };
  const handleSaveTreaty = async () => {
    if (editTreaty) {
      await updateTreaty.mutateAsync({ id: editTreaty.id, ...treatyForm });
    } else {
      // Remove 'terms' if present (not in Prisma model)
      const { terms, ...rest } = treatyForm;
      await createTreaty.mutateAsync(rest);
    }
    setShowTreatyDialog(false);
  };
  const handleDeleteTreaty = async (id: string) => {
    if (window.confirm('Delete this treaty?')) {
      await deleteTreaty.mutateAsync({ id });
    }
  };

  // Defensive: always map over arrays
  const relationsArr = Array.isArray(relations) ? relations : [];
  const treatiesArr = Array.isArray(treaties) ? treaties : [];
  const eventsArr = Array.isArray(events) ? events : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Diplomatic Relations</h3>
        <Button onClick={() => handleOpenRelation()}>New Relation</Button>
      </div>
      {loadingRelations && <div className="text-blue-400 py-4">Loading...</div>}
      {errorRelations && <div className="text-red-400 py-4">Error: {errorRelations.message}</div>}
      <Accordion type="single" collapsible className="mb-4">
        {relationsArr.map((relation: any) => (
          <AccordionItem key={relation.id} value={relation.id}>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{relation.relationship}</Badge>
                <span className="font-medium">{relation.country1} ↔ {relation.country2}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <GlassCard variant="glass" className="mb-2">
                <CardContent>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                    <div>
                      <div className="font-semibold">{relation.country1} ↔ {relation.country2}</div>
                      <div className="text-sm text-muted-foreground">{relation.status}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleOpenRelation(relation)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteRelation(relation.id)}>Delete</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><b>Relationship:</b> {relation.relationship}</div>
                    <div><b>Strength:</b> <AnimatedNumber value={relation.strength} duration={800} /></div>
                    <div><b>Treaties:</b> {(relation.treaties || []).join(', ')}</div>
                  </div>
                </CardContent>
              </GlassCard>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Dialog open={showRelationDialog} onOpenChange={setShowRelationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRelation ? 'Edit Relation' : 'New Diplomatic Relation'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Country 1" value={relationForm.country1} onChange={e => setRelationForm((f: any) => ({ ...f, country1: e.target.value }))} />
            <Input placeholder="Country 2" value={relationForm.country2} onChange={e => setRelationForm((f: any) => ({ ...f, country2: e.target.value }))} />
            <Input placeholder="Relationship" value={relationForm.relationship} onChange={e => setRelationForm((f: any) => ({ ...f, relationship: e.target.value }))} />
            <Input placeholder="Strength" type="number" value={relationForm.strength} onChange={e => setRelationForm((f: any) => ({ ...f, strength: Number(e.target.value) }))} />
            <Input placeholder="Status" value={relationForm.status} onChange={e => setRelationForm((f: any) => ({ ...f, status: e.target.value }))} />
            <Input placeholder="Treaties (comma separated)" value={relationForm.treaties.join(', ')} onChange={e => setRelationForm((f: any) => ({ ...f, treaties: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} />
            <Input placeholder="Diplomatic Channels (comma separated)" value={relationForm.diplomaticChannels.join(', ')} onChange={e => setRelationForm((f: any) => ({ ...f, diplomaticChannels: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveRelation} disabled={createRelation.isPending || updateRelation.isPending}>{editRelation ? 'Save' : 'Create'}</Button>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex justify-between items-center mb-4 mt-8">
        <h3 className="text-xl font-semibold">Treaties</h3>
        <Button onClick={() => handleOpenTreaty()}>New Treaty</Button>
      </div>
      {loadingTreaties && <div className="text-blue-400 py-4">Loading...</div>}
      {errorTreaties && <div className="text-red-400 py-4">Error: {errorTreaties.message}</div>}
      <Accordion type="single" collapsible className="mb-4">
        {treatiesArr.map((treaty: any) => (
          <AccordionItem key={treaty.id} value={treaty.id}>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{treaty.type}</Badge>
                <span className="font-medium">{treaty.name}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <GlassCard variant="glass" className="mb-2">
                <CardContent>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                    <div>
                      <div className="font-semibold">{treaty.name}</div>
                      <div className="text-sm text-muted-foreground">{treaty.status}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleOpenTreaty(treaty)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteTreaty(treaty.id)}>Delete</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><b>Type:</b> {treaty.type}</div>
                    <div><b>Parties:</b> {(treaty.parties || []).join(', ')}</div>
                    <div><b>Signed:</b> {treaty.signedDate}</div>
                    <div><b>Expires:</b> {treaty.expiryDate}</div>
                  </div>
                </CardContent>
              </GlassCard>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Dialog open={showTreatyDialog} onOpenChange={setShowTreatyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTreaty ? 'Edit Treaty' : 'New Treaty'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={treatyForm.name} onChange={e => setTreatyForm((f: any) => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Type" value={treatyForm.type} onChange={e => setTreatyForm((f: any) => ({ ...f, type: e.target.value }))} />
            <Input placeholder="Status" value={treatyForm.status} onChange={e => setTreatyForm((f: any) => ({ ...f, status: e.target.value }))} />
            <Input placeholder="Parties (comma separated)" value={treatyForm.parties.join(', ')} onChange={e => setTreatyForm((f: any) => ({ ...f, parties: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} />
            <Input placeholder="Signed Date" value={treatyForm.signedDate} onChange={e => setTreatyForm((f: any) => ({ ...f, signedDate: e.target.value }))} />
            <Input placeholder="Expiry Date" value={treatyForm.expiryDate} onChange={e => setTreatyForm((f: any) => ({ ...f, expiryDate: e.target.value }))} />
            <Input placeholder="Description" value={treatyForm.description} onChange={e => setTreatyForm((f: any) => ({ ...f, description: e.target.value }))} />
            <Input placeholder="Compliance Rate" type="number" value={treatyForm.complianceRate} onChange={e => setTreatyForm((f: any) => ({ ...f, complianceRate: Number(e.target.value) }))} />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveTreaty} disabled={createTreaty.isPending || updateTreaty.isPending}>{editTreaty ? 'Save' : 'Create'}</Button>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex justify-between items-center mb-4 mt-8">
        <h3 className="text-xl font-semibold">Diplomatic Events</h3>
      </div>
      {loadingEvents && <div className="text-blue-400 py-4">Loading...</div>}
      {errorEvents && <div className="text-red-400 py-4">Error: {errorEvents.message}</div>}
      <Accordion type="single" collapsible className="mb-4">
        {eventsArr.map((event: any) => (
          <AccordionItem key={event.id} value={event.id}>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{event.type}</Badge>
                <span className="font-medium">{event.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <GlassCard variant="glass" className="mb-2">
                <CardContent>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                    <div>
                      <div className="font-semibold">{event.title}</div>
                      <div className="text-sm text-muted-foreground">{event.status}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><b>Type:</b> {event.type}</div>
                    <div><b>Status:</b> {event.status}</div>
                    <div><b>Participants:</b> {(event.participants || []).join(', ')}</div>
                    <div><b>Date:</b> {event.date}</div>
                  </div>
                </CardContent>
              </GlassCard>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
} 