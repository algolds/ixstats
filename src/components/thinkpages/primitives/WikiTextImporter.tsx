"use client";

import React, { useState } from 'react';
import { FileText, Upload, Sparkles, Image as ImageIcon, Link as LinkIcon, AlertCircle, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Label } from '~/components/ui/label';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { ScrollArea } from '~/components/ui/scroll-area';
import { parseWikiText, extractWikiImages, extractWikiLinks } from '~/lib/wikitext-parser';
import { toast } from 'sonner';

interface WikiTextImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (html: string, wikitext: string) => void;
}

export function WikiTextImporter({ isOpen, onClose, onImport }: WikiTextImporterProps) {
  const [wikitext, setWikitext] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [links, setLinks] = useState<Array<{ page: string; display?: string }>>([]);
  const [activeTab, setActiveTab] = useState<'input' | 'preview' | 'info'>('input');

  const handleParse = () => {
    if (!wikitext.trim()) {
      toast.error('Please enter some wiki-text to import');
      return;
    }

    try {
      // Parse wiki-text to HTML
      const html = parseWikiText(wikitext, {
        imageBaseUrl: 'https://ixwiki.com/wiki/Special:Redirect/file',
        wikiBaseUrl: 'https://ixwiki.com/wiki',
        allowHtml: true
      });

      setPreviewHtml(html);

      // Extract metadata
      const extractedImages = extractWikiImages(wikitext);
      const extractedLinks = extractWikiLinks(wikitext);

      setImages(extractedImages);
      setLinks(extractedLinks);

      // Switch to preview tab
      setActiveTab('preview');

      toast.success('Wiki-text parsed successfully!');
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Failed to parse wiki-text. Please check the syntax.');
    }
  };

  const handleImport = () => {
    if (!previewHtml) {
      toast.error('Please parse the wiki-text first');
      return;
    }

    onImport(previewHtml, wikitext);
    handleClose();
    toast.success('Wiki-text imported successfully!');
  };

  const handleClose = () => {
    setWikitext('');
    setPreviewHtml('');
    setImages([]);
    setLinks([]);
    setActiveTab('input');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            Import Wiki-Text
          </DialogTitle>
          <DialogDescription>
            Paste wiki-text from any MediaWiki site (IxWiki, Wikipedia, etc.) and it will be automatically converted with full syntax support.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
          <TabsList className="grid w-full grid-cols-3 mb-4 flex-shrink-0">
            <TabsTrigger value="input" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Input
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2" disabled={!previewHtml}>
              <FileText className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="info" className="flex items-center gap-2" disabled={!previewHtml}>
              <AlertCircle className="h-4 w-4" />
              Info
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="input" className="h-full mt-0 flex flex-col">
              <Alert className="mb-4 flex-shrink-0">
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  <strong>Supported syntax:</strong> Headings, bold, italic, lists, links, images, tables, templates, and more!
                  <br />
                  <strong>Image support:</strong> Uses IxWiki Commons image repository automatically.
                </AlertDescription>
              </Alert>

              <div className="flex-1 flex flex-col min-h-0 mb-4">
                <Label htmlFor="wikitext" className="mb-2 flex-shrink-0">Wiki-Text</Label>
                <ScrollArea className="flex-1 border rounded-md">
                  <Textarea
                    id="wikitext"
                    value={wikitext}
                    onChange={(e) => setWikitext(e.target.value)}
                    placeholder={`Paste your wiki-text here, for example:

== Heading ==
This is '''bold''' and ''italic'' text.

* List item 1
* List item 2

[[File:Example.jpg|thumb|200px|Caption here]]

[[Internal Link]] and [https://example.com External Link]

{| class="wikitable"
! Header 1 !! Header 2
|-
| Cell 1 || Cell 2
|-
| Cell 3 || Cell 4
|}`}
                    className="min-h-[400px] font-mono text-sm resize-none border-0 focus-visible:ring-0"
                  />
                </ScrollArea>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <Button onClick={handleParse} className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Parse Wiki-Text
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="h-full mt-0 flex flex-col">
              <Alert className="mb-4 flex-shrink-0">
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Preview your converted content below. Click "Import to Document" to add it.
                </AlertDescription>
              </Alert>

              <ScrollArea className="flex-1 border border-border rounded-lg p-6 bg-background mb-4">
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </ScrollArea>

              <div className="flex gap-2 flex-shrink-0">
                <Button onClick={handleImport} className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700">
                  <Check className="h-4 w-4 mr-2" />
                  Import to Document
                </Button>
                <Button variant="outline" onClick={() => setActiveTab('input')}>
                  Back to Edit
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="info" className="h-full mt-0 flex flex-col">
              <ScrollArea className="flex-1 mb-4">
                <div className="space-y-6 pr-4">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon className="h-5 w-5 text-orange-500" />
                      <h3 className="font-semibold">Images Found ({images.length})</h3>
                    </div>
                    {images.length > 0 ? (
                      <div className="space-y-2">
                        {images.map((img, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                            <Badge variant="outline" className="text-xs">
                              File:{img}
                            </Badge>
                            <span className="text-xs text-muted-foreground truncate">
                              → https://ixwiki.com/wiki/Special:Redirect/file/{img}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No images found in the wiki-text</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <LinkIcon className="h-5 w-5 text-blue-500" />
                      <h3 className="font-semibold">Internal Links Found ({links.length})</h3>
                    </div>
                    {links.length > 0 ? (
                      <div className="space-y-2">
                        {links.slice(0, 20).map((link, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                            <Badge variant="outline" className="text-xs">
                              {link.page}
                            </Badge>
                            {link.display && link.display !== link.page && (
                              <span className="text-xs text-muted-foreground">
                                (displayed as: {link.display})
                              </span>
                            )}
                          </div>
                        ))}
                        {links.length > 20 && (
                          <p className="text-xs text-muted-foreground">
                            ... and {links.length - 20} more links
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No internal links found in the wiki-text</p>
                    )}
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Note:</strong> Images are loaded from the IxWiki Commons repository. Make sure the image files exist on IxWiki for them to display correctly.
                    </AlertDescription>
                  </Alert>
                </div>
              </ScrollArea>

              <div className="flex gap-2 flex-shrink-0">
                <Button onClick={handleImport} className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700">
                  <Check className="h-4 w-4 mr-2" />
                  Import to Document
                </Button>
                <Button variant="outline" onClick={() => setActiveTab('preview')}>
                  Back to Preview
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
