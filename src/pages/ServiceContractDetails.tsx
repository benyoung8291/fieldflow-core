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
import { ArrowLeft, Calendar, DollarSign, Edit, Pause, Play, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import AuditTimeline from "@/components/audit/AuditTimeline";

export default function ServiceContractDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingLineItem, setEditingLineItem] = useState<any>(null);
  const [editingContract, setEditingContract] = useState(false);

  const { data: contract, isLoading } = useQuery({
    queryKey: ["service-contract", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_contracts" as any)
        .select(`
          *,
          customers (name, email, phone, address),
          service_contract_line_items (*)
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

  const updateLineItemMutation = useMutation({
    mutationFn: async (lineItem: any) => {
      const { error } = await supabase
        .from("service_contract_line_items" as any)
        .update({
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

  if (isLoading) {
    return (
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
    );
  }

  if (!contract) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Contract not found</p>
      </div>
    );
  }

  const lineItems = contract.service_contract_line_items || [];
  const totalValue = lineItems.reduce((sum: number, item: any) => sum + parseFloat(item.line_total || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/service-contracts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{contract.contract_number}</h1>
          <p className="text-muted-foreground">{contract.title}</p>
        </div>
        <Badge variant={contract.status === "active" ? "default" : "secondary"}>
          {contract.status}
        </Badge>
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
        </TabsList>

        <TabsContent value="line-items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contract Line Items</CardTitle>
              <CardDescription>Manage line items and generation schedules</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>First Generation</TableHead>
                    <TableHead>Next Generation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>${parseFloat(item.unit_price).toFixed(2)}</TableCell>
                      <TableCell>${parseFloat(item.line_total).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.recurrence_frequency}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.first_generation_date
                          ? format(parseISO(item.first_generation_date), "PP")
                          : "Not set"}
                      </TableCell>
                      <TableCell>
                        {item.next_generation_date
                          ? format(parseISO(item.next_generation_date), "PP")
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
                        <Dialog open={editingLineItem?.id === item.id} onOpenChange={(open) => {
                          if (!open) setEditingLineItem(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingLineItem(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Edit Line Item</DialogTitle>
                              <DialogDescription>
                                Update generation settings and schedule
                              </DialogDescription>
                            </DialogHeader>
                            {editingLineItem && (
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
              <CardTitle>Generated Service Orders</CardTitle>
              <CardDescription>
                Service orders automatically created from this contract
              </CardDescription>
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
      </Tabs>
    </div>
  );
}
