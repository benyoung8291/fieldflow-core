import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Paperclip, Bold, Italic, Underline, List, Link as LinkIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  isSending?: boolean;
}

export function EmailComposer({ onSend, defaultTo = "", isSending = false }: EmailComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
    <div className="border-t bg-background">
      {/* Collapsed Header */}
      {!isExpanded && (
        <div 
          className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-accent/50"
          onClick={() => setIsExpanded(true)}
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Compose Reply</span>
            {to && <span className="text-muted-foreground">to {to}</span>}
          </div>
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Expanded Composer */}
      {isExpanded && (
        <div className="space-y-2 p-3">
          {/* Header with collapse button */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">New Message</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => setIsExpanded(false)}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
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
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[120px] text-sm resize-none"
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
}