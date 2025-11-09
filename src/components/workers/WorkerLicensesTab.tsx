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

interface WorkerLicensesTabProps {
  workerId: string;
}

export default function WorkerLicensesTab({ workerId }: WorkerLicensesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    license_name: "",
    license_number: "",
    issuing_authority: "",
    issue_date: "",
    expiry_date: "",
    status: "active",
    notes: "",
  });

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["worker-licenses", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_licenses")
        .select("*")
        .eq("worker_id", workerId)
        .order("expiry_date", { ascending: true });
      if (error) {
        console.error("Error fetching worker licenses:", error);
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

      const licenseData = {
        ...formData,
        worker_id: workerId,
        tenant_id: profile?.tenant_id,
        issue_date: formData.issue_date || null,
        expiry_date: formData.expiry_date || null,
      };

      if (editingLicense) {
        const { error } = await supabase
          .from("worker_licenses")
          .update(licenseData)
          .eq("id", editingLicense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("worker_licenses")
          .insert([licenseData]);
        if (error) throw error;
      }

      toast({
        title: editingLicense ? "License updated" : "License added",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-licenses", workerId] });
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error saving license",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from("worker_licenses")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast({
        title: "Error deleting license",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "License deleted" });
      queryClient.invalidateQueries({ queryKey: ["worker-licenses", workerId] });
    }
    setDeleteId(null);
  };

  const resetForm = () => {
    setFormData({
      license_name: "",
      license_number: "",
      issuing_authority: "",
      issue_date: "",
      expiry_date: "",
      status: "active",
      notes: "",
    });
    setEditingLicense(null);
  };

  const openEdit = (license: any) => {
    setEditingLicense(license);
    setFormData({
      license_name: license.license_name || "",
      license_number: license.license_number || "",
      issuing_authority: license.issuing_authority || "",
      issue_date: license.issue_date || "",
      expiry_date: license.expiry_date || "",
      status: license.status || "active",
      notes: license.notes || "",
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
            <DialogTitle>{editingLicense ? "Edit" : "Add"} License</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="license_name">License Name *</Label>
                <Input
                  id="license_name"
                  value={formData.license_name}
                  onChange={(e) =>
                    setFormData({ ...formData, license_name: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="license_number">License Number</Label>
                <Input
                  id="license_number"
                  value={formData.license_number}
                  onChange={(e) =>
                    setFormData({ ...formData, license_number: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="issuing_authority">Issuing Authority</Label>
                <Input
                  id="issuing_authority"
                  value={formData.issuing_authority}
                  onChange={(e) =>
                    setFormData({ ...formData, issuing_authority: e.target.value })
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
                    <SelectItem value="revoked">Revoked</SelectItem>
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
              <Button onClick={handleSave} disabled={!formData.license_name}>
                {editingLicense ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete License</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this license? This action cannot be undone.
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
          <CardTitle>Licenses</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add License
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : licenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No licenses added yet
            </div>
          ) : (
            <div className="space-y-3">
              {licenses.map((license: any) => {
                const expiryStatus = license.expiry_date ? getExpiryStatus(license.expiry_date) : null;
                return (
                  <div
                    key={license.id}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{license.license_name}</div>
                        {expiryStatus && (
                          <Badge variant={expiryStatus.variant}>
                            {expiryStatus.label}
                          </Badge>
                        )}
                        {expiryStatus?.label === "Expiring Soon" && (
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                        )}
                      </div>
                      {license.issuing_authority && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Issued by {license.issuing_authority}
                        </div>
                      )}
                      {license.license_number && (
                        <div className="text-sm font-mono text-muted-foreground mt-1">
                          #{license.license_number}
                        </div>
                      )}
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        {license.issue_date && (
                          <span>
                            Issued: {format(new Date(license.issue_date), "MMM d, yyyy")}
                          </span>
                        )}
                        {license.expiry_date && (
                          <span>
                            Expires: {format(new Date(license.expiry_date), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      {license.notes && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {license.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(license)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(license.id)}
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
