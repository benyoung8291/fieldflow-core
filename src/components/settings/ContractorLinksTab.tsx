import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Copy, Trash2, Link, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface ContractorLink {
  id: string;
  tenant_id: string;
  token: string;
  name: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
}

export default function ContractorLinksTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<ContractorLink | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    expires_at: "",
  });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["contractor-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contractor_field_report_links")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ContractorLink[];
    },
  });

  const createLink = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const token = crypto.randomUUID();
      
      const { error } = await supabase
        .from("contractor_field_report_links")
        .insert({
          tenant_id: profile.tenant_id,
          token,
          name: formData.name,
          expires_at: formData.expires_at || null,
          created_by: profile.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractor-links"] });
      toast.success("Contractor link created");
      handleDialogClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create link");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("contractor_field_report_links")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractor-links"] });
      toast.success("Link status updated");
    },
    onError: () => {
      toast.error("Failed to update link");
    },
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contractor_field_report_links")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractor-links"] });
      toast.success("Link deleted");
      setDeleteDialogOpen(false);
      setSelectedLink(null);
    },
    onError: () => {
      toast.error("Failed to delete link");
    },
  });

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setFormData({ name: "", expires_at: "" });
  };

  const copyLinkToClipboard = (token: string) => {
    const url = `${window.location.origin}/public/contractor-field-report/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const getPublicUrl = (token: string) => {
    return `${window.location.origin}/public/contractor-field-report/${token}`;
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Contractor Field Report Links</h3>
          <p className="text-sm text-muted-foreground">
            Create public links for contractors to submit field reports
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Link
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : links.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <Link className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-medium mb-1">No contractor links</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a link to allow contractors to submit field reports
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Link
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => {
              const expired = isExpired(link.expires_at);
              return (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">{link.name}</TableCell>
                  <TableCell>
                    {expired ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : link.is_active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {link.expires_at
                      ? format(new Date(link.expires_at), "MMM d, yyyy")
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(link.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Switch
                        checked={link.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: link.id, is_active: checked })
                        }
                        disabled={expired}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLinkToClipboard(link.token)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(getPublicUrl(link.token), "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedLink(link);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Create Link Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Contractor Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Link Name</Label>
              <Input
                id="name"
                placeholder="e.g., Main Contractor Portal"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires_at">Expiry Date (Optional)</Label>
              <Input
                id="expires_at"
                type="date"
                value={formData.expires_at}
                onChange={(e) =>
                  setFormData({ ...formData, expires_at: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for no expiration
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDialogClose}>
              Cancel
            </Button>
            <Button
              onClick={() => createLink.mutate()}
              disabled={!formData.name || createLink.isPending}
            >
              {createLink.isPending ? "Creating..." : "Create Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Link?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the contractor link "{selectedLink?.name}".
              Contractors will no longer be able to submit reports using this link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedLink && deleteLink.mutate(selectedLink.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
