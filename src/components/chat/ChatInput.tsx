import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent, DragEvent } from "react";
import { Paperclip, Send, Loader2, X, Check } from "lucide-react";
import { useSendMessage, useEditMessage } from "@/hooks/chat/useChatOperations";
import { useChatStorage } from "@/hooks/chat/useChatStorage";
import { MessageWithProfile } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { ChatAttachmentPreview } from "./ChatAttachmentPreview";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  channelId: string;
  channelName?: string;
  onTyping?: () => void;
  editingMessage?: MessageWithProfile | null;
  replyingTo?: MessageWithProfile | null;
  onCancelEdit?: () => void;
  onCancelReply?: () => void;
  isMobileFullScreen?: boolean;
}

interface PendingFile {
  file: File;
  preview?: string;
}

export function ChatInput({ 
  channelId, 
  channelName = "channel",
  onTyping,
  editingMessage,
  replyingTo,
  onCancelEdit,
  onCancelReply,
  isMobileFullScreen,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
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
        "px-4 pb-4 pt-2 transition-colors",
        isDragOver && "bg-primary/5",
        // Safe area padding for iOS devices with home indicator
        isMobileFullScreen && "pb-safe"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Reply Banner - Slack style */}
      {replyingTo && !editingMessage && (
        <div className="flex items-center gap-2 mb-2 py-1.5 text-sm">
          <div className="h-4 w-0.5 rounded-full bg-primary" />
          <span className="text-muted-foreground">Replying to</span>
          <span className="font-medium">{replyingTo.profile?.first_name || "User"}</span>
          <span className="text-muted-foreground truncate max-w-[200px]">
            {truncateText(replyingTo.content)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 flex-shrink-0 ml-auto"
            onClick={onCancelReply}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Edit Banner - Slack style */}
      {editingMessage && (
        <div className="flex items-center gap-2 mb-2 py-1.5 text-sm">
          <div className="h-4 w-0.5 rounded-full bg-warning" />
          <span className="text-warning font-medium">Editing message</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 flex-shrink-0 ml-auto"
            onClick={() => {
              onCancelEdit?.();
              setContent("");
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Main Input Container - Slack style rounded box */}
      <div
        className={cn(
          "rounded-lg border transition-all",
          isFocused || isDragOver
            ? "border-primary shadow-sm"
            : "border-border",
          isDragOver && "ring-2 ring-primary/20"
        )}
      >
        {/* Attachment Preview */}
        {!editingMessage && selectedFiles.length > 0 && (
          <div className="border-b">
            <ChatAttachmentPreview
              files={selectedFiles}
              onRemove={removeFile}
              isUploading={isUploading}
            />
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            isDragOver 
              ? "Drop files here..." 
              : editingMessage 
                ? "Edit your message..." 
                : `Message #${channelName}`
          }
          className="w-full resize-none bg-transparent px-3 py-3 text-sm placeholder:text-muted-foreground focus:outline-none min-h-[44px] max-h-[200px]"
          rows={1}
          disabled={isSending}
        />

        {/* Bottom Toolbar - Clean and functional */}
        <div className="flex items-center justify-between px-2 py-1.5 border-t border-border/50">
          <div className="flex items-center gap-0.5">
            {!editingMessage && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending}
                >
                  <Paperclip className="h-4 w-4" />
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
          </div>

          <div className="flex items-center gap-1">
            {/* Send Button */}
            <Button
              size="icon"
              className={cn(
                "h-8 w-8 transition-all",
                canSend 
                  ? editingMessage 
                    ? "bg-warning hover:bg-warning/90 text-warning-foreground" 
                    : "bg-slack-online hover:bg-slack-online/90 text-white"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
              onClick={handleSend}
              disabled={!canSend || isSending}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingMessage ? (
                <Check className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Hint text - hide on mobile full screen */}
      {!isMobileFullScreen && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {editingMessage 
            ? "Escape to cancel • Enter to save"
            : "Shift + Enter for new line"
          }
        </p>
      )}
    </div>
  );
}
