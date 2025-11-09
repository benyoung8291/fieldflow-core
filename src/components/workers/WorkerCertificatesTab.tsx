import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { format, differenceInDays } from "date-fns";

interface WorkerCertificatesTabProps {
  workerId: string;
}

export default function WorkerCertificatesTab({ workerId }: WorkerCertificatesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    certificate_name: "",
    issuing_organization: "",
    certificate_number: "",
    issue_date: "",
    expiry_date: "",
    status: "active",
    notes: "",
  });

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["worker-certificates", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_certificates")
        .select("*")
        .eq("worker_id", workerId)
        .order("expiry_date", { ascending: true });
      if (error) {
        console.error("Error fetching worker certificates:", error);
        throw error;
      }
      return data || [];
    },
  });

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const certData = {
        ...formData,
        worker_id: workerId,
        tenant_id: profile?.tenant_id,
        issue_date: formData.issue_date || null,
        expiry_date: formData.expiry_date || null,
      };

      if (editingCert) {
        const { error } = await supabase
          .from("worker_certificates")
          .update(certData)
          .eq("id", editingCert.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("worker_certificates")
          .insert([certData]);
        if (error) throw error;
      }

      toast({
        title: editingCert ? "Certificate updated" : "Certificate added",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-certificates", workerId] });
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error saving certificate",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from("worker_certificates")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast({
        title: "Error deleting certificate",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Certificate deleted" });
      queryClient.invalidateQueries({ queryKey: ["worker-certificates", workerId] });
    }
    setDeleteId(null);
  };

  const resetForm = () => {
    setFormData({
      certificate_name: "",
      issuing_organization: "",
      certificate_number: "",
      issue_date: "",
      expiry_date: "",
      status: "active",
      notes: "",
    });
    setEditingCert(null);
  };

  const openEdit = (cert: any) => {
    setEditingCert(cert);
    setFormData({
      certificate_name: cert.certificate_name || "",
      issuing_organization: cert.issuing_organization || "",
      certificate_number: cert.certificate_number || "",
      issue_date: cert.issue_date || "",
      expiry_date: cert.expiry_date || "",
      status: cert.status || "active",
      notes: cert.notes || "",
    });
    setDialogOpen(true);
  };

  const getExpiryStatus = (expiryDate: string) => {
    if (!expiryDate) return null;
    const daysUntilExpiry = differenceInDays(new Date(expiryDate), new Date());
    if (daysUntilExpiry < 0) return { label: "Expired", variant: "destructive" as const };
    if (daysUntilExpiry <= 30) return { label: "Expiring Soon", variant: "secondary" as const };
    return { label: "Valid", variant: "default" as const };
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCert ? "Edit" : "Add"} Certificate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="certificate_name">Certificate Name *</Label>
                <Input
                  id="certificate_name"
                  value={formData.certificate_name}
                  onChange={(e) =>
                    setFormData({ ...formData, certificate_name: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="issuing_organization">Issuing Organization</Label>
                <Input
                  id="issuing_organization"
                  value={formData.issuing_organization}
                  onChange={(e) =>
                    setFormData({ ...formData, issuing_organization: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="certificate_number">Certificate Number</Label>
                <Input
                  id="certificate_number"
                  value={formData.certificate_number}
                  onChange={(e) =>
                    setFormData({ ...formData, certificate_number: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="issue_date">Issue Date</Label>
                <Input
                  id="issue_date"
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) =>
                    setFormData({ ...formData, issue_date: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="expiry_date">Expiry Date</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) =>
                    setFormData({ ...formData, expiry_date: e.target.value })
                  }
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formData.certificate_name}>
                {editingCert ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Certificate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this certificate? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Certificates</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Certificate
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : certificates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No certificates added yet
            </div>
          ) : (
            <div className="space-y-3">
              {certificates.map((cert: any) => {
                const expiryStatus = cert.expiry_date ? getExpiryStatus(cert.expiry_date) : null;
                return (
                  <div
                    key={cert.id}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{cert.certificate_name}</div>
                        {expiryStatus && (
                          <Badge variant={expiryStatus.variant}>
                            {expiryStatus.label}
                          </Badge>
                        )}
                        {expiryStatus?.label === "Expiring Soon" && (
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                        )}
                      </div>
                      {cert.issuing_organization && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {cert.issuing_organization}
                        </div>
                      )}
                      {cert.certificate_number && (
                        <div className="text-sm font-mono text-muted-foreground mt-1">
                          #{cert.certificate_number}
                        </div>
                      )}
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        {cert.issue_date && (
                          <span>
                            Issued: {format(new Date(cert.issue_date), "MMM d, yyyy")}
                          </span>
                        )}
                        {cert.expiry_date && (
                          <span>
                            Expires: {format(new Date(cert.expiry_date), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      {cert.notes && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {cert.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(cert)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(cert.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
