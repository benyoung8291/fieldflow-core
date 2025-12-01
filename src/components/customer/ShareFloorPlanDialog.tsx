import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";

interface ShareFloorPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floorPlan: any;
  location: any;
}

export function ShareFloorPlanDialog({ 
  open, 
  onOpenChange, 
  floorPlan, 
  location 
}: ShareFloorPlanDialogProps) {
  const [expiryDays, setExpiryDays] = useState(30);
  const [maxSubmissions, setMaxSubmissions] = useState(2);
  const [notes, setNotes] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("customer_portal_users")
        .select("customer_id, tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const { data, error } = await supabase
        .from("floor_plan_share_links")
        .insert({
          floor_plan_id: floorPlan.id,
          tenant_id: profile.tenant_id,
          customer_id: profile.customer_id,
          location_id: location.id,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          max_submissions: maxSubmissions,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const shareUrl = `${window.location.origin}/share/floor-plan/${data.token}`;
      setGeneratedLink(shareUrl);
      queryClient.invalidateQueries({ queryKey: ["share-links"] });
      toast.success("Share link created successfully!");
    },
    onError: (error: any) => {
      console.error("Failed to create share link:", error);
      toast.error(error.message || "Failed to create share link");
    },
  });

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.success("Link copied to clipboard!");
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setExpiryDays(30);
    setMaxSubmissions(2);
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg z-[60]">
        <DialogHeader>
          <DialogTitle>Share Floor Plan</DialogTitle>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Create a public link that allows anyone to view and markup this floor plan. 
                They can submit requests that will appear in your account.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Link Expires In: {expiryDays} {expiryDays === 1 ? 'day' : 'days'}</Label>
                <Slider
                  value={[expiryDays]}
                  onValueChange={(values) => setExpiryDays(values[0])}
                  min={1}
                  max={30}
                  step={1}
                  className="py-4"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum: 30 days
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxSubmissions">Maximum Submissions</Label>
                <Input
                  id="maxSubmissions"
                  type="number"
                  min={1}
                  max={100}
                  value={maxSubmissions}
                  onChange={(e) => setMaxSubmissions(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                />
                <p className="text-xs text-muted-foreground">
                  How many requests can be submitted via this link (1-100)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes about this share link..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Shareable Link</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">Link Settings:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Expires in {expiryDays} {expiryDays === 1 ? 'day' : 'days'}</li>
                <li>• Maximum {maxSubmissions} {maxSubmissions === 1 ? 'submission' : 'submissions'}</li>
                <li>• Floor Plan: {floorPlan.name}</li>
                <li>• Location: {location.name}</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              Anyone with this link can view the floor plan and submit markup requests. 
              You can revoke this link anytime from the My Requests page.
            </p>
          </div>
        )}

        <DialogFooter>
          {!generatedLink ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={() => generateLinkMutation.mutate()}
                disabled={generateLinkMutation.isPending}
              >
                {generateLinkMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Link"
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
