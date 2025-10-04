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
  AlignRight,
  X
} from 'lucide-react';
import { Separator } from '~/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Emoji } from 'react-apple-emojis';
import { api } from '~/trpc/react';
import { CompactDiscordEmojiPicker, formatDiscordEmoji, formatUnicodeEmoji } from './primitives/DiscordEmojiPicker';

interface RichTextEditorProps {
  placeholder?: string;
  initialContent?: string;
  onSubmit?: (content: string, plainText: string, attachments?: File[]) => void;
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
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isEmojiPopoverOpen, setIsEmojiPopoverOpen] = useState(false);
  const [activeEmojiTab, setActiveEmojiTab] = useState<'unicode' | 'discord'>('unicode');
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Set initial content when component mounts or initialContent changes
  React.useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.innerHTML = initialContent;
      setContent(initialContent);
    }
  }, [initialContent]);

  // Fetch Discord emojis
  const { data: discordEmojis, isLoading: discordEmojisLoading } = api.thinkpages.getDiscordEmojis.useQuery({}, {
    enabled: isEmojiPopoverOpen // Only fetch when emoji picker is open
  });

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
    
    if (plainText.trim() || attachments.length > 0) {
      onSubmit?.(content, plainText, attachments);
      // Clear editor after submit
      editorRef.current.innerHTML = '';
      setContent('');
      setAttachments([]);
      setIsTyping(false);
      onTyping?.(false);
    }
  }, [onSubmit, disabled, onTyping, attachments]);

  const insertLink = useCallback(() => {
    if (linkUrl && linkText) {
      execCommand('insertHTML', `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`);
      setLinkUrl('');
      setLinkText('');
      setIsLinkPopoverOpen(false);
    }
  }, [linkUrl, linkText, execCommand]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachments(prev => [...prev, ...files]);
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const insertEmoji = useCallback((emoji: string | { url: string; name: string }) => {
    if (editorRef.current) {
      if (typeof emoji === 'string') {
        // Unicode emoji
        execCommand('insertText', emoji);
      } else {
        // Discord emoji - insert as image
        execCommand('insertHTML', `<img src="${emoji.url}" alt=":${emoji.name}:" class="inline-block h-5 w-5" title=":${emoji.name}:" />`);
      }
      setIsEmojiPopoverOpen(false);
      editorRef.current.focus();
    }
  }, [execCommand]);

  // Common emoji list
  const commonEmojis = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
    '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋',
    '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳',
    '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖',
    '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯',
    '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
    '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏',
    '🙌', '🤲', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
    '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐'
  ];

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
            <PopoverTrigger 
              disabled={disabled}
              title="Insert Link"
              className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground"
            >
              <Link className="h-4 w-4" />
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
          
          {/* Emoji picker */}
          <Popover open={isEmojiPopoverOpen} onOpenChange={setIsEmojiPopoverOpen}>
            <PopoverTrigger
              disabled={disabled}
              title="Insert Emoji"
              className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground"
            >
              <Smile className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
              <div className="border-b">
                <div className="flex">
                  <button
                    onClick={() => setActiveEmojiTab('unicode')}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      activeEmojiTab === 'unicode'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Unicode
                  </button>
                  <button
                    onClick={() => setActiveEmojiTab('discord')}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      activeEmojiTab === 'discord'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Discord ({discordEmojis?.count || 0})
                  </button>
                </div>
              </div>
              
              <div className="p-2">
                {activeEmojiTab === 'unicode' ? (
                  <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
                    {commonEmojis.map((emoji, index) => (
                      <button
                        key={index}
                        onClick={() => insertEmoji(emoji)}
                        className="p-2 text-lg hover:bg-accent rounded transition-colors"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {discordEmojisLoading ? (
                      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                        Loading Discord emojis...
                      </div>
                    ) : discordEmojis?.success && discordEmojis.emojis.length > 0 ? (
                      <div className="grid grid-cols-6 gap-1">
                        {discordEmojis.emojis.map((emoji: any) => (
                          <button
                            key={emoji.id}
                            onClick={() => insertEmoji({ url: emoji.url, name: emoji.name })}
                            className="p-2 hover:bg-accent rounded transition-colors"
                            title={`:${emoji.name}:`}
                          >
                            <img 
                              src={emoji.url} 
                              alt={`:${emoji.name}:`}
                              className="h-6 w-6"
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                        No Discord emojis available
                      </div>
                    )}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            title="Attach File"
            className="h-8 w-8 p-0"
            onClick={handleFileSelect}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar"
      />

      {/* Attachments display */}
      {attachments.length > 0 && (
        <div className="p-2 border-t bg-muted/20">
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-background border rounded-lg p-2 text-sm"
              >
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeAttachment(index)}
                  disabled={disabled}
                  title="Remove attachment"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {onSubmit && (
        <div className="flex items-center justify-between p-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Type className="h-3 w-3" />
            <span>Ctrl+Enter to send</span>
          </div>
          
          <Button
            onClick={handleSubmit}
            disabled={disabled || (!content.trim() && attachments.length === 0)}
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