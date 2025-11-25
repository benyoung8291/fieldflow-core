import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Download, Trash2, FileText, Image as ImageIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AppointmentAttachmentsProps {
  appointmentId: string;
  category: "before_photo" | "document";
  title: string;
  description: string;
}

export function AppointmentAttachments({ 
  appointmentId, 
  category, 
  title, 
  description 
}: AppointmentAttachmentsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["appointment-attachments", appointmentId, category],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("appointment_attachments")
        .select("*")
        .eq("appointment_id", appointmentId)
        .eq("tenant_id", profile?.tenant_id)
        .eq("category", category)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const fileExt = file.name.split(".").pop();
      const fileName = `${appointmentId}/${category}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("appointment-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("appointment-attachments")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from("appointment_attachments")
        .insert({
          appointment_id: appointmentId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
          tenant_id: profile.tenant_id,
          uploaded_by: user.id,
          category: category,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-attachments", appointmentId, category] });
      toast({ title: `${title} uploaded successfully` });
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
      const fileName = attachment.file_url.split("/appointment-attachments/")[1];

      const { error: storageError } = await supabase.storage
        .from("appointment-attachments")
        .remove([fileName]);

      if (storageError) throw storageError;

      const { error: deleteError } = await supabase
        .from("appointment_attachments")
        .delete()
        .eq("id", attachment.id);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-attachments", appointmentId, category] });
      toast({ title: `${title} deleted successfully` });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
      e.target.value = "";
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

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
  };

  const handleDownload = async (attachment: any) => {
    const fileName = attachment.file_url.split("/appointment-attachments/")[1];
    const { data, error } = await supabase.storage
      .from("appointment-attachments")
      .download(fileName);

    if (error) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {category === "before_photo" ? (
              <ImageIcon className="h-5 w-5 text-primary" />
            ) : (
              <FileText className="h-5 w-5 text-primary" />
            )}
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
        >
          <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            {isDragging ? "Drop files here" : "Drag and drop files here, or click to browse"}
          </p>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id={`file-upload-${category}`}
            accept={category === "before_photo" ? "image/*" : "*"}
          />
          <label htmlFor={`file-upload-${category}`}>
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              className="cursor-pointer"
              asChild
            >
              <span>{uploading ? "Uploading..." : "Choose Files"}</span>
            </Button>
          </label>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : attachments.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No {title.toLowerCase()} uploaded yet
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment: any) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {category === "before_photo" && attachment.file_type?.startsWith("image/") ? (
                    <img
                      src={attachment.file_url}
                      alt={attachment.file_name}
                      className="h-12 w-12 object-cover rounded"
                    />
                  ) : (
                    <div className="h-12 w-12 bg-muted rounded flex items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size || 0)} • {formatDistanceToNow(new Date(attachment.uploaded_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(attachment)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(attachment)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}