import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Download, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

interface KnowledgeArticleAttachmentsProps {
  articleId: string;
}

export function KnowledgeArticleAttachments({
  articleId,
}: KnowledgeArticleAttachmentsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      return data;
    },
  });

  const { data: attachments } = useQuery({
    queryKey: ["knowledge-attachments", articleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_article_attachments")
        .select("*")
        .eq("article_id", articleId)
        .order("display_order")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const uploadAttachment = async () => {
    if (!file || !profile?.id || !profile.tenant_id) return;

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.tenant_id}/knowledge/${articleId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("knowledge_article_attachments")
        .insert({
          article_id: articleId,
          tenant_id: profile.tenant_id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
          description: description || null,
          uploaded_by: profile.id,
        });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["knowledge-attachments"] });
      setIsDialogOpen(false);
      setFile(null);
      setDescription("");
      toast({
        title: "Success",
        description: "Attachment uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (attachmentId: string, filePath: string) => {
    try {
      // Extract the storage path from the public URL
      const pathMatch = filePath.match(/documents\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from("documents").remove([pathMatch[1]]);
      }

      const { error } = await supabase
        .from("knowledge_article_attachments")
        .delete()
        .eq("id", attachmentId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["knowledge-attachments"] });
      toast({
        title: "Success",
        description: "Attachment deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Attachments & Examples
        </h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              Add Attachment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Attachment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this file about?"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={uploadAttachment}
                  disabled={!file || uploading}
                >
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{attachment.file_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {attachment.file_size && (
                    <span>{formatBytes(attachment.file_size)}</span>
                  )}
                  {attachment.description && (
                    <>
                      <span>•</span>
                      <span className="truncate">{attachment.description}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(attachment.file_url, "_blank")}
              >
                <Download className="h-4 w-4" />
              </Button>
              {profile?.id === attachment.uploaded_by && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    deleteAttachment(attachment.id, attachment.file_url)
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
