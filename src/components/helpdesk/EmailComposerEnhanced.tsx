import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paperclip, Send, X, Minus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RichTextEditorLazy as RichTextEditor } from "@/components/ui/RichTextEditorLazy";
import { SnippetInserter } from "./SnippetInserter";

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
    const [composerHeight, setComposerHeight] = useState(400);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);

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

      await onSend({ to, cc, bcc, subject, body });
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
          setComposerHeight(Math.max(300, Math.min(800, newHeight)));
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
              "absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-primary/20 transition-colors group",
              isDragging && "bg-primary/40"
            )}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-border group-hover:bg-primary rounded-full transition-colors" />
          </div>
        )}

        {/* Header */}
        <div className="px-6 py-3 border-b flex items-center justify-between bg-muted/30 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">New Message</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsExpanded(false)}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="p-6 space-y-4 flex-1 flex flex-col">
            {/* Recipients */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium w-12 shrink-0">To</Label>
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1"
                />
                <div className="flex items-center gap-1">
                  {!showCc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCc(true)}
                      className="h-8 text-xs"
                    >
                      Cc
                    </Button>
                  )}
                  {!showBcc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBcc(true)}
                      className="h-8 text-xs"
                    >
                      Bcc
                    </Button>
                  )}
                </div>
              </div>

              {showCc && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium w-12 shrink-0">Cc</Label>
                  <Input
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="cc@example.com"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setShowCc(false);
                      setCc("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {showBcc && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium w-12 shrink-0">Bcc</Label>
                  <Input
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    placeholder="bcc@example.com"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setShowBcc(false);
                      setBcc("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Subject */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium w-12 shrink-0">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject"
                className="flex-1"
              />
            </div>

            {/* Rich Text Editor */}
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder="Write your message..."
                className={cn(
                  "flex-1",
                  isFullscreen ? "min-h-[500px]" : "min-h-[200px]"
                )}
              />
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Attachments</Label>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border"
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-2"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-muted/30 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-9"
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Attach
            </Button>
            {ticketId && (
              <SnippetInserter 
                ticketId={ticketId} 
                onInsertSnippet={(html) => setBody(prev => prev + html)} 
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsExpanded(false);
                toast({
                  title: "Draft saved",
                  description: "Your message has been saved as a draft",
                });
              }}
            >
              Save Draft
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !to.trim() || !body.trim()}
              className="min-w-[100px]"
            >
              {isSending ? (
                <>
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

EmailComposerEnhanced.displayName = "EmailComposerEnhanced";
