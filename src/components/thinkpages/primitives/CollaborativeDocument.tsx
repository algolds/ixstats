"use client";

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Users, 
  Settings, 
  UserPlus, 
  Share2, 
  Lock, 
  Globe, 
  Crown,
  Save,
  Edit3,
  History,
  Download,
  Trash2,
  MoreHorizontal,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { ScrollArea } from '~/components/ui/scroll-area';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import RichTextEditor, { type RichTextEditorRef } from '../RichTextEditor';
import { AccountIndicator } from './AccountIndicator';

interface CollaborativeDocumentProps {
  groupId: string;
  groupName: string;
  currentUserAccount?: any;
  userAccounts?: any[];
  isOwner?: boolean;
  members?: any[];
  className?: string;
}

interface DocumentSettings {
  name: string;
  description: string;
  privacy: 'public' | 'members' | 'private';
  editPermissions: 'owner' | 'admins' | 'members';
  viewPermissions: 'public' | 'members' | 'private';
}

export function CollaborativeDocument({
  groupId,
  groupName,
  currentUserAccount,
  userAccounts = [],
  isOwner = false,
  members = [],
  className = ''
}: CollaborativeDocumentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [documentContent, setDocumentContent] = useState('');
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings>({
    name: `${groupName} Collaborative Document`,
    description: '',
    privacy: 'members',
    editPermissions: 'members',
    viewPermissions: 'members'
  });

  const richTextEditorRef = useRef<RichTextEditorRef>(null);

  // Mock document data - in real implementation, this would come from API
  const documentData = {
    id: `doc-${groupId}`,
    title: documentSettings.name,
    content: documentContent,
    lastEditedBy: currentUserAccount,
    lastEditedAt: new Date(),
    version: 1,
    collaborators: members.slice(0, 5), // Show first 5 collaborators
    permissions: documentSettings
  };

  const { data: searchResults, isLoading: isSearchingUsers } = { data: [], isLoading: false }; // Disabled until searchAccounts endpoint exists

  const handleSaveDocument = useCallback(async () => {
    if (!richTextEditorRef.current) return;
    
    const content = richTextEditorRef.current.getContent();
    const plainText = richTextEditorRef.current.getPlainText();
    
    try {
      // In real implementation, save to API
      setDocumentContent(content);
      setIsEditing(false);
      toast.success('Document saved successfully!');
    } catch (error) {
      toast.error('Failed to save document');
    }
  }, []);

  const handleInviteUser = useCallback(async (accountId: string) => {
    try {
      // In real implementation, send invite via API
      toast.success('Invitation sent!');
      setShowInviteModal(false);
      setSearchQuery('');
    } catch (error) {
      toast.error('Failed to send invitation');
    }
  }, []);

  const handleShareDocument = useCallback(() => {
    const shareUrl = `${window.location.origin}/thinkpages/groups/${groupId}/document`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Document link copied to clipboard!');
  }, [groupId]);

  const handleUpdateSettings = useCallback(async (newSettings: Partial<DocumentSettings>) => {
    try {
      setDocumentSettings(prev => ({ ...prev, ...newSettings }));
      toast.success('Settings updated!');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  }, []);

  return (
    <Card className={`glass-hierarchy-child ${className}`}>
      {/* Document Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">{documentData.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Last edited by {documentData.lastEditedBy?.displayName} • {documentData.lastEditedAt.toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Collaborators Avatars */}
            <div className="flex -space-x-2">
              {documentData.collaborators.map((collaborator, index) => (
                <Avatar key={collaborator.id} className="h-8 w-8 border-2 border-background">
                  <AvatarImage src={collaborator.account?.profileImageUrl} />
                  <AvatarFallback className="text-xs">
                    {collaborator.account?.displayName?.split(' ').map((n: string) => n[0]).join('') || '?'}
                  </AvatarFallback>
                </Avatar>
              ))}
              {members.length > 5 && (
                <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">+{members.length - 5}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Group Settings Button */}
              <Dialog open={showGroupSettings} onOpenChange={setShowGroupSettings}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" title="Group Settings">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Document Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="doc-name">Document Name</Label>
                      <Input
                        id="doc-name"
                        value={documentSettings.name}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="doc-description">Description</Label>
                      <Textarea
                        id="doc-description"
                        value={documentSettings.description}
                        onChange={(e) => setDocumentSettings(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe the purpose of this document..."
                      />
                    </div>

                    <div>
                      <Label>Privacy Level</Label>
                      <Select 
                        value={documentSettings.privacy} 
                        onValueChange={(value: 'public' | 'members' | 'private') => 
                          setDocumentSettings(prev => ({ ...prev, privacy: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              Public - Anyone can view
                            </div>
                          </SelectItem>
                          <SelectItem value="members">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Members Only
                            </div>
                          </SelectItem>
                          <SelectItem value="private">
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4" />
                              Private - Admins only
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Edit Permissions</Label>
                      <Select 
                        value={documentSettings.editPermissions} 
                        onValueChange={(value: 'owner' | 'admins' | 'members') => 
                          setDocumentSettings(prev => ({ ...prev, editPermissions: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner Only</SelectItem>
                          <SelectItem value="admins">Admins Only</SelectItem>
                          <SelectItem value="members">All Members</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button onClick={() => {
                        handleUpdateSettings(documentSettings);
                        setShowGroupSettings(false);
                      }}>
                        Save Settings
                      </Button>
                      <Button variant="outline" onClick={() => setShowGroupSettings(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Invite Button */}
              <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" title="Invite Collaborators">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Invite Collaborators</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Search Users</Label>
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by username or display name..."
                      />
                    </div>

                    <ScrollArea className="h-60">
                      {searchResults && searchResults.length > 0 ? (
                        <div className="space-y-2">
                          {searchResults
                            .filter((account: any) => !members.some(member => member.accountId === account.id))
                            .map((account: any) => (
                            <div
                              key={account.id}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                            >
                              <AccountIndicator
                                account={account}
                                showUsername={true}
                                size="sm"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleInviteUser(account.id)}
                              >
                                Invite
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : searchQuery.length > 2 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          No users found
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          Start typing to search for users
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Share Button */}
              <Button variant="ghost" size="sm" onClick={handleShareDocument} title="Share Document">
                <Share2 className="h-4 w-4" />
              </Button>

              {/* More Options */}
              <Button variant="ghost" size="sm" title="More Options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Document Status */}
        <div className="flex items-center gap-4 text-sm">
          <Badge variant="secondary" className="flex items-center gap-1">
            {documentSettings.privacy === 'public' ? (
              <Globe className="h-3 w-3" />
            ) : documentSettings.privacy === 'members' ? (
              <Users className="h-3 w-3" />
            ) : (
              <Lock className="h-3 w-3" />
            )}
            {documentSettings.privacy}
          </Badge>
          <span className="text-muted-foreground">
            Version {documentData.version} • {members.length} collaborators
          </span>
        </div>
      </CardHeader>

      <Separator />

      {/* Document Content */}
      <CardContent className="p-0">
        {isEditing ? (
          <div className="p-4">
            <RichTextEditor
              ref={richTextEditorRef}
              initialContent={documentContent}
              placeholder="Start collaborating on your document..."
              minHeight={400}
              maxHeight={600}
              showToolbar={true}
              onContentChange={(content, plainText) => {
                // Auto-save periodically in real implementation
              }}
            />
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSaveDocument}>
                <Save className="h-4 w-4 mr-2" />
                Save Document
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {documentContent ? (
              <div>
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: documentContent }}
                />
                <div className="flex gap-2 mt-6">
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Document
                  </Button>
                  <Button variant="outline">
                    <History className="h-4 w-4 mr-2" />
                    View History
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Start Collaborating</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first collaborative document to work together with your group.
                </p>
                <Button onClick={() => setIsEditing(true)}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Create Document
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}