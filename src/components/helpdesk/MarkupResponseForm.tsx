import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, Image as ImageIcon, X, Loader2, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MarkupResponseFormProps {
  markup: any;
  ticketId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MarkupResponseForm({ markup, ticketId, onSuccess, onCancel }: MarkupResponseFormProps) {
  const [notes, setNotes] = useState(markup.response_notes || "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitResponseMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Upload photos if any
      let uploadedPhotoUrls: string[] = [];
      if (photos.length > 0) {
        uploadedPhotoUrls = await Promise.all(
          photos.map(async (photo) => {
            const fileExt = photo.name.split('.').pop();
            const fileName = `${markup.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${profile.tenant_id}/helpdesk/markup-responses/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('documents')
              .upload(filePath, photo);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('documents')
              .getPublicUrl(filePath);

            return publicUrl;
          })
        );
      }

      // Combine existing photos with new ones
      const existingPhotos = Array.isArray(markup.response_photos) ? markup.response_photos : [];
      const allPhotos = [...existingPhotos, ...uploadedPhotoUrls];

      // Update the markup with response
      const { error: updateError } = await supabase
        .from("ticket_markups")
        .update({
          response_notes: notes,
          response_photos: allPhotos,
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: user.id,
        } as any) // Types will update after migration
        .eq("id", markup.id);

      if (updateError) throw updateError;

      // Check if all markups are completed, update ticket status
      const { data: allMarkups } = await supabase
        .from("ticket_markups")
        .select("status")
        .eq("ticket_id", ticketId);

      const allCompleted = allMarkups?.every((m: any) => m.status === "completed");
      
      if (allCompleted) {
        await supabase
          .from("helpdesk_tickets")
          .update({ status: "pending_review" })
          .eq("id", ticketId);
      } else {
        // Set to in_progress if not all completed
        await supabase
          .from("helpdesk_tickets")
          .update({ status: "in_progress" })
          .eq("id", ticketId);
      }
    },
    onSuccess: () => {
      toast({ title: "Response submitted successfully" });
      queryClient.invalidateQueries({ queryKey: ["ticket-markups", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticketId] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit response",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => [...prev, ...files]);
    
    // Create preview URLs
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviewUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Card className="p-4 space-y-4 border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Submit Response</h4>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Customer's original request */}
      <div className="p-3 bg-background rounded-lg space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Customer's Request:</p>
        <p className="text-sm">{markup.notes || "No notes provided"}</p>
        {markup.photo_url && (
          <img
            src={markup.photo_url}
            alt="Customer photo"
            className="w-full max-h-48 object-contain rounded border mt-2"
          />
        )}
      </div>

      {/* Response form */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="response-notes" className="text-sm">Your Response *</Label>
          <Textarea
            id="response-notes"
            placeholder="Describe the work completed, parts used, etc..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1.5 min-h-[100px]"
            required
          />
        </div>

        <div>
          <Label className="text-sm">Response Photos</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="mt-1.5 space-y-2">
            {/* Photo previews */}
            {photoPreviewUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {photoPreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded border"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePhoto(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add photo buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute("capture");
                    fileInputRef.current.click();
                  }
                }}
                className="flex-1"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Choose Photo
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Submit button */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => submitResponseMutation.mutate()}
          disabled={!notes.trim() || submitResponseMutation.isPending}
          className="flex-1"
        >
          {submitResponseMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Submit Response
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
