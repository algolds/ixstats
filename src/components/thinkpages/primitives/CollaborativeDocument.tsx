"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  EyeOff,
  Plus,
  X,
  HelpCircle,
  ArrowLeft,
  Check,
  Loader2,
  FileDown,
  FileJson,
  Code,
  AlertCircle
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import RichTextEditor, { type RichTextEditorRef } from '../RichTextEditor';
import { useThinkPagesWebSocket } from '~/hooks/useThinkPagesWebSocket';
import { WikiTextImporter } from './WikiTextImporter';

interface CollaborativeDocumentProps {
  groupId: string;
  groupName: string;
  currentUserAccount?: any;
  userAccounts?: any[];
  isOwner?: boolean;
  members?: any[];
  className?: string;
}

interface Document {
  id: string;
  title: string;
  content: string | null;
  version: number;
  createdBy: string;
  lastEditBy: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocIsPublic, setNewDocIsPublic] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showWikiImporter, setShowWikiImporter] = useState(false);

  const richTextEditorRef = useRef<RichTextEditorRef>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Support both account object and direct userId string
  const currentUserId =
    typeof currentUserAccount === 'string'
      ? currentUserAccount
      : (currentUserAccount?.id || currentUserAccount?.clerkUserId);

  // API Queries
  const { data: documents, isLoading, refetch: refetchDocuments } = api.thinkpages.getThinktankDocuments.useQuery({
    groupId
  }, {
    enabled: !!groupId,
    refetchOnWindowFocus: false
  });

  const { data: currentDocument, refetch: refetchCurrentDocument } = api.thinkpages.getThinktankDocument.useQuery({
    documentId: selectedDocument?.id || '',
    userId: currentUserId || ''
  }, {
    enabled: !!selectedDocument?.id && !!currentUserId,
    refetchOnWindowFocus: false
  });

  // Mutations
  const createDocMutation = api.thinkpages.createThinktankDocument.useMutation({
    onSuccess: (newDoc) => {
      toast.success('Document created successfully!');
      refetchDocuments();
      setShowCreateModal(false);
      setNewDocTitle('');
      setNewDocIsPublic(false);
      setSelectedDocument(newDoc as Document);
      setView('edit');
      setIsEditing(true);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create document');
    }
  });

  const updateDocMutation = api.thinkpages.updateThinktankDocument.useMutation({
    onSuccess: () => {
      setAutoSaveStatus('saved');
      refetchDocuments();
      refetchCurrentDocument();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save document');
      setAutoSaveStatus('unsaved');
    }
  });

  const deleteDocMutation = api.thinkpages.deleteThinktankDocument.useMutation({
    onSuccess: () => {
      toast.success('Document deleted successfully!');
      refetchDocuments();
      setShowDeleteConfirm(false);
      setSelectedDocument(null);
      setView('list');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete document');
    }
  });

  // Real-time WebSocket for collaborative editing
  const { clientState } = useThinkPagesWebSocket({
    accountId: currentUserId,
    autoReconnect: true,
    onMessageUpdate: (update) => {
      if (update.documentId === selectedDocument?.id) {
        refetchCurrentDocument();
      }
    }
  });

  // Auto-save functionality
  const handleContentChange = useCallback((content: string, plainText: string) => {
    if (!selectedDocument || !currentUserId) return;

    setAutoSaveStatus('unsaved');

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new auto-save timer (2 seconds after last change)
    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveStatus('saving');
      updateDocMutation.mutate({
        documentId: selectedDocument.id,
        userId: currentUserId,
        content
      });
    }, 2000);
  }, [selectedDocument, currentUserId, updateDocMutation]);

  // Manual save
  const handleSaveDocument = useCallback(async () => {
    if (!richTextEditorRef.current || !selectedDocument || !currentUserId) return;

    const content = richTextEditorRef.current.getContent();

    setAutoSaveStatus('saving');
    updateDocMutation.mutate({
      documentId: selectedDocument.id,
      userId: currentUserId,
      content
    });
  }, [selectedDocument, currentUserId, updateDocMutation]);

  // Handle wiki-text import
  const handleWikiImport = useCallback((html: string, wikitext: string) => {
    if (richTextEditorRef.current) {
      // Get current content
      const currentContent = richTextEditorRef.current.getContent();

      // Append imported content
      const newContent = currentContent + '\n\n' + html;

      // Set the new content
      richTextEditorRef.current.setContent(newContent);

      // Trigger auto-save
      if (selectedDocument && currentUserId) {
        setAutoSaveStatus('saving');
        updateDocMutation.mutate({
          documentId: selectedDocument.id,
          userId: currentUserId,
          content: newContent
        });
      }
    }
  }, [selectedDocument, currentUserId, updateDocMutation]);

  // Export functions
  const handleExport = useCallback((format: 'html' | 'markdown' | 'pdf' | 'json') => {
    if (!currentDocument?.content) {
      toast.error('No content to export');
      return;
    }

    const title = currentDocument.title;
    const content = currentDocument.content;

    switch (format) {
      case 'html':
        const htmlBlob = new Blob([`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div>${content}</div>
</body>
</html>`], { type: 'text/html' });
        const htmlUrl = URL.createObjectURL(htmlBlob);
        const htmlLink = document.createElement('a');
        htmlLink.href = htmlUrl;
        htmlLink.download = `${title}.html`;
        htmlLink.click();
        break;

      case 'markdown':
        // Simple HTML to Markdown conversion
        const markdown = content
          .replace(/<h1>(.*?)<\/h1>/g, '# $1\n')
          .replace(/<h2>(.*?)<\/h2>/g, '## $1\n')
          .replace(/<h3>(.*?)<\/h3>/g, '### $1\n')
          .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
          .replace(/<em>(.*?)<\/em>/g, '*$1*')
          .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
          .replace(/<br\s*\/?>/g, '\n')
          .replace(/<[^>]+>/g, '');

        const mdBlob = new Blob([`# ${title}\n\n${markdown}`], { type: 'text/markdown' });
        const mdUrl = URL.createObjectURL(mdBlob);
        const mdLink = document.createElement('a');
        mdLink.href = mdUrl;
        mdLink.download = `${title}.md`;
        mdLink.click();
        break;

      case 'json':
        const jsonData = {
          title,
          content,
          version: currentDocument.version,
          createdAt: currentDocument.createdAt,
          updatedAt: currentDocument.updatedAt,
          exportedAt: new Date().toISOString()
        };
        const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonLink = document.createElement('a');
        jsonLink.href = jsonUrl;
        jsonLink.download = `${title}.json`;
        jsonLink.click();
        break;

      case 'pdf':
        // For PDF, we'll use the browser's print dialog
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
          printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; }
    @media print {
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div>${content}</div>
</body>
</html>`);
          printWindow.document.close();
          printWindow.print();
        }
        break;
    }

    setShowExportModal(false);
    toast.success(`Exported as ${format.toUpperCase()}`);
  }, [currentDocument]);

  // Handle document selection
  const handleSelectDocument = useCallback((doc: Document) => {
    setSelectedDocument(doc);
    setView('edit');
    setIsEditing(false);

    // Update URL with document ID for sharing
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}?doc=${doc.id}`;
      window.history.pushState({}, '', newUrl);
    }
  }, []);

  // Load document from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && documents) {
      const urlParams = new URLSearchParams(window.location.search);
      const docId = urlParams.get('doc');

      if (docId) {
        const doc = documents.find(d => d.id === docId);
        if (doc) {
          handleSelectDocument(doc as Document);
        }
      }
    }
  }, [documents, handleSelectDocument]);

  // Cleanup auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Document List View
  if (view === 'list') {
    const docCount = documents?.length || 0;
    const canCreateMore = docCount < 10;

    return (
      <Card className={`glass-hierarchy-child ${className}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <FileText className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Collaborative Documents</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {docCount} / 10 documents used
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHelpModal(true)}
                title="Help & Documentation"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                disabled={!canCreateMore}
                className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Document
              </Button>
            </div>
          </div>

          {!canCreateMore && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Document limit reached (10/10). Delete a document to create a new one.
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className="glass-hierarchy-interactive cursor-pointer hover:border-orange-500/50 transition-all"
                    onClick={() => handleSelectDocument(doc as Document)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-orange-400" />
                          <h3 className="font-semibold text-sm truncate max-w-[200px]">
                            {doc.title}
                          </h3>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {doc.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Version {doc.version}</p>
                        <p>Updated {new Date(doc.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Documents Yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first collaborative document to start working together.
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Document
              </Button>
            </div>
          )}
        </CardContent>

        {/* Create Document Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Document</DialogTitle>
              <DialogDescription>
                Create a Scriptor Doc to work on together.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="doc-title">Document Title</Label>
                <Input
                  id="doc-title"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Enter document title..."
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {newDocTitle.length} / 200 characters
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="doc-public"
                  checked={newDocIsPublic}
                  onChange={(e) => setNewDocIsPublic(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="doc-public" className="cursor-pointer">
                  Make this document publicly viewable
                </Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    if (!newDocTitle.trim()) {
                      toast.error('Please enter a document title');
                      return;
                    }
                    if (!currentUserId) {
                      toast.error('User ID not found. Please try refreshing the page.');
                      return;
                    }
                    createDocMutation.mutate({
                      groupId,
                      title: newDocTitle,
                      createdBy: currentUserId,
                      isPublic: newDocIsPublic
                    });
                  }}
                  disabled={createDocMutation.isPending || !newDocTitle.trim() || !currentUserId}
                >
                  {createDocMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Document
                </Button>
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Help Modal */}
        <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-orange-500" />
                IxLabs: Scriptor Help
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">Getting Started</h3>
                <p className="text-muted-foreground">
                Scriptor is a lore writing and planning space that allows users to create and edit documents while collaborating in real-time.
               You can share documents with other users and edit them together, import wiki-text, and export as HTML, Markdown, JSON, or PDF. 
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">Features</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Real-time Auto-save:</strong> Your changes are automatically saved every 2 seconds</li>
                  <li><strong>Version Control:</strong> Each save increments the document version number</li>
                  <li><strong>Rich Text Editing:</strong> Format text, add links, images, and more</li>
                  <li><strong>Export Options:</strong> Download as HTML, Markdown, JSON, or PDF</li>
                  <li><strong>Privacy Controls:</strong> Make documents public or keep them members-only</li>
                  <li><strong>Collaborative Editing:</strong> Multiple users can edit simultaneously (with WebSocket support)</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">Keyboard Shortcuts</h3>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+S</kbd> Manual Save</div>
                  <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+B</kbd> Bold</div>
                  <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+I</kbd> Italic</div>
                  <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+U</kbd> Underline</div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">Tips</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Use descriptive titles to help organize your documents</li>
                  <li>Export important documents regularly as backups</li>
                  <li>Make documents public only if you want non-members to view them</li>
                  <li>The version number helps track document evolution</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  // Document Edit View
  const isOwnerOrCreator = currentDocument?.createdBy === currentUserId || isOwner;

  return (
    <Card className={`glass-hierarchy-child ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setView('list');
                setSelectedDocument(null);
                setIsEditing(false);
                // Clear URL parameter
                if (typeof window !== 'undefined') {
                  window.history.pushState({}, '', window.location.pathname);
                }
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="p-2 bg-orange-500/20 rounded-lg">
              <FileText className="h-5 w-5 text-orange-400" />
            </div>

            <div>
              <CardTitle className="text-lg">{currentDocument?.title || selectedDocument?.title}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Version {currentDocument?.version || selectedDocument?.version}</span>
                <Badge variant={autoSaveStatus === 'saved' ? 'default' : autoSaveStatus === 'saving' ? 'secondary' : 'destructive'} className="text-xs">
                  {autoSaveStatus === 'saved' && <><Check className="h-3 w-3 mr-1" /> Saved</>}
                  {autoSaveStatus === 'saving' && <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...</>}
                  {autoSaveStatus === 'unsaved' && <>Unsaved</>}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelpModal(true)}
              title="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (selectedDocument && typeof window !== 'undefined') {
                  const shareUrl = `${window.location.origin}${window.location.pathname}?doc=${selectedDocument.id}`;
                  navigator.clipboard.writeText(shareUrl);
                  toast.success('Document link copied to clipboard!');
                }
              }}
              title="Copy Share Link"
            >
              <Share2 className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExportModal(true)}
              title="Export"
            >
              <Download className="h-4 w-4" />
            </Button>

            {isOwnerOrCreator && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete Document"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}

            {isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWikiImporter(true)}
                title="Import Wiki-Text"
              >
                <FileText className="h-4 w-4 mr-2" />
                Import Wiki-Text
              </Button>
            )}

            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <Button onClick={handleSaveDocument} disabled={updateDocMutation.isPending}>
                {updateDocMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="p-4">
        {isEditing ? (
          <RichTextEditor
            key={`editor-${selectedDocument?.id}-${isEditing}`}
            ref={richTextEditorRef}
            initialContent={currentDocument?.content || selectedDocument?.content || ''}
            placeholder="Start writing your collaborative document..."
            minHeight={500}
            maxHeight={800}
            showToolbar={true}
            onContentChange={handleContentChange}
          />
        ) : (
          <div>
            <div
              className="prose prose-sm max-w-none min-h-[500px]"
              dangerouslySetInnerHTML={{ __html: currentDocument?.content || selectedDocument?.content || '<p class="text-muted-foreground">No content yet. Click Edit to start writing.</p>' }}
            />
          </div>
        )}
      </CardContent>

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Document</DialogTitle>
            <DialogDescription>
              Choose a format to export your document
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-24 flex-col"
              onClick={() => handleExport('html')}
            >
              <Code className="h-8 w-8 mb-2 text-orange-500" />
              <span>HTML</span>
              <span className="text-xs text-muted-foreground">Web format</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col"
              onClick={() => handleExport('markdown')}
            >
              <FileText className="h-8 w-8 mb-2 text-blue-500" />
              <span>Markdown</span>
              <span className="text-xs text-muted-foreground">Plain text</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col"
              onClick={() => handleExport('pdf')}
            >
              <FileDown className="h-8 w-8 mb-2 text-red-500" />
              <span>PDF</span>
              <span className="text-xs text-muted-foreground">Print format</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col"
              onClick={() => handleExport('json')}
            >
              <FileJson className="h-8 w-8 mb-2 text-green-500" />
              <span>JSON</span>
              <span className="text-xs text-muted-foreground">Data format</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The document will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-4">
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedDocument && currentUserId) {
                  deleteDocMutation.mutate({
                    documentId: selectedDocument.id,
                    userId: currentUserId
                  });
                }
              }}
              disabled={deleteDocMutation.isPending}
            >
              {deleteDocMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Modal (same as in list view) */}
      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-orange-500" />
              IxLabs: Scriptor Help
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold mb-2">Getting Started</h3>
              <p className="text-muted-foreground">
              Scriptor is a lore writing and planning space that allows users to create and edit documents while collaborating in real-time.
              You can share documents with other users and edit them together, import wiki-text, and export as HTML, Markdown, JSON, or PDF.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Features</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Real-time Auto-save:</strong> Your changes are automatically saved every 2 seconds</li>
                <li><strong>Version Control:</strong> Each save increments the document version number</li>
                <li><strong>Rich Text Editing:</strong> Format text, add links, images, and more</li>
                <li><strong>Export Options:</strong> Download as HTML, Markdown, JSON, or PDF</li>
                <li><strong>Privacy Controls:</strong> Make documents public or keep them members-only</li>
                <li><strong>Collaborative Editing:</strong> Multiple users can edit simultaneously (with WebSocket support)</li>
              </ul>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Keyboard Shortcuts</h3>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+S</kbd> Manual Save</div>
                <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+B</kbd> Bold</div>
                <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+I</kbd> Italic</div>
                <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+U</kbd> Underline</div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Tips</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Use descriptive titles to help organize your documents</li>
                <li>Export important documents regularly as backups</li>
                <li>Make documents public only if you want non-members to view them</li>
                <li>The version number helps track document evolution</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wiki-Text Importer */}
      <WikiTextImporter
        isOpen={showWikiImporter}
        onClose={() => setShowWikiImporter(false)}
        onImport={handleWikiImport}
      />
    </Card>
  );
}
