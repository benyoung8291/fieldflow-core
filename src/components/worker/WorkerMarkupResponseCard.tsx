import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Circle, Clock, Camera, Image as ImageIcon, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkerMarkupResponseCardProps {
  markup: any;
  index: number;
  ticketId: string;
}

export function WorkerMarkupResponseCard({
  markup,
  index,
  ticketId,
}: WorkerMarkupResponseCardProps) {
  const [notes, setNotes] = useState(markup.response_notes || "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-warning animate-pulse" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-warning/10 text-warning border-warning/20">In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos((prev) => [...prev, ...files]);

    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPhotoPreviewUrls((prev) => [...prev, ...newPreviews]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const submitResponseMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload photos
      const uploadedPhotos: string[] = [];
      for (const photo of photos) {
        const fileExt = photo.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("helpdesk-attachments")
          .upload(filePath, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("helpdesk-attachments")
          .getPublicUrl(filePath);

        uploadedPhotos.push(publicUrl);
      }

      // Update markup with response
      const { error: updateError } = await supabase
        .from("ticket_markups")
        .update({
          response_notes: notes,
          response_photos: uploadedPhotos,
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: user.id,
        })
        .eq("id", markup.id);

      if (updateError) throw updateError;

      // Check if all markups are completed
      const { data: allMarkups } = await supabase
        .from("ticket_markups")
        .select("status")
        .eq("ticket_id", ticketId);

      const allCompleted = allMarkups?.every((m) => m.status === "completed");

      // Update ticket status
      await supabase
        .from("helpdesk_tickets")
        .update({
          status: allCompleted ? "pending_review" : "in_progress",
        })
        .eq("id", ticketId);
    },
    onSuccess: () => {
      toast.success("Response submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["appointment-requests"] });
      queryClient.invalidateQueries({ queryKey: ["worker-request-details"] });
      setNotes("");
      setPhotos([]);
      photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      setPhotoPreviewUrls([]);
    },
    onError: (error: Error) => {
      toast.error("Failed to submit response: " + error.message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(markup.status || "pending")}
            <span>
              {markup.markup_data?.type === "pin" ? "📍 Pin" : "🔲 Zone"} #{index + 1}
            </span>
          </div>
          {getStatusBadge(markup.status || "pending")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customer's Request */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Customer's Request:</p>
          {(markup.notes || markup.markup_data?.notes) ? (
            <p className="text-sm text-muted-foreground">
              {markup.notes || markup.markup_data?.notes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No notes provided</p>
          )}

          {(markup.photo_url || markup.markup_data?.photo_url) && (
            <div className="mt-2">
              <img
                src={markup.photo_url || markup.markup_data?.photo_url}
                alt="Customer photo"
                className="w-full rounded-lg border"
              />
            </div>
          )}
        </div>

        {/* Response Section */}
        {markup.status !== "completed" && (
          <div className="space-y-3 pt-3 border-t">
            <p className="text-sm font-medium">Your Response:</p>

            <Textarea
              placeholder="Add notes about the work completed..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />

            {/* Photo Previews */}
            {photoPreviewUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoPreviewUrls.map((url, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-24 object-cover rounded border"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => removePhoto(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => document.getElementById(`photo-upload-${markup.id}`)?.click()}
              >
                <Camera className="h-4 w-4 mr-2" />
                Add Photos
              </Button>
              <input
                id={`photo-upload-${markup.id}`}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />

              <Button
                className="flex-1"
                onClick={() => submitResponseMutation.mutate()}
                disabled={submitResponseMutation.isPending || !notes}
              >
                {submitResponseMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Completed Response Display */}
        {markup.status === "completed" && markup.response_notes && (
          <div className="space-y-2 pt-3 border-t">
            <p className="text-sm font-medium text-success">Completed Response:</p>
            <p className="text-sm text-muted-foreground">{markup.response_notes}</p>

            {markup.response_photos && Array.isArray(markup.response_photos) && markup.response_photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {markup.response_photos.map((photoUrl: string, idx: number) => (
                  <img
                    key={idx}
                    src={photoUrl}
                    alt={`Response ${idx + 1}`}
                    className="w-full h-24 object-cover rounded border"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
