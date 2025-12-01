import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { FloorPlanViewer, Markup, MarkupType } from "@/components/customer/FloorPlanViewer";
import { FloorPlanMarkupList } from "@/components/customer/FloorPlanMarkupList";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MobileFloorPlanViewer } from "@/components/customer/MobileFloorPlanViewer";

export default function SharedFloorPlanMarkup() {
  const { token } = useParams<{ token: string }>();
  const [shareLink, setShareLink] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [mode, setMode] = useState<MarkupType>("pin");
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [requestTitle, setRequestTitle] = useState("Floor plan request");
  const [requestDescription, setRequestDescription] = useState("");
  const [selectedMarkupId, setSelectedMarkupId] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState<Set<string>>(new Set());
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    loadShareLink();
  }, [token]);

  const loadShareLink = async () => {
    if (!token) {
      setError("Invalid share link");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("floor_plan_share_links")
        .select(`
          *,
          floor_plan:floor_plans(id, name, file_url, image_url),
          location:customer_locations(name)
        `)
        .eq("token", token)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        setError("Invalid or expired share link");
        setLoading(false);
        return;
      }

      // Check expiry
      if (new Date(data.expires_at) < new Date()) {
        setError("This share link has expired");
        setLoading(false);
        return;
      }

      // Check submission limit
      if (data.max_submissions && data.usage_count >= data.max_submissions) {
        setError("Maximum submissions reached for this link");
        setLoading(false);
        return;
      }

      setShareLink(data);
      setLoading(false);
    } catch (err) {
      console.error("Error loading share link:", err);
      setError("Failed to load share link");
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (markups.length === 0) {
      toast.error("Please add at least one markup");
      return;
    }

    const incompleteMarkups = markups.filter(m => !m.notes?.trim());
    if (incompleteMarkups.length > 0) {
      toast.error("Please add descriptions to all markups");
      return;
    }

    setShowSubmitDialog(true);
  };

  const confirmSubmit = async () => {
    setSubmitting(true);

    try {
      const response = await supabase.functions.invoke('create-shared-markup-request', {
        body: {
          token,
          markups: markups.map(m => {
            if (m.type === 'pin') {
              return {
                type: 'pin',
                x: m.x,
                y: m.y,
                notes: m.notes,
                photo: typeof m.photo === 'string' ? m.photo : undefined,
              };
            } else {
              return {
                type: 'zone',
                x: 0,
                y: 0,
                bounds: m.bounds,
                notes: m.notes,
                photo: typeof m.photo === 'string' ? m.photo : undefined,
              };
            }
          }),
          submitterName: submitterName || undefined,
          submitterEmail: submitterEmail || undefined,
          requestTitle: requestTitle || undefined,
          requestDescription: requestDescription || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit request');
      }

      setSubmitted(true);
      setShowSubmitDialog(false);
      toast.success("Request submitted successfully!");
    } catch (err: any) {
      console.error("Error submitting request:", err);
      toast.error(err.message || "Failed to submit request");
      setSubmitting(false);
    }
  };

  const updateMarkupNote = (id: string, notes: string) => {
    setMarkups((prev) => prev.map((m) => (m.id === id ? { ...m, notes } : m)));
  };

  const updateMarkupPhoto = (id: string, photo: File | string | null) => {
    setMarkups((prev) => prev.map((m) => (m.id === id ? { ...m, photo: photo || undefined } : m)));
    
    if (typeof photo === 'string' || photo === null) {
      setUploadingPhotos(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const deleteMarkup = (id: string) => {
    setMarkups((prev) => prev.filter((m) => m.id !== id));
    setSelectedMarkupId(null);
    toast.success("Markup deleted");
  };

  const getTimeRemaining = () => {
    if (!shareLink) return "";
    const now = new Date();
    const expiry = new Date(shareLink.expires_at);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Link Unavailable</h2>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Request Submitted!</h2>
              <p className="text-muted-foreground">
                Your floor plan request has been submitted successfully. The team will review it shortly.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mobile view
  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-background">
          <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-background to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold truncate">{shareLink.floor_plan.name}</h1>
                <p className="text-xs text-muted-foreground">{shareLink.location.name}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{getTimeRemaining()}</span>
              </div>
            </div>
          </div>
          <div className="h-full pt-20 pb-20">
            <MobileFloorPlanViewer
              pdfUrl={shareLink.floor_plan.file_url || ""}
              imageUrl={shareLink.floor_plan.image_url}
              markups={markups}
              onMarkupsChange={setMarkups}
              uploadingPhotos={uploadingPhotos}
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
            <Button 
              className="w-full"
              onClick={handleSubmit}
              disabled={markups.length === 0 || uploadingPhotos.size > 0}
            >
              {uploadingPhotos.size > 0 ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Submit Request (${markups.length})`
              )}
            </Button>
          </div>
        </div>

        <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Your Name (Optional)</Label>
                <Input
                  id="name"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="email">Your Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label htmlFor="title">Request Title</Label>
                <Input
                  id="title"
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                  placeholder="Brief description"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="Additional details..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSubmitDialog(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={confirmSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Desktop view
  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{shareLink.floor_plan.name}</h1>
                <p className="text-sm text-muted-foreground">{shareLink.location.name}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Expires in {getTimeRemaining()}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {shareLink.usage_count} / {shareLink.max_submissions || '∞'} used
                </div>
                <Button 
                  onClick={handleSubmit}
                  disabled={markups.length === 0 || uploadingPhotos.size > 0}
                >
                  {uploadingPhotos.size > 0 ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    `Submit Request (${markups.length})`
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-4">
          <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-10rem)] rounded-2xl border overflow-hidden">
            <ResizablePanel defaultSize={75} minSize={50}>
              <div className="h-full p-4 flex flex-col">
                <div className="flex-1 min-h-0">
                  <FloorPlanViewer
                    pdfUrl={shareLink.floor_plan.file_url || ""}
                    imageUrl={shareLink.floor_plan.image_url}
                    markups={markups}
                    onMarkupsChange={setMarkups}
                    mode={mode}
                    onModeChange={setMode}
                  />
                </div>
              </div>
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40} collapsible collapsedSize={4}>
              <div className="h-full p-4 overflow-auto">
                <FloorPlanMarkupList
                  markups={markups}
                  onMarkupUpdate={updateMarkupNote}
                  onMarkupPhotoUpdate={updateMarkupPhoto}
                  onMarkupDelete={deleteMarkup}
                  selectedMarkupId={selectedMarkupId}
                  onMarkupSelect={setSelectedMarkupId}
                  uploadingPhotos={uploadingPhotos}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Your Name (Optional)</Label>
              <Input
                id="name"
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Your Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="title">Request Title</Label>
              <Input
                id="title"
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                placeholder="Brief description"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={requestDescription}
                onChange={(e) => setRequestDescription(e.target.value)}
                placeholder="Additional details..."
                rows={3}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {markups.length} markup(s) will be included with this request
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={confirmSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
