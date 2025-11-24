import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  FileText, 
  Image as ImageIcon, 
  File, 
  Download, 
  ExternalLink,
  X,
  ZoomIn,
  FileSpreadsheet,
  FileArchive,
  Video,
  Music,
  Code
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Attachment {
  id?: string;
  name: string;
  size?: number;
  contentType?: string;
  url?: string;
}

interface AttachmentViewerProps {
  attachments: Attachment[];
  onDownload?: (attachment: Attachment) => void;
  className?: string;
}

export function AttachmentViewer({ attachments, onDownload, className }: AttachmentViewerProps) {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  const getFileIcon = (attachment: Attachment) => {
    const type = attachment.contentType?.toLowerCase() || attachment.name.split('.').pop()?.toLowerCase();
    
    if (!type) return <File className="h-5 w-5" />;
    
    if (type.includes('image')) return <ImageIcon className="h-5 w-5 text-blue-500" />;
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) 
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (type.includes('word') || type.includes('document')) 
      return <FileText className="h-5 w-5 text-blue-600" />;
    if (type.includes('zip') || type.includes('rar') || type.includes('tar')) 
      return <FileArchive className="h-5 w-5 text-orange-500" />;
    if (type.includes('video') || type.includes('mp4') || type.includes('mov')) 
      return <Video className="h-5 w-5 text-purple-500" />;
    if (type.includes('audio') || type.includes('mp3') || type.includes('wav')) 
      return <Music className="h-5 w-5 text-pink-500" />;
    if (type.includes('json') || type.includes('xml') || type.includes('html') || type.includes('js') || type.includes('css')) 
      return <Code className="h-5 w-5 text-gray-500" />;
    
    return <File className="h-5 w-5" />;
  };

  const isImage = (attachment: Attachment) => {
    const type = attachment.contentType?.toLowerCase() || attachment.name.split('.').pop()?.toLowerCase();
    return type?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(type || '');
  };

  const isPdf = (attachment: Attachment) => {
    const type = attachment.contentType?.toLowerCase() || attachment.name.split('.').pop()?.toLowerCase();
    return type?.includes('pdf');
  };

  const canPreview = (attachment: Attachment) => {
    return isImage(attachment) || isPdf(attachment);
  };

  const handlePreview = (attachment: Attachment) => {
    if (canPreview(attachment)) {
      setPreviewAttachment(attachment);
    }
  };

  const handleDownload = (attachment: Attachment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload(attachment);
    }
  };

  if (attachments.length === 0) return null;

  return (
    <>
      <div className={cn("space-y-2", className)}>
        {attachments.map((attachment, idx) => {
          const isImg = isImage(attachment);
          const canPrev = canPreview(attachment);
          
          return (
            <Card 
              key={attachment.id || idx} 
              className={cn(
                "overflow-hidden transition-all hover:shadow-md",
                canPrev && "cursor-pointer"
              )}
              onClick={() => canPrev && handlePreview(attachment)}
            >
              <div className="flex items-center gap-3 p-3">
                {/* Icon or Thumbnail */}
                <div className="flex-shrink-0">
                  {isImg && attachment.url ? (
                    <div className="h-12 w-12 rounded overflow-hidden bg-muted border">
                      <img 
                        src={attachment.url} 
                        alt={attachment.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted border flex items-center justify-center">
                      {getFileIcon(attachment)}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {attachment.name}
                    </p>
                    {canPrev && (
                      <ZoomIn className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                    {attachment.contentType && (
                      <span className="ml-2 capitalize">
                        {attachment.contentType.split('/')[0]}
                      </span>
                    )}
                  </p>
                </div>

                 {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDownload(attachment, e)}
                    className="h-8 w-8 p-0"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Preview Dialog - Only for attachments with URLs */}
      {previewAttachment?.url && (
        <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{previewAttachment?.name}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center bg-muted rounded-lg overflow-auto max-h-[70vh]">
              {isImage(previewAttachment) && (
                <img 
                  src={previewAttachment.url} 
                  alt={previewAttachment.name}
                  className="max-w-full h-auto"
                />
              )}
              {isPdf(previewAttachment) && (
                <iframe 
                  src={previewAttachment.url} 
                  className="w-full h-[70vh]"
                  title={previewAttachment.name}
                />
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => window.open(previewAttachment.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
              <Button onClick={() => onDownload?.(previewAttachment)}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
