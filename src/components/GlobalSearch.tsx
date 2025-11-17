import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search } from "lucide-react";
import {
  Building2,
  MapPin,
  FileText,
  DollarSign,
  Briefcase,
  Wrench,
  FileSignature,
  Headphones,
} from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  route: string;
  icon: any;
}

interface GlobalSearchProps {
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export function GlobalSearch({ open: externalOpen, setOpen: externalSetOpen }: GlobalSearchProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const navigate = useNavigate();

  const open = externalOpen ?? internalOpen;
  const setOpen = externalSetOpen ?? setInternalOpen;

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        document.getElementById("global-search-input")?.focus();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch all data - only when search query is present
  const { data: customers } = useQuery({
    queryKey: ["search-customers", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const { data } = await supabase
        .from("customers")
        .select("id, name, email")
        .or(`name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`)
        .limit(50);
      return data || [];
    },
    enabled: debouncedSearch.length > 0,
  });

  const { data: locations } = useQuery({
    queryKey: ["search-locations", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const { data } = await supabase
        .from("customer_locations")
        .select("id, name, customer_id, customers(name)")
        .ilike("name", `%${debouncedSearch}%`)
        .limit(50);
      return data || [];
    },
    enabled: debouncedSearch.length > 0,
  });

  const { data: quotes } = useQuery({
    queryKey: ["search-quotes", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const { data } = await supabase
        .from("quotes")
        .select("id, quote_number, customer_id, customers(name)")
        .ilike("quote_number", `%${debouncedSearch}%`)
        .limit(50);
      return data || [];
    },
    enabled: debouncedSearch.length > 0,
  });

  const { data: invoices } = useQuery({
    queryKey: ["search-invoices", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer_id, customers(name)")
        .ilike("invoice_number", `%${debouncedSearch}%`)
        .limit(50);
      return data || [];
    },
    enabled: debouncedSearch.length > 0,
  });

  const { data: projects } = useQuery({
    queryKey: ["search-projects", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const { data } = await supabase
        .from("projects")
        .select("id, name, customer_id, customers(name)")
        .ilike("name", `%${debouncedSearch}%`)
        .limit(50);
      return data || [];
    },
    enabled: debouncedSearch.length > 0,
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ["search-service-orders", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const { data } = await supabase
        .from("service_orders")
        .select("id, order_number, customer_id, customers(name)")
        .ilike("order_number", `%${debouncedSearch}%`)
        .limit(50);
      return data || [];
    },
    enabled: debouncedSearch.length > 0,
  });

  const { data: contracts } = useQuery({
    queryKey: ["search-contracts", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const { data } = await supabase
        .from("service_contracts")
        .select("id, contract_number, customer_id, customers(name)")
        .ilike("contract_number", `%${debouncedSearch}%`)
        .limit(50);
      return data || [];
    },
    enabled: debouncedSearch.length > 0,
  });

  const { data: helpdesk } = useQuery({
    queryKey: ["search-helpdesk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("helpdesk_tickets")
        .select("id, ticket_number, subject, sender_name")
        .limit(200);
      return data || [];
    },
  });

  // Simple search function
  const searchResults = (): SearchResult[] => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.trim().toLowerCase();
    const results: SearchResult[] = [];

    // Search customers
    customers?.forEach((customer) => {
      const name = customer.name?.trim().toLowerCase() || "";
      const email = customer.email?.trim().toLowerCase() || "";
      if (name.includes(query) || email.includes(query)) {
        results.push({
          id: customer.id,
          title: customer.name || "Unnamed Customer",
          subtitle: customer.email,
          type: "customer",
          route: `/customers/${customer.id}`,
          icon: Building2,
        });
      }
    });

    // Search locations
    locations?.forEach((location) => {
      const name = location.name?.trim().toLowerCase() || "";
      const customerName = (location.customers as any)?.name?.trim().toLowerCase() || "";
      if (name.includes(query) || customerName.includes(query)) {
        results.push({
          id: location.id,
          title: location.name || "Unnamed Location",
          subtitle: (location.customers as any)?.name,
          type: "location",
          route: `/customer-locations/${location.id}`,
          icon: MapPin,
        });
      }
    });

    // Search quotes
    quotes?.forEach((quote) => {
      const number = quote.quote_number?.trim().toLowerCase() || "";
      const customerName = (quote.customers as any)?.name?.trim().toLowerCase() || "";
      if (number.includes(query) || customerName.includes(query)) {
        results.push({
          id: quote.id,
          title: quote.quote_number || "Quote",
          subtitle: (quote.customers as any)?.name,
          type: "quote",
          route: `/quotes/${quote.id}`,
          icon: FileText,
        });
      }
    });

    // Search invoices
    invoices?.forEach((invoice) => {
      const number = invoice.invoice_number?.trim().toLowerCase() || "";
      const customerName = (invoice.customers as any)?.name?.trim().toLowerCase() || "";
      if (number.includes(query) || customerName.includes(query)) {
        results.push({
          id: invoice.id,
          title: invoice.invoice_number || "Invoice",
          subtitle: (invoice.customers as any)?.name,
          type: "invoice",
          route: `/invoices/${invoice.id}`,
          icon: DollarSign,
        });
      }
    });

    // Search projects
    projects?.forEach((project) => {
      const name = project.name?.trim().toLowerCase() || "";
      const customerName = (project.customers as any)?.name?.trim().toLowerCase() || "";
      if (name.includes(query) || customerName.includes(query)) {
        results.push({
          id: project.id,
          title: project.name || "Project",
          subtitle: (project.customers as any)?.name,
          type: "project",
          route: `/projects/${project.id}`,
          icon: Briefcase,
        });
      }
    });

    // Search service orders
    serviceOrders?.forEach((order) => {
      const number = order.order_number?.trim().toLowerCase() || "";
      const customerName = (order.customers as any)?.name?.trim().toLowerCase() || "";
      if (number.includes(query) || customerName.includes(query)) {
        results.push({
          id: order.id,
          title: order.order_number || "Service Order",
          subtitle: (order.customers as any)?.name,
          type: "service-order",
          route: `/service-orders/${order.id}`,
          icon: Wrench,
        });
      }
    });

    // Search contracts
    contracts?.forEach((contract) => {
      const number = contract.contract_number?.trim().toLowerCase() || "";
      const customerName = (contract.customers as any)?.name?.trim().toLowerCase() || "";
      if (number.includes(query) || customerName.includes(query)) {
        results.push({
          id: contract.id,
          title: contract.contract_number || "Contract",
          subtitle: (contract.customers as any)?.name,
          type: "contract",
          route: `/service-contracts/${contract.id}`,
          icon: FileSignature,
        });
      }
    });

    // Search helpdesk
    helpdesk?.forEach((ticket) => {
      const number = ticket.ticket_number?.trim().toLowerCase() || "";
      const subject = ticket.subject?.trim().toLowerCase() || "";
      const sender = ticket.sender_name?.trim().toLowerCase() || "";
      if (number.includes(query) || subject.includes(query) || sender.includes(query)) {
        results.push({
          id: ticket.id,
          title: ticket.ticket_number || "Ticket",
          subtitle: ticket.subject || ticket.sender_name,
          type: "helpdesk",
          route: `/helpdesk?ticket=${ticket.id}`,
          icon: Headphones,
        });
      }
    });

    return results;
  };

  const results = searchResults();

  // Group results by type
  const groupedResults: Record<string, SearchResult[]> = {};
  results.forEach((result) => {
    if (!groupedResults[result.type]) {
      groupedResults[result.type] = [];
    }
    groupedResults[result.type].push(result);
  });

  const handleSelect = (result: SearchResult) => {
    setSearchQuery("");
    navigate(result.route);
  };

  const typeLabels: Record<string, string> = {
    customer: "Customers",
    location: "Locations",
    quote: "Quotes",
    invoice: "Invoices",
    project: "Projects",
    "service-order": "Service Orders",
    contract: "Contracts",
    helpdesk: "Help Desk",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            id="global-search-input"
            type="text"
            placeholder="Search everything... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            className="pl-10 pr-4"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 z-50 bg-popover" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList className="max-h-[400px]">
            {!searchQuery.trim() && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Type to search across all documents...
              </div>
            )}
            
            {searchQuery.trim() && results.length === 0 && (
              <CommandEmpty>No results found for "{searchQuery}"</CommandEmpty>
            )}

            {Object.entries(groupedResults).map(([type, items]) => (
              <CommandGroup key={type} heading={`${typeLabels[type] || type} (${items.length})`}>
                {items.slice(0, 8).map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.title} ${item.subtitle || ""}`}
                      onSelect={() => handleSelect(item)}
                      className="cursor-pointer"
                    >
                      <Icon className="mr-2 h-4 w-4 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{item.title}</span>
                        {item.subtitle && (
                          <span className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
