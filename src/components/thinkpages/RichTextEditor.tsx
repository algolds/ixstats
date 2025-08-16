"use client";

import React, { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Button } from '~/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline, 
  Link, 
  List, 
  ListOrdered, 
  Quote,
  Code,
  Image,
  Smile,
  Send,
  Paperclip,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import { Separator } from '~/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

interface RichTextEditorProps {
  placeholder?: string;
  initialContent?: string;
  onSubmit?: (content: string, plainText: string) => void;
  onContentChange?: (content: string, plainText: string) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  minHeight?: number;
  maxHeight?: number;
  showToolbar?: boolean;
  submitButtonText?: string;
  className?: string;
}

export interface RichTextEditorRef {
  getContent: () => string;
  getPlainText: () => string;
  setContent: (content: string) => void;
  clear: () => void;
  focus: () => void;
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  placeholder = "Type a message...",
  initialContent = "",
  onSubmit,
  onContentChange,
  onTyping,
  disabled = false,
  minHeight = 60,
  maxHeight = 200,
  showToolbar = true,
  submitButtonText = "Send",
  className = ""
}, ref) => {
  const [content, setContent] = useState(initialContent);
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const editorRef = React.useRef<HTMLDivElement>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getContent: () => content,
    getPlainText: () => editorRef.current?.textContent || '',
    setContent: (newContent: string) => {
      setContent(newContent);
      if (editorRef.current) {
        editorRef.current.innerHTML = newContent;
      }
    },
    clear: () => {
      setContent('');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    },
    focus: () => {
      editorRef.current?.focus();
    }
  }));

  const execCommand = useCallback((command: string, value?: string) => {
    if (editorRef.current) {
      document.execCommand(command, false, value);
      editorRef.current.focus();
      handleContentChange();
    }
  }, []);

  const handleContentChange = useCallback(() => {
    if (!editorRef.current) return;
    
    const newContent = editorRef.current.innerHTML;
    const plainText = editorRef.current.textContent || '';
    
    setContent(newContent);
    onContentChange?.(newContent, plainText);
    
    // Handle typing indicator
    const isCurrentlyTyping = plainText.trim().length > 0;
    if (isCurrentlyTyping !== isTyping) {
      setIsTyping(isCurrentlyTyping);
      onTyping?.(isCurrentlyTyping);
    }
  }, [onContentChange, onTyping, isTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!editorRef.current || disabled) return;
    
    const content = editorRef.current.innerHTML;
    const plainText = editorRef.current.textContent || '';
    
    if (plainText.trim()) {
      onSubmit?.(content, plainText);
      // Clear editor after submit
      editorRef.current.innerHTML = '';
      setContent('');
      setIsTyping(false);
      onTyping?.(false);
    }
  }, [onSubmit, disabled, onTyping]);

  const insertLink = useCallback(() => {
    if (linkUrl && linkText) {
      execCommand('insertHTML', `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`);
      setLinkUrl('');
      setLinkText('');
      setIsLinkPopoverOpen(false);
    }
  }, [linkUrl, linkText, execCommand]);

  const toolbarButtons = [
    { icon: Bold, command: 'bold', tooltip: 'Bold (Ctrl+B)' },
    { icon: Italic, command: 'italic', tooltip: 'Italic (Ctrl+I)' },
    { icon: Underline, command: 'underline', tooltip: 'Underline (Ctrl+U)' },
    { icon: Code, command: 'formatBlock', value: 'pre', tooltip: 'Code' },
  ];

  const advancedButtons = [
    { icon: List, command: 'insertUnorderedList', tooltip: 'Bullet List' },
    { icon: ListOrdered, command: 'insertOrderedList', tooltip: 'Numbered List' },
    { icon: Quote, command: 'formatBlock', value: 'blockquote', tooltip: 'Quote' },
  ];

  const alignmentButtons = [
    { icon: AlignLeft, command: 'justifyLeft', tooltip: 'Align Left' },
    { icon: AlignCenter, command: 'justifyCenter', tooltip: 'Align Center' },
    { icon: AlignRight, command: 'justifyRight', tooltip: 'Align Right' },
  ];

  return (
    <div className={`border rounded-lg bg-background ${className}`}>
      {showToolbar && (
        <div className="flex items-center gap-1 p-2 border-b">
          {/* Basic formatting */}
          {toolbarButtons.map(({ icon: Icon, command, value, tooltip }) => (
            <Button
              key={command}
              variant="ghost"
              size="sm"
              onClick={() => execCommand(command, value)}
              disabled={disabled}
              title={tooltip}
              className="h-8 w-8 p-0"
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* Lists and quotes */}
          {advancedButtons.map(({ icon: Icon, command, value, tooltip }) => (
            <Button
              key={command}
              variant="ghost"
              size="sm"
              onClick={() => execCommand(command, value)}
              disabled={disabled}
              title={tooltip}
              className="h-8 w-8 p-0"
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* Alignment */}
          {alignmentButtons.map(({ icon: Icon, command, tooltip }) => (
            <Button
              key={command}
              variant="ghost"
              size="sm"
              onClick={() => execCommand(command)}
              disabled={disabled}
              title={tooltip}
              className="h-8 w-8 p-0"
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* Link */}
          <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                title="Insert Link"
                className="h-8 w-8 p-0"
              >
                <Link className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="linkText">Link Text</Label>
                  <Input
                    id="linkText"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    placeholder="Enter link text..."
                  />
                </div>
                <div>
                  <Label htmlFor="linkUrl">URL</Label>
                  <Input
                    id="linkUrl"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <Button onClick={insertLink} size="sm" className="w-full">
                  Insert Link
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Emoji and attachments */}
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            title="Emoji"
            className="h-8 w-8 p-0"
          >
            <Smile className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            title="Attach File"
            className="h-8 w-8 p-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleContentChange}
          onKeyDown={handleKeyDown}
          className={`
            p-3 outline-none resize-none overflow-y-auto
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          style={{
            minHeight: `${minHeight}px`,
            maxHeight: `${maxHeight}px`
          }}
          data-placeholder={placeholder}
          suppressContentEditableWarning={true}
        />
        
        {/* Placeholder */}
        {!content && !disabled && (
          <div 
            className="absolute top-3 left-3 text-muted-foreground pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {placeholder}
          </div>
        )}
      </div>
      
      {onSubmit && (
        <div className="flex items-center justify-between p-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Type className="h-3 w-3" />
            <span>Ctrl+Enter to send</span>
          </div>
          
          <Button
            onClick={handleSubmit}
            disabled={disabled || !content.trim()}
            size="sm"
            className="min-w-16"
          >
            <Send className="h-3 w-3 mr-1" />
            {submitButtonText}
          </Button>
        </div>
      )}
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;