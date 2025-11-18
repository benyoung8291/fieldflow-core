import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Calendar, DollarSign, Edit, Archive, Plus, MapPin, History, FileText, User, Trash2, FileUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import AuditTimeline from "@/components/audit/AuditTimeline";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import DashboardLayout from "@/components/DashboardLayout";
import QuickLocationDialog from "@/components/customers/QuickLocationDialog";
import ImportContractLineItemsDialog from "@/components/contracts/ImportContractLineItemsDialog";

export default function ServiceContractDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingLineItem, setEditingLineItem] = useState<any>(null);
  const [addingLineItem, setAddingLineItem] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [viewingLineItemHistory, setViewingLineItemHistory] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [cellValue, setCellValue] = useState<any>("");
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const { data: contract, isLoading } = useQuery({
    queryKey: ["service-contract", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_contracts" as any)
        .select(`
          *,
          customers!inner (name, email, phone, address, id),
          service_contract_line_items (
            *,
            customer_locations (
              id,
              name,
              address,
              city,
              state,
              postcode
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Contract not found");
      
      // Fetch related quote separately if it exists
      if ((data as any).quote_id) {
        const { data: quoteData } = await supabase
          .from("quotes" as any)
          .select("id, quote_number, title")
          .eq("id", (data as any).quote_id)
          .single();
        
        if (quoteData) {
          (data as any).quotes = quoteData;
        }
      }
      
      return data as any;
    },
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ["contract-service-orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders" as any)
        .select("*")
        .eq("contract_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any;
    },
  });

  const { data: customerLocations } = useQuery({
    queryKey: ["customer-locations", contract?.customers?.id],
    enabled: !!contract?.customers?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_locations")
        .select("*")
        .eq("customer_id", contract.customers.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const updateLineItemMutation = useMutation({
    mutationFn: async (lineItem: any) => {
      const { error } = await supabase
        .from("service_contract_line_items" as any)
        .update({
          description: lineItem.description,
          quantity: lineItem.quantity,
          unit_price: lineItem.unit_price,
          line_total: lineItem.line_total,
          estimated_hours: lineItem.estimated_hours,
          location_id: lineItem.location_id,
          first_generation_date: lineItem.first_generation_date,
          recurrence_frequency: lineItem.recurrence_frequency,
          is_active: lineItem.is_active,
          key_number: lineItem.key_number,
          notes: lineItem.notes,
        })
        .eq("id", lineItem.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract", id] });
      toast.success("Line item updated");
      setEditingLineItem(null);
      setAddingLineItem(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const addLineItemMutation = useMutation({
    mutationFn: async (lineItem: any) => {
      const maxOrder = contract.service_contract_line_items?.reduce(
        (max: number, item: any) => Math.max(max, item.item_order || 0),
        0
      ) || 0;

      const { error } = await supabase
        .from("service_contract_line_items" as any)
        .insert({
          contract_id: id,
          description: lineItem.description,
          quantity: lineItem.quantity,
          unit_price: lineItem.unit_price,
          line_total: lineItem.line_total,
          estimated_hours: lineItem.estimated_hours,
          location_id: lineItem.location_id,
          first_generation_date: lineItem.first_generation_date,
          recurrence_frequency: lineItem.recurrence_frequency,
          item_order: maxOrder + 1,
          key_number: lineItem.key_number,
          notes: lineItem.notes,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract", id] });
      toast.success("Line item added");
      setAddingLineItem(false);
      setEditingLineItem(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to add: ${error.message}`);
    },
  });

  const deleteLineItemMutation = useMutation({
    mutationFn: async (lineItemId: string) => {
      const { error } = await supabase
        .from("service_contract_line_items" as any)
        .delete()
        .eq("id", lineItemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract", id] });
      toast.success("Line item deleted");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { error } = await supabase
        .from("service_contract_line_items")
        .delete()
        .in("id", itemIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract", id] });
      setSelectedItems(new Set());
      toast.success("Line items deleted");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete line items: ${error.message}`);
    },
  });

  const updateCellMutation = useMutation({
    mutationFn: async ({ itemId, field, value }: { itemId: string; field: string; value: any }) => {
      const { error } = await supabase
        .from("service_contract_line_items")
        .update({ [field]: value })
        .eq("id", itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract", id] });
      setEditingCell(null);
      toast.success("Updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const toggleAutoGenerateMutation = useMutation({
    mutationFn: async (autoGenerate: boolean) => {
      const { error } = await supabase
        .from("service_contracts" as any)
        .update({ auto_generate: autoGenerate })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract", id] });
      toast.success("Auto-generation updated");
    },
  });

  const archiveContractMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("service_contracts" as any)
        .update({ 
          archived_at: new Date().toISOString(),
          auto_generate: false 
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract", id] });
      queryClient.invalidateQueries({ queryKey: ["service-contracts-dashboard"] });
      toast.success("Contract archived");
      navigate("/service-contracts");
    },
    onError: (error: any) => {
      toast.error(`Failed to archive: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        </div>
      </DashboardLayout>
    );
  }

  if (!contract) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold">Contract not found</h2>
            <Button className="mt-4" onClick={() => navigate("/service-contracts")}>
              Back to Contracts
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const lineItems = contract.service_contract_line_items || [];
  
  // Calculate total annual contract value based on frequencies
  const totalValue = lineItems.reduce((sum: number, item: any) => {
    const frequencyMultiplier = {
      'daily': 365,
      'weekly': 52,
      'bi_weekly': 26,
      'monthly': 12,
      'quarterly': 4,
      'semi_annually': 2,
      'annually': 1
    }[item.recurrence_frequency] || 1;
    
    const annualRevenue = item.quantity * item.unit_price * frequencyMultiplier;
    return sum + annualRevenue;
  }, 0);

  const toggleSelectAll = () => {
    if (selectedItems.size === lineItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(lineItems.map((item: any) => item.id)));
    }
  };

  const toggleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const startEditingCell = (itemId: string, field: string, currentValue: any) => {
    setEditingCell({ id: itemId, field });
    setCellValue(currentValue);
  };

  const saveCell = () => {
    if (!editingCell) return;
    updateCellMutation.mutate({
      itemId: editingCell.id,
      field: editingCell.field,
      value: cellValue,
    });
  };

  const handleBulkDelete = () => {
    if (deleteConfirmText === "delete") {
      bulkDeleteMutation.mutate(Array.from(selectedItems));
      setShowBulkDeleteDialog(false);
      setDeleteConfirmText("");
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/service-contracts")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{contract.contract_number}</h1>
            <p className="text-muted-foreground">{contract.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <CreateTaskButton linkedModule="contract" linkedRecordId={id!} variant="outline" />
            <Button variant="outline" size="icon" onClick={() => setShowArchiveDialog(true)}>
              <Archive className="h-4 w-4" />
            </Button>
            <Badge variant={contract.status === "active" ? "default" : "secondary"}>{contract.status}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{contract.customers?.name}</div>
              <p className="text-xs text-muted-foreground">{contract.customers?.email}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contract Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Ex-GST</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Start Date</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{format(parseISO(contract.start_date), "PP")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Auto-Generation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Switch checked={contract.auto_generate} onCheckedChange={(checked) => toggleAutoGenerateMutation.mutate(checked)} />
                <span className="text-sm">{contract.auto_generate ? "Enabled" : "Disabled"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="line-items" className="space-y-4">
          <TabsList>
            <TabsTrigger value="line-items">Line Items</TabsTrigger>
            <TabsTrigger value="upcoming-generations">Upcoming Generations</TabsTrigger>
            <TabsTrigger value="service-orders">Service Orders</TabsTrigger>
            <TabsTrigger value="linked-documents">Linked Documents</TabsTrigger>
            <TabsTrigger value="details">Contract Details</TabsTrigger>
            <TabsTrigger value="audit">Change Log</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="line-items" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Contract Line Items</CardTitle>
                  <CardDescription>
                    {selectedItems.size > 0 
                      ? `${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''} selected`
                      : "Manage line items and generation schedules"}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedItems.size > 0 ? (
                    <>
                      <Button 
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteDialog(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedItems(new Set())}
                      >
                        Clear Selection
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => setIsImportDialogOpen(true)}
                      >
                        <FileUp className="h-4 w-4 mr-2" />
                        Import CSV
                      </Button>
                      <Button onClick={() => {
                        setEditingLineItem({
                          description: "",
                          quantity: 1,
                          unit_price: 0,
                          line_total: 0,
                          estimated_hours: 0,
                          location_id: "",
                          first_generation_date: "",
                          recurrence_frequency: "monthly",
                          is_active: true,
                          key_number: "",
                          notes: "",
                        });
                        setAddingLineItem(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Line Item
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedItems.size === lineItems.length && lineItems.length > 0}
                          onChange={toggleSelectAll}
                          className="cursor-pointer"
                        />
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Key Number</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Annual Revenue</TableHead>
                      <TableHead>Est. Hours</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>First Gen</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item: any) => (
                      <TableRow key={item.id} className={selectedItems.has(item.id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleSelectItem(item.id)}
                            className="cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {editingCell?.id === item.id && editingCell?.field === "description" ? (
                            <Input
                              value={cellValue}
                              onChange={(e) => setCellValue(e.target.value)}
                              onBlur={saveCell}
                              onKeyDown={(e) => e.key === "Enter" && saveCell()}
                              autoFocus
                              className="h-8"
                            />
                          ) : (
                            <span onClick={() => startEditingCell(item.id, "description", item.description)} className="cursor-pointer hover:bg-accent px-2 py-1 rounded">
                              {item.description}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {item.customer_locations?.name || "No location"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {editingCell?.id === item.id && editingCell?.field === "key_number" ? (
                            <Input
                              value={cellValue}
                              onChange={(e) => setCellValue(e.target.value)}
                              onBlur={saveCell}
                              onKeyDown={(e) => e.key === "Enter" && saveCell()}
                              autoFocus
                              className="h-8 w-24"
                            />
                          ) : (
                            <span onClick={() => startEditingCell(item.id, "key_number", item.key_number || "")} className="cursor-pointer hover:bg-accent px-2 py-1 rounded text-sm text-muted-foreground">
                              {item.key_number || "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.id === item.id && editingCell?.field === "quantity" ? (
                            <Input
                              type="number"
                              value={cellValue}
                              onChange={(e) => setCellValue(parseFloat(e.target.value))}
                              onBlur={saveCell}
                              onKeyDown={(e) => e.key === "Enter" && saveCell()}
                              autoFocus
                              className="h-8 w-20"
                            />
                          ) : (
                            <span onClick={() => startEditingCell(item.id, "quantity", item.quantity)} className="cursor-pointer hover:bg-accent px-2 py-1 rounded">
                              {item.quantity}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.id === item.id && editingCell?.field === "unit_price" ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={cellValue}
                              onChange={(e) => setCellValue(parseFloat(e.target.value))}
                              onBlur={saveCell}
                              onKeyDown={(e) => e.key === "Enter" && saveCell()}
                              autoFocus
                              className="h-8 w-24"
                            />
                          ) : (
                            <span onClick={() => startEditingCell(item.id, "unit_price", item.unit_price)} className="cursor-pointer hover:bg-accent px-2 py-1 rounded">
                              ${parseFloat(item.unit_price).toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const frequencyMultiplier = {
                              'daily': 365,
                              'weekly': 52,
                              'bi_weekly': 26,
                              'monthly': 12,
                              'quarterly': 4,
                              'semi_annually': 2,
                              'annually': 1
                            }[item.recurrence_frequency] || 1;
                            const annualRevenue = item.quantity * item.unit_price * frequencyMultiplier;
                            return <span className="px-2 py-1">${annualRevenue.toFixed(2)}</span>;
                          })()}
                        </TableCell>
                        <TableCell>
                          {editingCell?.id === item.id && editingCell?.field === "estimated_hours" ? (
                            <Input
                              type="number"
                              step="0.5"
                              value={cellValue}
                              onChange={(e) => setCellValue(parseFloat(e.target.value))}
                              onBlur={saveCell}
                              onKeyDown={(e) => e.key === "Enter" && saveCell()}
                              autoFocus
                              className="h-8 w-20"
                            />
                          ) : (
                            <span onClick={() => startEditingCell(item.id, "estimated_hours", item.estimated_hours || 0)} className="cursor-pointer hover:bg-accent px-2 py-1 rounded">
                              {item.estimated_hours || 0}h
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.id === item.id && editingCell?.field === "recurrence_frequency" ? (
                            <Select value={cellValue} onValueChange={(value) => { setCellValue(value); updateCellMutation.mutate({ itemId: item.id, field: "recurrence_frequency", value }); setEditingCell(null); }}>
                              <SelectTrigger className="h-8 w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="bi_weekly">Fortnightly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="semi_annually">6 Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" onClick={() => startEditingCell(item.id, "recurrence_frequency", item.recurrence_frequency)} className="cursor-pointer">
                              {item.recurrence_frequency === "semi_annually" ? "6 Monthly" : 
                               item.recurrence_frequency === "bi_weekly" ? "Fortnightly" :
                               item.recurrence_frequency}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.id === item.id && editingCell?.field === "first_generation_date" ? (
                            <Input
                              type="date"
                              value={cellValue}
                              onChange={(e) => setCellValue(e.target.value)}
                              onBlur={saveCell}
                              onKeyDown={(e) => e.key === "Enter" && saveCell()}
                              autoFocus
                              className="h-8 w-36"
                            />
                          ) : (
                            <span onClick={() => startEditingCell(item.id, "first_generation_date", item.first_generation_date)} className="cursor-pointer hover:bg-accent px-2 py-1 rounded text-sm">
                              {item.first_generation_date ? format(parseISO(item.first_generation_date), "PP") : "Not set"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch 
                            checked={item.is_active} 
                            onCheckedChange={(checked) => updateCellMutation.mutate({ itemId: item.id, field: "is_active", value: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setViewingLineItemHistory(item.id)}>
                              <History className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingLineItem({ ...item }); setAddingLineItem(false); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this line item?")) deleteLineItemMutation.mutate(item.id); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="linked-documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Linked Documents</CardTitle>
                <CardDescription>Related documents and entities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">Customer</Badge>
                        <span className="font-medium">{contract.customers?.name}</span>
                      </div>
                      {contract.customers?.email && (
                        <p className="text-sm text-muted-foreground">{contract.customers.email}</p>
                      )}
                      {contract.customers?.phone && (
                        <p className="text-sm text-muted-foreground">{contract.customers.phone}</p>
                      )}
                      <Button
                        variant="link"
                        size="sm"
                        className="px-0 h-auto"
                        onClick={() => navigate(`/customers/${contract.customers.id}`)}
                      >
                        View Customer Details →
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Quote */}
                {contract.quotes && (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">Quote</Badge>
                          <span className="font-medium">{contract.quotes.quote_number}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{contract.quotes.title}</p>
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0 h-auto"
                          onClick={() => navigate(`/quotes/${contract.quotes.id}`)}
                        >
                          View Quote Details →
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {(!contract.quotes) && (
                  <p className="text-sm text-muted-foreground">No linked quote found.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upcoming-generations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Service Order Generations</CardTitle>
                <CardDescription>Scheduled service order generations and revenue forecast for the next 12 months</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const today = new Date();
                  const next12Months = new Date(today);
                  next12Months.setMonth(today.getMonth() + 12);
                  
                  // Calculate upcoming generations
                  const upcomingGenerations: any[] = [];
                  const monthlyRevenue = new Map<string, number>();
                  
                  lineItems.forEach((item: any) => {
                    if (!item.is_active || !item.next_generation_date) return;
                    
                    const nextDate = new Date(item.next_generation_date);
                    let currentDate = new Date(nextDate);
                    
                    const getDaysToAdd = (freq: string) => {
                      switch(freq) {
                        case "daily": return 1;
                        case "weekly": return 7;
                        case "bi_weekly": return 14;
                        case "monthly": return 30;
                        case "semi_annually": return 180;
                        case "quarterly": return 90;
                        case "annually": return 365;
                        default: return 30;
                      }
                    };
                    
                    // Generate upcoming dates within next 12 months
                    while (currentDate <= next12Months) {
                      if (currentDate >= today) {
                        const perOccurrenceRevenue = item.quantity * item.unit_price;
                        upcomingGenerations.push({
                          date: new Date(currentDate),
                          item,
                          revenue: perOccurrenceRevenue,
                        });
                        
                        // Add to monthly revenue
                        const monthKey = format(currentDate, "yyyy-MM");
                        monthlyRevenue.set(
                          monthKey,
                          (monthlyRevenue.get(monthKey) || 0) + perOccurrenceRevenue
                        );
                      }
                      
                      // Move to next occurrence
                      currentDate = new Date(currentDate);
                      currentDate.setDate(currentDate.getDate() + getDaysToAdd(item.recurrence_frequency));
                    }
                  });
                  
                  // Sort by date
                  upcomingGenerations.sort((a, b) => a.date.getTime() - b.date.getTime());
                  
                  // Get monthly forecast sorted by month
                  const monthlyForecast = Array.from(monthlyRevenue.entries())
                    .map(([month, revenue]) => ({ month, revenue }))
                    .sort((a, b) => a.month.localeCompare(b.month));
                  
                  const totalForecast = monthlyForecast.reduce((sum, m) => sum + m.revenue, 0);
                  
                  return (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">12-Month Revenue Forecast</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Total Forecast</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">${totalForecast.toFixed(2)}</div>
                              <p className="text-xs text-muted-foreground">Next 12 months</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Avg Monthly</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">${(totalForecast / 12).toFixed(2)}</div>
                              <p className="text-xs text-muted-foreground">Per month</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Active Items</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{lineItems.filter((i: any) => i.is_active).length}</div>
                              <p className="text-xs text-muted-foreground">Line items</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Next Generation</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-lg font-bold">
                                {upcomingGenerations.length > 0 ? format(upcomingGenerations[0].date, "PP") : "None"}
                              </div>
                              <p className="text-xs text-muted-foreground">Upcoming</p>
                            </CardContent>
                          </Card>
                        </div>
                        
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Month</TableHead>
                              <TableHead className="text-right">Forecast Revenue</TableHead>
                              <TableHead className="text-right">Service Orders</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthlyForecast.map(({ month, revenue }) => {
                              const count = upcomingGenerations.filter(g => format(g.date, "yyyy-MM") === month).length;
                              return (
                                <TableRow key={month}>
                                  <TableCell className="font-medium">{format(parseISO(month + "-01"), "MMMM yyyy")}</TableCell>
                                  <TableCell className="text-right">${revenue.toFixed(2)}</TableCell>
                                  <TableCell className="text-right">{count}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Upcoming Generations (Next 30)</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Generation Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Frequency</TableHead>
                              <TableHead className="text-right">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {upcomingGenerations.slice(0, 30).map((gen, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{format(gen.date, "PP")}</TableCell>
                                <TableCell>{gen.item.description}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    {gen.item.customer_locations?.name || "No location"}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {gen.item.recurrence_frequency === "semi_annually" ? "6 Monthly" : 
                                     gen.item.recurrence_frequency === "bi_weekly" ? "Fortnightly" :
                                     gen.item.recurrence_frequency}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">${gen.revenue.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service-orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Generated Service Orders</CardTitle>
                <CardDescription>Service orders automatically created from this contract</CardDescription>
              </CardHeader>
              <CardContent>
                {serviceOrders && serviceOrders.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Work Order #</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceOrders.map((order: any) => (
                        <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/service-orders/${order.id}`)}>
                          <TableCell className="font-medium">{order.work_order_number}</TableCell>
                          <TableCell>{order.description}</TableCell>
                          <TableCell><Badge>{order.status}</Badge></TableCell>
                          <TableCell>{format(parseISO(order.created_at), "PP")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No service orders generated yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contract Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Contract Number</Label>
                    <p className="text-sm font-medium">{contract.contract_number}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Status</Label>
                    <p className="text-sm font-medium">{contract.status}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Start Date</Label>
                    <p className="text-sm font-medium">{format(parseISO(contract.start_date), "PP")}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">End Date</Label>
                    <p className="text-sm font-medium">{contract.end_date ? format(parseISO(contract.end_date), "PP") : "Ongoing"}</p>
                  </div>
                </div>
                {contract.description && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Description</Label>
                    <p className="text-sm">{contract.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contract Change History</CardTitle>
                <CardDescription>All modifications to this contract</CardDescription>
              </CardHeader>
              <CardContent>
                <AuditTimeline tableName="service_contracts" recordId={id!} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Related Tasks</CardTitle>
                <CardDescription>Tasks linked to this contract</CardDescription>
              </CardHeader>
              <CardContent>
                <LinkedTasksList linkedModule="contract" linkedRecordId={id!} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!editingLineItem} onOpenChange={(open) => { if (!open) { setEditingLineItem(null); setAddingLineItem(false); } }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{addingLineItem ? "Add Line Item" : "Edit Line Item"}</DialogTitle>
              <DialogDescription>{addingLineItem ? "Add a new line item" : "Update line item details"}</DialogDescription>
            </DialogHeader>
            {editingLineItem && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={editingLineItem.description} onChange={(e) => setEditingLineItem({ ...editingLineItem, description: e.target.value })} rows={2} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" value={editingLineItem.quantity} onChange={(e) => { const quantity = parseFloat(e.target.value) || 0; setEditingLineItem({ ...editingLineItem, quantity, line_total: quantity * (editingLineItem.unit_price || 0) }); }} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price</Label>
                    <Input type="number" step="0.01" value={editingLineItem.unit_price} onChange={(e) => { const unitPrice = parseFloat(e.target.value) || 0; setEditingLineItem({ ...editingLineItem, unit_price: unitPrice, line_total: (editingLineItem.quantity || 0) * unitPrice }); }} />
                  </div>
                  <div className="space-y-2">
                    <Label>Line Total</Label>
                    <Input type="number" value={editingLineItem.line_total} disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Estimated Hours</Label>
                  <Input type="number" value={editingLineItem.estimated_hours || 0} onChange={(e) => setEditingLineItem({ ...editingLineItem, estimated_hours: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Key Number</Label>
                  <Input 
                    value={editingLineItem.key_number || ""} 
                    onChange={(e) => setEditingLineItem({ ...editingLineItem, key_number: e.target.value })}
                    placeholder="Enter key number (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Location</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowLocationDialog(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      New Location
                    </Button>
                  </div>
                  <Select value={editingLineItem.location_id || ""} onValueChange={(value) => setEditingLineItem({ ...editingLineItem, location_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerLocations?.map((loc: any) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name} - {loc.address}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Recurrence Frequency</Label>
                    <Select value={editingLineItem.recurrence_frequency} onValueChange={(value) => setEditingLineItem({ ...editingLineItem, recurrence_frequency: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">One Time</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="fortnightly">Fortnightly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="6_monthly">6 Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>First Generation Date</Label>
                    <Input type="date" value={editingLineItem.first_generation_date || ""} onChange={(e) => setEditingLineItem({ ...editingLineItem, first_generation_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={editingLineItem.notes || ""} onChange={(e) => setEditingLineItem({ ...editingLineItem, notes: e.target.value })} rows={3} />
                </div>
                {!addingLineItem && (
                  <div className="flex items-center space-x-2">
                    <Switch checked={editingLineItem.is_active} onCheckedChange={(checked) => setEditingLineItem({ ...editingLineItem, is_active: checked })} />
                    <Label>Active</Label>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditingLineItem(null); setAddingLineItem(false); }}>Cancel</Button>
              <Button onClick={() => { if (addingLineItem) addLineItemMutation.mutate(editingLineItem); else updateLineItemMutation.mutate(editingLineItem); }}>{addingLineItem ? "Add" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingLineItemHistory} onOpenChange={(open) => { if (!open) setViewingLineItemHistory(null); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Line Item Change History</DialogTitle>
              <DialogDescription>View all changes made to this line item</DialogDescription>
            </DialogHeader>
            <AuditTimeline tableName="service_contract_line_items" recordId={viewingLineItemHistory || ""} />
          </DialogContent>
        </Dialog>

        <QuickLocationDialog
          open={showLocationDialog}
          onOpenChange={setShowLocationDialog}
          customerId={contract?.customers?.id}
          onLocationCreated={(locationId) => {
            queryClient.invalidateQueries({ queryKey: ["customer-locations", contract?.customers?.id] });
            setEditingLineItem({ ...editingLineItem, location_id: locationId });
            setShowLocationDialog(false);
          }}
        />

        {/* Archive Confirmation Dialog */}
        <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive Contract</DialogTitle>
              <DialogDescription>
                Archiving this contract will turn off auto-generation and remove it from revenue forecasting.
                The contract will remain in the system for historical reference.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  archiveContractMutation.mutate();
                  setShowArchiveDialog(false);
                }}
              >
                Archive Contract
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ImportContractLineItemsDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          contractId={id!}
          customerId={contract.customers.id}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedItems.size} Line Items?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Type "delete" below to confirm deletion of {selectedItems.size} line item{selectedItems.size > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type "delete" to confirm</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBulkDeleteDialog(false); setDeleteConfirmText(""); }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={deleteConfirmText !== "delete" || bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete Items"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
