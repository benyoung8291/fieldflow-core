import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Paperclip, Bold, Italic, Underline, List, Link as LinkIcon, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useEmailCollaboration } from "@/hooks/useEmailCollaboration";
import { Badge } from "@/components/ui/badge";

interface EmailComposerProps {
  onSend: (data: {
    to: string[];
    cc: string[];
    bcc: string[];
    subject?: string;
    body: string;
    bodyHtml?: string;
  }) => void;
  defaultTo?: string;
  defaultSubject?: string;
  isSending?: boolean;
  ticketId?: string;
}

export interface EmailComposerRef {
  reset: () => void;
}

export const EmailComposer = forwardRef<EmailComposerRef, EmailComposerProps>(
  ({ onSend, defaultTo = "", defaultSubject = "", isSending = false, ticketId }, ref) => {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLargeComposer, setIsLargeComposer] = useState(false);
  
  // Live collaboration
  const { typingUsers, updateTypingStatus } = useEmailCollaboration(ticketId || "");
  let typingTimeout: NodeJS.Timeout;

  // Update fields when switching tickets
  useEffect(() => {
    setSubject(defaultSubject);
  }, [defaultSubject]);

  useEffect(() => {
    setTo(defaultTo);
  }, [defaultTo]);

  // Expose reset method via ref
  useImperativeHandle(ref, () => ({
    reset: () => {
      setBody("");
      setCc("");
      setBcc("");
      setShowCc(false);
      setShowBcc(false);
      setIsExpanded(false);
      setIsLargeComposer(false);
    }
  }));

  const handleSend = () => {
    const toEmails = to.split(",").map(e => e.trim()).filter(Boolean);
    const ccEmails = cc.split(",").map(e => e.trim()).filter(Boolean);
    const bccEmails = bcc.split(",").map(e => e.trim()).filter(Boolean);

    if (toEmails.length === 0 || !body.trim()) return;

    onSend({
      to: toEmails,
      cc: ccEmails,
      bcc: bccEmails,
      subject: subject || undefined,
      body: body,
    });
  };

  return (
    <div className="sticky bottom-0 border-t bg-background shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20 shrink-0">
      {/* Collapsed Header - More Prominent */}
      {!isExpanded && (
        <div 
          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-primary/10 transition-colors border-l-4 border-l-primary"
          onClick={() => setIsExpanded(true)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Send className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm">Reply to Email</div>
              {to && <div className="text-xs text-muted-foreground">To: {to}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Click to compose</span>
            <ChevronUp className="h-5 w-5 text-primary" />
          </div>
        </div>
      )}

      {/* Expanded Composer */}
      {isExpanded && (
        <div className={cn(
          "space-y-3 p-4 overflow-y-auto",
          isLargeComposer ? "max-h-[80vh]" : "max-h-[500px]"
        )}>
          {/* Header with collapse button */}
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Compose Reply</span>
              {typingUsers.length > 0 && (
                <Badge variant="secondary" className="h-5 text-xs animate-pulse">
                  <Users className="h-3 w-3 mr-1" />
                  {typingUsers.length === 1 
                    ? `${typingUsers[0].userName} is typing...`
                    : `${typingUsers.length} people are typing...`}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsLargeComposer(!isLargeComposer)}
                title={isLargeComposer ? "Compact view" : "Larger composer"}
              >
                <ChevronUp className={cn("h-4 w-4 transition-transform", isLargeComposer && "rotate-180")} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsExpanded(false)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* To Field */}
          <div className="flex items-center gap-2 text-xs">
            <Label className="w-10 text-right shrink-0">To:</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="h-7 text-xs"
            />
            {!showCc && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowCc(true)}
              >
                Cc
              </Button>
            )}
            {!showBcc && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowBcc(true)}
              >
                Bcc
              </Button>
            )}
          </div>

          {/* Cc Field */}
          {showCc && (
            <div className="flex items-center gap-2 text-xs">
              <Label className="w-10 text-right shrink-0">Cc:</Label>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="h-7 text-xs"
              />
            </div>
          )}

          {/* Bcc Field */}
          {showBcc && (
            <div className="flex items-center gap-2 text-xs">
              <Label className="w-10 text-right shrink-0">Bcc:</Label>
              <Input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="bcc@example.com"
                className="h-7 text-xs"
              />
            </div>
          )}

          {/* Subject Field */}
          <div className="flex items-center gap-2 text-xs">
            <Label className="w-10 text-right shrink-0">Subject:</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (optional)"
              className="h-7 text-xs"
            />
          </div>

          <Separator />

          {/* Formatting Toolbar */}
          <div className="flex items-center gap-1 py-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Bold className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Italic className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Underline className="h-3 w-3" />
            </Button>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <List className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <LinkIcon className="h-3 w-3" />
            </Button>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  Format
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  <Button variant="ghost" size="sm" className="w-full justify-start h-7 text-xs">
                    Paragraph
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start h-7 text-xs font-bold">
                    Heading 1
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start h-7 text-xs font-semibold">
                    Heading 2
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Message Body */}
          <Textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              // Update typing status
              if (ticketId) {
                updateTypingStatus(true);
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                  updateTypingStatus(false);
                }, 1000);
              }
            }}
            onBlur={() => ticketId && updateTypingStatus(false)}
            placeholder="Type your message..."
            className={cn(
              "text-sm resize-none",
              isLargeComposer ? "min-h-[400px]" : "min-h-[120px]"
            )}
          />

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <Paperclip className="h-3 w-3 mr-1" />
              Attach
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setTo(defaultTo);
                  setSubject("");
                  setBody("");
                  setCc("");
                  setBcc("");
                  setShowCc(false);
                  setShowBcc(false);
                }}
              >
                Discard
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSend}
                disabled={!to.trim() || !body.trim() || isSending}
              >
                <Send className="h-3 w-3 mr-1" />
                {isSending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});