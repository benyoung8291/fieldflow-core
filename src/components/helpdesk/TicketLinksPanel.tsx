import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Building2,
  Users,
  FileText,
  ShoppingCart,
  Package,
  Sparkles,
  Loader2,
  X,
  Link as LinkIcon
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LinkSuggestion {
  type: string;
  confidence: number;
  reasoning: string;
  searchTerm: string;
}

interface TicketLinksPanelProps {
  ticket: any;
  onUpdate: () => void;
}

export function TicketLinksPanel({ ticket, onUpdate }: TicketLinksPanelProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const linkTypes = [
    { key: "contact", label: "Contact", icon: User, color: "bg-purple-100 text-purple-700" },
    { key: "customer", label: "Customer", icon: Building2, color: "bg-blue-100 text-blue-700" },
    { key: "lead", label: "Lead", icon: Users, color: "bg-pink-100 text-pink-700" },
    { key: "contract", label: "Contract", icon: FileText, color: "bg-green-100 text-green-700" },
    { key: "purchase_order", label: "Purchase Order", icon: ShoppingCart, color: "bg-orange-100 text-orange-700" },
    { key: "supplier", label: "Supplier", icon: Package, color: "bg-indigo-100 text-indigo-700" },
  ];

  useEffect(() => {
    loadData();
    if (ticket?.description) {
      getSuggestions();
    }
  }, [ticket?.id]);

  const loadData = async () => {
    const [contactsRes, customersRes, leadsRes, contractsRes, posRes, suppliersRes] = await Promise.all([
      supabase.from("contacts").select("id, first_name, last_name, email, customer_id").order("first_name"),
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("leads" as any).select("id, company_name, contact_name").order("company_name"),
      supabase.from("service_contracts" as any).select("id, contract_number, customer:customers(name)").order("contract_number"),
      supabase.from("purchase_orders" as any).select("id, po_number").order("po_number"),
      supabase.from("suppliers" as any).select("id, name").order("name"),
    ]);

    if (contactsRes.data) setContacts(contactsRes.data);
    if (customersRes.data) setCustomers(customersRes.data);
    if (leadsRes.data) setLeads(leadsRes.data);
    if (contractsRes.data) setContracts(contractsRes.data);
    if (posRes.data) setPurchaseOrders(posRes.data);
    if (suppliersRes.data) setSuppliers(suppliersRes.data);
  };

  const getSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-ticket-links", {
        body: {
          emailContent: ticket.description || "",
          senderEmail: ticket.sender_email || "",
          subject: ticket.subject || "",
        },
      });

      if (error) throw error;
      if (data?.suggestions) {
        setSuggestions(data.suggestions.filter((s: LinkSuggestion) => s.confidence > 0.5));
      }
    } catch (error) {
      console.error("Error getting suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateLink = async (field: string, value: string | null) => {
    try {
      console.log("Updating link:", field, value);
      const updates: any = { [field]: value };
      
      // If linking a contact, automatically link their customer
      if (field === "contact_id" && value) {
        const contact = contacts.find(c => c.id === value);
        console.log("Found contact:", contact);
        if (contact?.customer_id) {
          updates.customer_id = contact.customer_id;
        }
      }

      console.log("Updates to apply:", updates);
      const { error } = await supabase
        .from("helpdesk_tickets")
        .update(updates)
        .eq("id", ticket.id);

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      toast({ title: "Link updated successfully" });
      onUpdate();
    } catch (error) {
      console.error("Error updating link:", error);
      toast({
        title: "Error",
        description: "Failed to update link",
        variant: "destructive",
      });
    }
  };

  const getLinkedValue = (type: string) => {
    switch (type) {
      case "contact": return ticket?.contact_id;
      case "customer": return ticket?.customer_id;
      case "lead": return ticket?.lead_id;
      case "contract": return ticket?.contract_id;
      case "purchase_order": return ticket?.purchase_order_id;
      case "supplier": return ticket?.supplier_id;
      default: return null;
    }
  };

  const getOptions = (type: string) => {
    switch (type) {
      case "contact": return contacts;
      case "customer": return customers;
      case "lead": return leads;
      case "contract": return contracts;
      case "purchase_order": return purchaseOrders;
      case "supplier": return suppliers;
      default: return [];
    }
  };

  const getOptionLabel = (type: string, item: any) => {
    switch (type) {
      case "contact": return `${item.first_name} ${item.last_name} (${item.email || 'No email'})`;
      case "customer": return item.name;
      case "lead": return `${item.company_name} - ${item.contact_name}`;
      case "contract": return `${item.contract_number} - ${item.customer?.name || ''}`;
      case "purchase_order": return item.po_number;
      case "supplier": return item.name;
      default: return "";
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Suggestions */}
      {loading && (
        <Card className="p-3 bg-primary/5">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm">AI is analyzing email for potential links...</span>
          </div>
        </Card>
      )}

      {suggestions.length > 0 && !loading && (
        <Card className="p-3 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI Suggestions</span>
          </div>
          <div className="space-y-2">
            {suggestions.map((suggestion, idx) => (
              <div key={idx} className="text-xs bg-background p-2 rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{suggestion.type.replace('_', ' ')}</span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(suggestion.confidence * 100)}% confidence
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1">{suggestion.reasoning}</p>
                <p className="text-primary mt-1">Search: "{suggestion.searchTerm}"</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Link Selection */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <LinkIcon className="h-4 w-4" />
          <h3 className="font-semibold">Linked Records</h3>
        </div>
        
        <div className="space-y-3">
          {linkTypes.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded ${color}`}>
                  <Icon className="h-3 w-3" />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
              
              <div className="flex gap-2">
                <Select
                  value={getLinkedValue(key) || "none"}
                  onValueChange={(value) => updateLink(`${key}_id`, value === "none" ? null : value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {getOptions(key).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {getOptionLabel(key, item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {getLinkedValue(key) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateLink(`${key}_id`, null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
