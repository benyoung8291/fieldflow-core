import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Download, Trash2, FileText, X } from "lucide-react";
import { Label } from "@/components/ui/label";

interface ServiceOrderAttachmentsProps {
  serviceOrderId: string;
}

export default function ServiceOrderAttachments({ serviceOrderId }: ServiceOrderAttachmentsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["service-order-attachments", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_attachments")
        .select("*")
        .eq("service_order_id", serviceOrderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.tenant_id}/${serviceOrderId}/${Date.now()}-${file.name}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("service-order-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("service_order_attachments")
        .insert({
          tenant_id: profile.tenant_id,
          service_order_id: serviceOrderId,
          file_name: file.name,
          file_url: uploadData.path,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-order-attachments", serviceOrderId] });
      toast({ title: "File uploaded successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachment: any) => {
      const { error: storageError } = await supabase.storage
        .from("service-order-attachments")
        .remove([attachment.file_url]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("service_order_attachments")
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-order-attachments", serviceOrderId] });
      toast({ title: "File deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownload = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("service-order-attachments")
        .download(attachment.file_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadMutation.mutateAsync(file);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadMutation.mutateAsync(file);
      }
    } finally {
      setUploading(false);
    }
  }, [uploadMutation]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <Label htmlFor="file-upload" className="cursor-pointer">
          <div className="text-sm font-medium mb-1">
            Click to upload or drag and drop
          </div>
          <div className="text-xs text-muted-foreground">
            Any file type, up to 20MB per file
          </div>
        </Label>
        <input
          id="file-upload"
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />
        {uploading && (
          <div className="mt-3 text-sm text-muted-foreground">Uploading...</div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-4">
          Loading attachments...
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4">
          No attachments yet
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <Card key={attachment.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {attachment.file_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(attachment)}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this file?")) {
                        deleteMutation.mutate(attachment);
                      }
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
