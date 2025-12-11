import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paperclip, Send, X, Minus, Maximize2, GripHorizontal, BookmarkPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RichTextEditorLazy as RichTextEditor } from "@/components/ui/RichTextEditorLazy";
import { SnippetInserter } from "./SnippetInserter";
import { SnippetManager } from "./SnippetManager";
import { SaveDraftAsSnippetDialog } from "./SaveDraftAsSnippetDialog";
import { EditorEmojiPicker } from "@/components/ui/editor-emoji-picker";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import type ReactQuill from "react-quill";

export interface EmailComposerRef {
  reset: () => void;
  insertContent: (html: string) => void;
}

interface EmailComposerEnhancedProps {
  defaultTo?: string;
  defaultSubject?: string;
  onSend: (data: { to: string; cc: string; bcc: string; subject: string; body: string }) => Promise<void>;
  isSending?: boolean;
  emailThread?: Array<{
    from: string;
    to: string;
    date: string;
    body: string;
  }>;
  ticketId?: string;
}

export const EmailComposerEnhanced = forwardRef<EmailComposerRef, EmailComposerEnhancedProps>(
  ({ defaultTo = "", defaultSubject = "", onSend, isSending = false, emailThread = [], ticketId }, ref) => {
    const { toast } = useToast();
    const [to, setTo] = useState(defaultTo);
    const [cc, setCc] = useState("");
    const [bcc, setBcc] = useState("");
    const [subject, setSubject] = useState(defaultSubject);
    const [body, setBody] = useState("");
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [composerHeight, setComposerHeight] = useState(500);
    const [isDragging, setIsDragging] = useState(false);
    const [snippetManagerOpen, setSnippetManagerOpen] = useState(false);
    const [saveSnippetDialogOpen, setSaveSnippetDialogOpen] = useState(false);
    const [includeSignature, setIncludeSignature] = useState(true);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<ReactQuill>(null);

    // Insert emoji at cursor position
    const handleEmojiInsert = (emoji: string) => {
      const editor = editorRef.current?.getEditor();
      if (editor) {
        const range = editor.getSelection(true);
        editor.insertText(range.index, emoji);
        editor.setSelection(range.index + emoji.length, 0);
      }
    };

    // Insert HTML snippet at cursor using Quill API
    const handleInsertSnippetHtml = (html: string, metadata?: { type: string; id: string; title: string }) => {
      const editor = editorRef.current?.getEditor();
      if (editor) {
        const range = editor.getSelection(true);
        let index = range ? range.index : editor.getLength() - 1;
        
        // Check if this is a card snippet (has table structure with border styling)
        const isCardSnippet = /<table[^>]*style="[^"]*border[^"]*"/.test(html);
        
        if (isCardSnippet) {
          // Ensure there's editable space before the card if at start
          if (index === 0) {
            editor.insertText(0, '\n', 'user');
            index = 1;
          }
          
          // Use custom keepHTML blot to preserve the HTML structure
          editor.insertEmbed(index, 'keepHTML', html, 'user');
          
          // Add editable space after the card
          editor.insertText(index + 1, '\n\n', 'user');
          
          // Position cursor after the card in editable space
          editor.setSelection(index + 3, 0);
        } else {
          // Regular content - insert via dangerouslyPasteHTML
          editor.clipboard.dangerouslyPasteHTML(index, html);
          setTimeout(() => {
            editor.setSelection(editor.getLength(), 0);
          }, 0);
        }
      } else {
        // Fallback if editor ref not available
        setBody(prev => prev + html);
      }
    };

    // Discard draft
    const handleDiscard = () => {
      setBody("");
      setTo(defaultTo);
      setCc("");
      setBcc("");
      setSubject(defaultSubject);
      setAttachments([]);
      setIsExpanded(false);
    };

    // Fetch user profile with signature
    const { data: userProfile } = useQuery({
      queryKey: ["user-email-signature"],
      queryFn: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, phone, email_signature, tenant_id")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        return data;
      },
    });

    // Fetch tenant info
    const { data: tenant } = useQuery({
      queryKey: ["tenant-for-signature", userProfile?.tenant_id],
      queryFn: async () => {
        if (!userProfile?.tenant_id) return null;
        const { data, error } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", userProfile.tenant_id)
          .single();

        if (error) throw error;
        return data;
      },
      enabled: !!userProfile?.tenant_id,
    });

    const getRenderedSignature = () => {
      if (!userProfile?.email_signature || !includeSignature) return "";

      let signature = userProfile.email_signature;
      signature = signature.replace(/\{\{first_name\}\}/g, userProfile.first_name || "");
      signature = signature.replace(/\{\{last_name\}\}/g, userProfile.last_name || "");
      signature = signature.replace(/\{\{full_name\}\}/g, `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim());
      signature = signature.replace(/\{\{email\}\}/g, userProfile.email || "");
      signature = signature.replace(/\{\{phone\}\}/g, userProfile.phone || "");
      signature = signature.replace(/\{\{company_name\}\}/g, tenant?.name || "");
      signature = signature.replace(/\{\{job_title\}\}/g, "");

      return DOMPurify.sanitize(signature);
    };

    useEffect(() => {
      setTo(defaultTo);
    }, [defaultTo]);

    useEffect(() => {
      if (defaultSubject && !subject) {
        setSubject(defaultSubject);
      }
    }, [defaultSubject]);

    useImperativeHandle(ref, () => ({
      reset: () => {
        setTo(defaultTo);
        setCc("");
        setBcc("");
        setSubject(defaultSubject);
        setBody("");
        setShowCc(false);
        setShowBcc(false);
        setAttachments([]);
      },
      insertContent: (html: string) => {
        setBody(prev => prev + html);
      },
    }));

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      setAttachments(prev => [...prev, ...files]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = async () => {
      if (!to.trim()) {
        toast({
          title: "Recipient required",
          description: "Please enter at least one recipient",
          variant: "destructive",
        });
        return;
      }

      if (!body.trim()) {
        toast({
          title: "Message required",
          description: "Please enter a message",
          variant: "destructive",
        });
        return;
      }

      // Append signature to body if enabled
      const signature = getRenderedSignature();
      const fullBody = signature 
        ? `${body}<br/><br/>--<br/>${signature}`
        : body;

      await onSend({ to, cc, bcc, subject, body: fullBody });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      e.preventDefault();
    };

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && composerRef.current) {
          const rect = composerRef.current.getBoundingClientRect();
          const newHeight = rect.bottom - e.clientY;
          setComposerHeight(Math.max(350, Math.min(900, newHeight)));
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
      };

      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isDragging]);

    if (!isExpanded) {
      return (
        <div className="border-t bg-background">
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full px-6 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Reply</span>
            </div>
            <Maximize2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      );
    }

    return (
      <>
        <div 
          ref={composerRef}
          className={cn(
            "border-t bg-background flex flex-col transition-all duration-200 relative",
            isFullscreen && "fixed inset-0 z-50 border-none"
          )}
          style={{ height: isFullscreen ? '100vh' : isExpanded ? `${composerHeight}px` : 'auto' }}
        >
          {/* Resize Handle */}
          {isExpanded && !isFullscreen && (
            <div
              onMouseDown={handleMouseDown}
              className={cn(
                "absolute -top-2 left-0 right-0 h-4 cursor-ns-resize hover:bg-primary/10 transition-colors group flex items-center justify-center",
                isDragging && "bg-primary/20"
              )}
            >
              <div className={cn(
                "flex items-center gap-1 px-3 py-1 rounded-full bg-muted border transition-all",
                isDragging ? "bg-primary/20 border-primary" : "group-hover:bg-accent group-hover:border-primary/50"
              )}>
                <GripHorizontal className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
              </div>
            </div>
          )}

          {/* Header */}
          <div className="px-4 py-2 border-b flex items-center justify-between bg-muted/30 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">New Message</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsExpanded(false)}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Recipients - compact header */}
            <div className="px-2 py-1 space-y-1 border-b bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium w-10 shrink-0 text-muted-foreground">To</Label>
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 h-7 text-sm border-0 bg-transparent focus-visible:ring-0 px-1"
                />
                <div className="flex items-center">
                  {!showCc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCc(true)}
                      className="h-6 text-xs px-2"
                    >
                      Cc
                    </Button>
                  )}
                  {!showBcc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBcc(true)}
                      className="h-6 text-xs px-2"
                    >
                      Bcc
                    </Button>
                  )}
                </div>
              </div>

              {showCc && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium w-10 shrink-0 text-muted-foreground">Cc</Label>
                  <Input
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="cc@example.com"
                    className="flex-1 h-7 text-sm border-0 bg-transparent focus-visible:ring-0 px-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setShowCc(false);
                      setCc("");
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {showBcc && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium w-10 shrink-0 text-muted-foreground">Bcc</Label>
                  <Input
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    placeholder="bcc@example.com"
                    className="flex-1 h-7 text-sm border-0 bg-transparent focus-visible:ring-0 px-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setShowBcc(false);
                      setBcc("");
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Subject */}
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium w-10 shrink-0 text-muted-foreground">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject"
                  className="flex-1 h-7 text-sm border-0 bg-transparent focus-visible:ring-0 px-1"
                />
              </div>
            </div>

            {/* Rich Text Editor - full height */}
            <div className="flex-1 flex flex-col min-h-0">
              <RichTextEditor
                ref={editorRef}
                value={body}
                onChange={setBody}
                placeholder="Write your message..."
                className="flex-1 h-full [&_.ql-toolbar]:rounded-none [&_.ql-toolbar]:border-x-0 [&_.ql-container]:rounded-none [&_.ql-container]:border-x-0 [&_.ql-container]:border-b-0"
              />
            </div>

            {/* Signature Preview - compact */}
            {userProfile?.email_signature && includeSignature && (
              <div className="px-2 py-1 border-t bg-muted/20 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Signature</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[10px] px-1"
                    onClick={() => setIncludeSignature(false)}
                  >
                    Remove
                  </Button>
                </div>
                <div 
                  className="text-xs text-muted-foreground pl-2 border-l border-muted max-h-16 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: getRenderedSignature() }}
                />
              </div>
            )}

            {!includeSignature && userProfile?.email_signature && (
              <div className="px-2 py-1 border-t bg-muted/20 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px]"
                  onClick={() => setIncludeSignature(true)}
                >
                  + Add Signature
                </Button>
              </div>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="px-2 py-1 border-t bg-muted/20 shrink-0">
                <div className="flex flex-wrap gap-1">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 px-2 py-0.5 bg-background rounded border text-xs"
                    >
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Gmail-style Footer Actions */}
          <div className="px-3 py-2 border-t bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Primary Send Button */}
              <Button
                onClick={handleSend}
                disabled={isSending || !to.trim() || !body.trim()}
                size="sm"
                className="px-4"
              >
                {isSending ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Sending
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-2" />
                    Send
                  </>
                )}
              </Button>
              
              {/* Separator */}
              <div className="h-5 w-px bg-border mx-1" />
              
              {/* Formatting tools group */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              
              <EditorEmojiPicker onEmojiSelect={handleEmojiInsert} />
              
              {ticketId && (
                <SnippetInserter 
                  ticketId={ticketId} 
                  onInsertSnippet={handleInsertSnippetHtml}
                  onOpenSnippetManager={() => setSnippetManagerOpen(true)}
                />
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSaveSnippetDialogOpen(true)}
                disabled={!body.trim()}
                title="Save as snippet"
                className="h-8 text-xs"
              >
                <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
                Save Snippet
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={handleDiscard}
                title="Discard draft"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <SnippetManager open={snippetManagerOpen} onOpenChange={setSnippetManagerOpen} />
        <SaveDraftAsSnippetDialog 
          open={saveSnippetDialogOpen} 
          onOpenChange={setSaveSnippetDialogOpen}
          content={body}
        />
      </>
    );
  }
);

EmailComposerEnhanced.displayName = "EmailComposerEnhanced";
