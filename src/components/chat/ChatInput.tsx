import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent, DragEvent } from "react";
import { Paperclip, Send, Loader2, X, Check } from "lucide-react";
import { useSendMessage, useEditMessage } from "@/hooks/chat/useChatOperations";
import { useChatStorage } from "@/hooks/chat/useChatStorage";
import { MessageWithProfile } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatAttachmentPreview } from "./ChatAttachmentPreview";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  channelId: string;
  onTyping?: () => void;
  editingMessage?: MessageWithProfile | null;
  replyingTo?: MessageWithProfile | null;
  onCancelEdit?: () => void;
  onCancelReply?: () => void;
}

interface PendingFile {
  file: File;
  preview?: string;
}

export function ChatInput({ 
  channelId, 
  onTyping,
  editingMessage,
  replyingTo,
  onCancelEdit,
  onCancelReply,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendMessage();
  const editMessage = useEditMessage();
  const { uploadFile } = useChatStorage();

  // Pre-fill content when editing
  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  // Focus on textarea when replying
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
    onTyping?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      if (editingMessage) {
        onCancelEdit?.();
        setContent("");
      } else if (replyingTo) {
        onCancelReply?.();
      }
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const newFiles: PendingFile[] = Array.from(files).map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      const updated = [...prev];
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview!);
      }
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleSend = async () => {
    const trimmedContent = content.trim();
    
    // Edit mode
    if (editingMessage) {
      if (!trimmedContent) return;
      try {
        await editMessage.mutateAsync({ messageId: editingMessage.id, content: trimmedContent });
        setContent("");
        onCancelEdit?.();
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      } catch (error) {
        console.error("[Chat] Failed to edit message:", error);
      }
      return;
    }

    // Normal send mode
    if (!trimmedContent && selectedFiles.length === 0) return;

    try {
      let attachments: Array<{
        file_name: string;
        file_url: string;
        file_type: string;
        file_size: number;
      }> = [];

      if (selectedFiles.length > 0) {
        setIsUploading(true);
        const uploadPromises = selectedFiles.map((pf) => uploadFile(pf.file, channelId));
        const results = await Promise.all(uploadPromises);
        
        attachments = results
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .map((r) => ({
            file_name: r.fileName,
            file_url: r.url,
            file_type: r.fileType,
            file_size: r.fileSize,
          }));
      }

      await sendMessage.mutateAsync({
        channelId,
        content: trimmedContent || "",
        replyToId: replyingTo?.id,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      // Cleanup
      selectedFiles.forEach((pf) => {
        if (pf.preview) URL.revokeObjectURL(pf.preview);
      });
      setContent("");
      setSelectedFiles([]);
      onCancelReply?.();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("[Chat] Failed to send message:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const canSend = content.trim().length > 0 || selectedFiles.length > 0;
  const isSending = sendMessage.isPending || editMessage.isPending || isUploading;

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div
      className={cn(
        "border-t bg-background transition-colors",
        isDragOver && "bg-primary/5 ring-2 ring-inset ring-primary"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Reply Banner */}
      {replyingTo && !editingMessage && (
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
          <div className="h-full w-1 rounded-full bg-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Replying to {replyingTo.profile?.first_name || "User"}
            </p>
            <p className="text-sm text-foreground truncate">
              {truncateText(replyingTo.content)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={onCancelReply}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Edit Banner */}
      {editingMessage && (
        <div className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2">
          <div className="h-full w-1 rounded-full bg-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Editing message
            </p>
            <p className="text-sm text-foreground truncate">
              {truncateText(editingMessage.content)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => {
              onCancelEdit?.();
              setContent("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Attachment Preview */}
      {!editingMessage && (
        <ChatAttachmentPreview
          files={selectedFiles}
          onRemove={removeFile}
          isUploading={isUploading}
        />
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2 p-4">
        {!editingMessage && (
          <>
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
          </>
        )}

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isDragOver 
              ? "Drop files here..." 
              : editingMessage 
                ? "Edit your message..." 
                : replyingTo 
                  ? "Type your reply..." 
                  : "Type a message..."
          }
          className="min-h-[36px] max-h-[120px] resize-none py-2"
          rows={1}
          disabled={isSending}
        />

        <Button
          size="icon"
          className={cn(
            "h-9 w-9 flex-shrink-0",
            editingMessage && "bg-amber-500 hover:bg-amber-600"
          )}
          onClick={handleSend}
          disabled={!canSend || isSending}
        >
          {isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : editingMessage ? (
            <Check className="h-5 w-5" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      <p className="px-4 pb-2 text-xs text-muted-foreground">
        {editingMessage 
          ? "Press Enter to save, Escape to cancel"
          : "Press Enter to send, Shift+Enter for new line"
        }
      </p>
    </div>
  );
}
