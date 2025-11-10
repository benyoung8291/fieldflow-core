import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileText, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProjectFilesTabProps {
  projectId: string;
}

export default function ProjectFilesTab({ projectId }: ProjectFilesTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [category, setCategory] = useState("general");
  const [notes, setNotes] = useState("");
  const [isContract, setIsContract] = useState(false);
  const [extractingContract, setExtractingContract] = useState(false);
  const queryClient = useQueryClient();

  const { data: attachments, isLoading } = useQuery({
    queryKey: ["project-attachments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_attachments")
        .select("*")
        .eq("project_id", projectId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      
      // Fetch uploader details separately
      const attachmentsWithUploader = await Promise.all((data || []).map(async (att: any) => {
        if (!att.uploaded_by) return { ...att, uploader: null };

        const { data: uploader } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", att.uploaded_by)
          .single();

        return { ...att, uploader };
      }));

      return attachmentsWithUploader;
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async () => {
      if (!uploadingFile) throw new Error("No file selected");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Upload file to storage
      const fileExt = uploadingFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${profile.tenant_id}/projects/${projectId}/${fileName}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("project_files")
        .upload(filePath, uploadingFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("project_files")
        .getPublicUrl(filePath);

      // Create attachment record
      const { data: attachment, error: attachmentError } = await supabase
        .from("project_attachments")
        .insert({
          tenant_id: profile.tenant_id,
          project_id: projectId,
          file_name: uploadingFile.name,
          file_url: publicUrl,
          file_type: uploadingFile.type,
          file_size: uploadingFile.size,
          category,
          notes,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (attachmentError) throw attachmentError;

      // If this is a contract, create contract record and extract data
      if (isContract) {
        const { data: contract, error: contractError } = await supabase
          .from("project_contracts")
          .insert({
            tenant_id: profile.tenant_id,
            project_id: projectId,
            attachment_id: attachment.id,
            extraction_status: "pending",
          })
          .select()
          .single();

        if (contractError) throw contractError;

        // Trigger AI extraction
        setExtractingContract(true);
        try {
          const { error: extractError } = await supabase.functions.invoke("extract-contract-data", {
            body: { contractId: contract.id },
          });

          if (extractError) {
            console.error("Contract extraction failed:", extractError);
            toast.warning("File uploaded but AI extraction failed. You can manually enter contract details.");
          } else {
            toast.success("Contract uploaded and data extracted!");
          }
        } finally {
          setExtractingContract(false);
        }
      }

      return attachment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-attachments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-contracts", projectId] });
      if (!isContract) {
        toast.success("File uploaded successfully");
      }
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to upload file");
      setExtractingContract(false);
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const attachment = attachments?.find(a => a.id === attachmentId);
      if (!attachment) throw new Error("Attachment not found");

      // Delete from storage
      const filePath = attachment.file_url.split('/').slice(-4).join('/');
      await supabase.storage.from("project_files").remove([filePath]);

      // Delete record
      const { error } = await supabase
        .from("project_attachments")
        .delete()
        .eq("id", attachmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-attachments", projectId] });
      toast.success("File deleted");
    },
    onError: () => {
      toast.error("Failed to delete file");
    },
  });

  const resetForm = () => {
    setUploadingFile(null);
    setCategory("general");
    setNotes("");
    setIsContract(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingFile(file);
      // Auto-detect if it's likely a contract
      const fileName = file.name.toLowerCase();
      if (fileName.includes('contract') || fileName.includes('agreement')) {
        setIsContract(true);
        setCategory('contract');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadingFile) {
      toast.error("Please select a file");
      return;
    }
    uploadFileMutation.mutate();
  };

  const categoryLabels: Record<string, string> = {
    general: "General",
    contract: "Contract",
    drawing: "Drawing",
    photo: "Photo",
    document: "Document",
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Project Files & Documents</h3>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload File</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>File *</Label>
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    accept="*/*"
                  />
                  {uploadingFile && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {uploadingFile.name} ({formatFileSize(uploadingFile.size)})
                    </p>
                  )}
                </div>

                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="drawing">Drawing</SelectItem>
                      <SelectItem value="photo">Photo</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isContract"
                    checked={isContract}
                    onChange={(e) => setIsContract(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="isContract" className="font-normal cursor-pointer">
                    This is a contract (extract data using AI)
                  </Label>
                </div>

                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this file..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={uploadFileMutation.isPending || extractingContract}
                  >
                    {uploadFileMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : extractingContract ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Extracting Data...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading files...</div>
        ) : attachments && attachments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.map((attachment) => (
                <TableRow key={attachment.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {attachment.file_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {categoryLabels[attachment.category] || attachment.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {attachment.file_size ? formatFileSize(attachment.file_size) : "-"}
                  </TableCell>
                  <TableCell>
                    {attachment.uploader?.first_name} {attachment.uploader?.last_name}
                  </TableCell>
                  <TableCell>
                    {format(new Date(attachment.uploaded_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(attachment.file_url, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this file?")) {
                            deleteFileMutation.mutate(attachment.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No files uploaded yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}