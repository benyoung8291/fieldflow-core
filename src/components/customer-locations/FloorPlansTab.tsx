import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileText, Trash2, Download, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface FloorPlansTabProps {
  locationId: string;
  tenantId: string;
}

export function FloorPlansTab({ locationId, tenantId }: FloorPlansTabProps) {
  const queryClient = useQueryClient();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Form state
  const [floorName, setFloorName] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: floorPlans = [], isLoading } = useQuery({
    queryKey: ["floor-plans", locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("floor_plans")
        .select("*")
        .eq("customer_location_id", locationId)
        .order("floor_number", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const uploadFloorPlan = async () => {
    if (!selectedFile || !floorName) {
      toast.error("Please provide a floor name and select a file");
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${tenantId}/${locationId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("floor-plans")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("floor-plans")
        .getPublicUrl(fileName);

      // Create floor plan record
      const { data: floorPlanData, error: insertError } = await supabase
        .from("floor_plans")
        .insert({
          tenant_id: tenantId,
          customer_location_id: locationId,
          name: floorName,
          file_name: selectedFile.name,
          file_path: fileName,
          file_url: publicUrl,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          floor_number: floorNumber ? parseInt(floorNumber) : null,
          description: description || null,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // If it's a PDF, trigger background conversion to image for faster loading
      const isPdf = selectedFile.type === "application/pdf" || fileExt?.toLowerCase() === "pdf";
      if (isPdf && floorPlanData) {
        toast.success("Floor plan uploaded. Converting PDF to image for faster loading...");
        
        // Trigger conversion in background - don't await
        supabase.functions.invoke('convert-pdf-to-image', {
          body: {
            floorPlanId: floorPlanData.id,
            filePath: fileName,
          }
        }).then(({ data, error }) => {
          if (error) {
            console.error("PDF conversion error:", error);
          } else {
            console.log("PDF converted successfully:", data);
            queryClient.invalidateQueries({ queryKey: ["floor-plans", locationId] });
          }
        });
      } else {
        toast.success("Floor plan uploaded successfully");
      }
      
      queryClient.invalidateQueries({ queryKey: ["floor-plans", locationId] });
      
      // Reset form
      setIsUploadDialogOpen(false);
      setFloorName("");
      setFloorNumber("");
      setDescription("");
      setSelectedFile(null);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload floor plan");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const plan = floorPlans.find(p => p.id === id);
      if (!plan) throw new Error("Floor plan not found");

      // Delete from storage
      if (plan.file_path) {
        const { error: storageError } = await supabase.storage
          .from("floor-plans")
          .remove([plan.file_path]);

        if (storageError) {
          console.error("Storage deletion error:", storageError);
        }
      }

      // Delete record
      const { error } = await supabase
        .from("floor_plans")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Floor plan deleted");
      queryClient.invalidateQueries({ queryKey: ["floor-plans", locationId] });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete floor plan");
    },
  });

  const handlePreview = (plan: any) => {
    const url = plan.file_url || plan.file_path;
    if (url) {
      setPreviewUrl(url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Floor Plans</h3>
          <p className="text-sm text-muted-foreground">
            Manage floor plans for this location
          </p>
        </div>
        <Button onClick={() => setIsUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Floor Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : floorPlans.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Floor Plans</h3>
            <p className="text-muted-foreground mb-4">
              Upload floor plans to enable markup in the customer portal
            </p>
            <Button onClick={() => setIsUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload First Floor Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Floor Name</TableHead>
                <TableHead>Floor #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>File Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {floorPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    {plan.floor_number ? (
                      <Badge variant="secondary">{plan.floor_number}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {plan.description || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {plan.file_size 
                      ? `${(plan.file_size / 1024 / 1024).toFixed(2)} MB`
                      : "-"
                    }
                  </TableCell>
                  <TableCell>
                    {new Date(plan.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePreview(plan)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const url = plan.file_url || plan.file_path;
                          if (url) window.open(url, "_blank");
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(plan.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Floor Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="floor-name">Floor Name *</Label>
              <Input
                id="floor-name"
                value={floorName}
                onChange={(e) => setFloorName(e.target.value)}
                placeholder="e.g., Ground Floor, Level 2"
              />
            </div>
            <div>
              <Label htmlFor="floor-number">Floor Number</Label>
              <Input
                id="floor-number"
                type="number"
                value={floorNumber}
                onChange={(e) => setFloorNumber(e.target.value)}
                placeholder="e.g., 1, 2, 3"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="file">File *</Label>
              <Input
                id="file"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 52428800) {
                      toast.error("File size must be less than 50MB");
                      e.target.value = "";
                      return;
                    }
                    setSelectedFile(file);
                  }
                }}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Supported: Images and PDF files (max 50MB)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUploadDialogOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={uploadFloorPlan}
              disabled={!floorName || !selectedFile || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Floor Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The floor plan file and all associated markups will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Floor Plan Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewUrl && (
              previewUrl.endsWith('.pdf') ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full"
                  title="Floor plan preview"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Floor plan preview"
                  className="w-full h-auto"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
