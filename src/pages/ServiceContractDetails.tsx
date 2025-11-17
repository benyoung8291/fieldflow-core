import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Calendar, DollarSign, Edit, Pause, Play, FileText, Trash2, AlertTriangle, RefreshCw, Plus, MapPin, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import AuditTimeline from "@/components/audit/AuditTimeline";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import DashboardLayout from "@/components/DashboardLayout";
import QuickLocationDialog from "@/components/customers/QuickLocationDialog";

export default function ServiceContractDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingLineItem, setEditingLineItem] = useState<any>(null);
  const [addingLineItem, setAddingLineItem] = useState(false);
  const [editingContract, setEditingContract] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [viewingLineItemHistory, setViewingLineItemHistory] = useState<string | null>(null);

  const { data: contract, isLoading } = useQuery({
    queryKey: ["service-contract", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_contracts" as any)
        .select(`
          *,
          customers (name, email, phone, address, id),
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
    queryKey: ["customer-locations", contract?.customer_id],
    enabled: !!contract?.customer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_locations")
        .select("*")
        .eq("customer_id", contract.customer_id)
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
          next_generation_date: lineItem.next_generation_date,
          recurrence_frequency: lineItem.recurrence_frequency,
          generation_day_of_week: lineItem.generation_day_of_week,
          generation_day_of_month: lineItem.generation_day_of_month,
          is_active: lineItem.is_active,
          notes: lineItem.notes,
        })
        .eq("id", lineItem.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract", id] });
      toast.success("Line item updated successfully");
      setEditingLineItem(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update line item: ${error.message}`);
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
          generation_day_of_week: lineItem.generation_day_of_week,
          generation_day_of_month: lineItem.generation_day_of_month,
          item_order: maxOrder + 1,
          notes: lineItem.notes,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract", id] });
      toast.success("Line item added successfully");
      setAddingLineItem(false);
      setEditingLineItem(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to add line item: ${error.message}`);
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
      toast.success("Line item deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete line item: ${error.message}`);
    },
  });

  const deleteContractMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("service_contracts" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contract deleted successfully");
      navigate("/service-contracts");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete contract: ${error.message}`);
    },
  });

  const updateContractMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from("service_contracts" as any)
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract", id] });
      toast.success("Contract updated successfully");
      setEditingContract(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update contract: ${error.message}`);
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
      toast.success("Auto-generation settings updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  const generateServiceOrdersMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-contract-service-orders');
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contract-service-orders", id] });
      toast.success(`Generated ${data.createdOrders?.length || 0} service order(s)`);
      if (data.errors && data.errors.length > 0) {
        toast.warning(`${data.errors.length} error(s) occurred during generation`);
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to generate service orders: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="h-8 w-64 bg-muted animate-pulse rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!contract) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <p className="text-muted-foreground">Contract not found</p>
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
          <CreateTaskButton
            linkedModule="contract"
            linkedRecordId={id!}
            variant="outline"
          />
          <Button 
            variant="destructive" 
            size="icon"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Badge variant={contract.status === "active" ? "default" : "secondary"}>
            {contract.status}
          </Badge>
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
              <Switch
                checked={contract.auto_generate}
                onCheckedChange={(checked) => toggleAutoGenerateMutation.mutate(checked)}
              />
              <span className="text-sm">
                {contract.auto_generate ? "Enabled" : "Disabled"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="line-items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="line-items">Line Items</TabsTrigger>
          <TabsTrigger value="service-orders">Service Orders</TabsTrigger>
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
                  notes: "",
                });
                setAddingLineItem(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Est. Hours</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>First Generation</TableHead>
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
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>${parseFloat(item.unit_price).toFixed(2)}</TableCell>
                      <TableCell>${parseFloat(item.line_total).toFixed(2)}</TableCell>
                      <TableCell>{item.estimated_hours || 0}h</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.recurrence_frequency}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.first_generation_date
                          ? format(parseISO(item.first_generation_date), "PP")
                          : "Not set"}
                      </TableCell>
                      <TableCell>
                        {item.is_active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Paused</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingLineItemHistory(item.id)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingLineItem({ ...item });
                              setAddingLineItem(false);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this line item?")) {
                                deleteLineItemMutation.mutate(item.id);
                              }
                            }}
                          >
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
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>Description</Label>
                                  <Input
                                    value={editingLineItem.description}
                                    disabled
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Recurrence Frequency</Label>
                                    <Select
                                      value={editingLineItem.recurrence_frequency}
                                      onValueChange={(value) =>
                                        setEditingLineItem({
                                          ...editingLineItem,
                                          recurrence_frequency: value,
                                        })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
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
                                    <Input
                                      type="date"
                                      value={editingLineItem.first_generation_date || ""}
                                      onChange={(e) =>
                                        setEditingLineItem({
                                          ...editingLineItem,
                                          first_generation_date: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Next Generation Date</Label>
                                  <Input
                                    type="date"
                                    value={editingLineItem.next_generation_date || ""}
                                    onChange={(e) =>
                                      setEditingLineItem({
                                        ...editingLineItem,
                                        next_generation_date: e.target.value,
                                      })
                                    }
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>Notes</Label>
                                  <Textarea
                                    value={editingLineItem.notes || ""}
                                    onChange={(e) =>
                                      setEditingLineItem({
                                        ...editingLineItem,
                                        notes: e.target.value,
                                      })
                                    }
                                    rows={3}
                                  />
                                </div>

                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={editingLineItem.is_active}
                                    onCheckedChange={(checked) =>
                                      setEditingLineItem({
                                        ...editingLineItem,
                                        is_active: checked,
                                      })
                                    }
                                  />
                                  <Label>Active (Enable auto-generation)</Label>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setEditingLineItem(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => updateLineItemMutation.mutate(editingLineItem)}
                                disabled={updateLineItemMutation.isPending}
                              >
                                Save Changes
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service-orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generated Service Orders</CardTitle>
                  <CardDescription>
                    Service orders automatically created from this contract
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => generateServiceOrdersMutation.mutate()}
                  disabled={generateServiceOrdersMutation.isPending || !contract.auto_generate}
                  size="sm"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${generateServiceOrdersMutation.isPending ? 'animate-spin' : ''}`} />
                  {generateServiceOrdersMutation.isPending ? 'Generating...' : 'Generate Now'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!serviceOrders || serviceOrders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No service orders generated yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Number</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.title}</TableCell>
                        <TableCell>
                          <Badge>{order.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(order.created_at), "PP")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.priority || "Normal"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/service-orders/${order.id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contract Information</CardTitle>
              <CardDescription>View and edit contract details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Contract Number</Label>
                  <p className="font-medium">{contract.contract_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p className="font-medium capitalize">{contract.status}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Start Date</Label>
                  <p className="font-medium">
                    {format(parseISO(contract.start_date), "PP")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">End Date</Label>
                  <p className="font-medium">
                    {contract.end_date
                      ? format(parseISO(contract.end_date), "PP")
                      : "Ongoing"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Billing Frequency</Label>
                  <p className="font-medium capitalize">{contract.billing_frequency}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Auto-Generate</Label>
                  <p className="font-medium">
                    {contract.auto_generate ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Title</Label>
                <p className="font-medium">{contract.title}</p>
              </div>

              {contract.description && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{contract.description}</p>
                </div>
              )}

              {contract.notes && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm">{contract.notes}</p>
                </div>
              )}

              <div className="pt-4">
                <Button onClick={() => setEditingContract(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Contract Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Log</CardTitle>
              <CardDescription>Track all changes made to this contract</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTimeline recordId={id!} tableName="service_contracts" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <LinkedTasksList linkedModule="service_contract" linkedRecordId={id!} />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Service Contract
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the contract and all associated line items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type <span className="font-mono font-semibold">delete</span> to confirm</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type delete to confirm"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (deleteConfirmText.toLowerCase() === "delete") {
                  deleteContractMutation.mutate();
                  setShowDeleteDialog(false);
                  setDeleteConfirmText("");
                } else {
                  toast.error("Please type 'delete' to confirm");
                }
              }}
              disabled={deleteConfirmText.toLowerCase() !== "delete"}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
