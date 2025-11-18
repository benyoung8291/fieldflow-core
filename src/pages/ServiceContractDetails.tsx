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
  const totalValue = lineItems.reduce((sum: number, item: any) => sum + parseFloat(item.line_total || 0), 0);

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
                  <CardDescription>Manage line items and generation schedules</CardDescription>
                </div>
                <div className="flex gap-2">
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
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Key Number</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Est. Hours</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>First Gen</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {item.customer_locations?.name || "No location"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{item.key_number || "-"}</span>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>${parseFloat(item.unit_price).toFixed(2)}</TableCell>
                        <TableCell>${parseFloat(item.line_total).toFixed(2)}</TableCell>
                        <TableCell>{item.estimated_hours || 0}h</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.recurrence_frequency}</Badge>
                        </TableCell>
                        <TableCell>
                          {item.first_generation_date ? format(parseISO(item.first_generation_date), "PP") : "Not set"}
                        </TableCell>
                        <TableCell>
                          {item.is_active ? <Badge variant="default">Active</Badge> : <Badge variant="secondary">Paused</Badge>}
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
      </div>
    </DashboardLayout>
  );
}
