import { useState, useRef, KeyboardEvent, ChangeEvent } from "react";
import { Paperclip, Send, X, Loader2 } from "lucide-react";
import { useSendMessage } from "@/hooks/chat/useChatOperations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  channelId: string;
}

interface PendingAttachment {
  file: File;
  preview?: string;
}

export function ChatInput({ channelId }: ChatInputProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendMessage();

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && attachments.length === 0) return;

    try {
      await sendMessage.mutateAsync({
        channelId,
        content: trimmedContent || "",
      });

      setContent("");
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("[Chat] Failed to send message:", error);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: PendingAttachment[] = files.map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const updated = [...prev];
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview!);
      }
      updated.splice(index, 1);
      return updated;
    });
  };

  const canSend = content.trim().length > 0 || attachments.length > 0;
  const isSending = sendMessage.isPending;

  return (
    <div className="border-t bg-background p-4">
      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="relative flex items-center gap-2 rounded-md border bg-muted p-2"
            >
              {attachment.preview ? (
                <img
                  src={attachment.preview}
                  alt={attachment.file.name}
                  className="h-12 w-12 rounded object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded bg-background">
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <span className="max-w-24 truncate text-xs">{attachment.file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 rounded-full"
                onClick={() => removeAttachment(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        {/* Attachment Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Text Input */}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="min-h-[36px] max-h-[120px] resize-none py-2"
          rows={1}
          disabled={isSending}
        />

        {/* Send Button */}
        <Button
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={handleSend}
          disabled={!canSend || isSending}
        >
          {isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Helper Text */}
      <p className="mt-1 text-xs text-muted-foreground">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
