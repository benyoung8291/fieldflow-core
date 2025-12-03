import { useState, useRef, KeyboardEvent, ChangeEvent, DragEvent } from "react";
import { Paperclip, Send, Loader2 } from "lucide-react";
import { useSendMessage } from "@/hooks/chat/useChatOperations";
import { useChatStorage } from "@/hooks/chat/useChatStorage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatAttachmentPreview } from "./ChatAttachmentPreview";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  channelId: string;
  onTyping?: () => void;
}

interface PendingFile {
  file: File;
  preview?: string;
}

export function ChatInput({ channelId, onTyping }: ChatInputProps) {
  const [content, setContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendMessage();
  const { uploadFile } = useChatStorage();

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
    // Broadcast typing event
    onTyping?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
    if (!trimmedContent && selectedFiles.length === 0) return;

    try {
      let attachments: Array<{
        file_name: string;
        file_url: string;
        file_type: string;
        file_size: number;
      }> = [];

      // Upload files if any
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
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      // Cleanup
      selectedFiles.forEach((pf) => {
        if (pf.preview) URL.revokeObjectURL(pf.preview);
      });
      setContent("");
      setSelectedFiles([]);
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
  const isSending = sendMessage.isPending || isUploading;

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
      {/* Attachment Preview */}
      <ChatAttachmentPreview
        files={selectedFiles}
        onRemove={removeFile}
        isUploading={isUploading}
      />

      {/* Input Row */}
      <div className="flex items-end gap-2 p-4">
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

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={isDragOver ? "Drop files here..." : "Type a message..."}
          className="min-h-[36px] max-h-[120px] resize-none py-2"
          rows={1}
          disabled={isSending}
        />

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

      <p className="px-4 pb-2 text-xs text-muted-foreground">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
