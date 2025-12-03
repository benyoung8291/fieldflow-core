import { X, FileText, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingFile {
  file: File;
  preview?: string;
}

interface ChatAttachmentPreviewProps {
  files: PendingFile[];
  onRemove: (index: number) => void;
  isUploading?: boolean;
}

export function ChatAttachmentPreview({
  files,
  onRemove,
  isUploading,
}: ChatAttachmentPreviewProps) {
  if (files.length === 0) return null;

  const isImage = (file: File) => file.type.startsWith("image/");

  return (
    <div className="flex flex-wrap gap-2 border-t bg-muted/30 p-2">
      {files.map((item, index) => (
        <div
          key={index}
          className="relative flex items-center gap-2 rounded-lg border bg-background p-2 pr-8"
        >
          {item.preview && isImage(item.file) ? (
            <img
              src={item.preview}
              alt={item.file.name}
              className="h-12 w-12 rounded object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
              {isImage(item.file) ? (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          )}
          <div className="flex flex-col">
            <span className="max-w-28 truncate text-xs font-medium">
              {item.file.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {(item.file.size / 1024).toFixed(1)} KB
            </span>
          </div>
          {!isUploading && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onRemove(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
