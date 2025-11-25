import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import Fuse from 'fuse.js';
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
  BookOpen,
} from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  route: string;
  icon: any;
  score?: number;
}

interface GlobalSearchProps {
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export function GlobalSearch({ open: externalOpen, setOpen: externalSetOpen }: GlobalSearchProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 150);
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

  // Optimized single query approach with fuzzy search
  const { data: allData, isLoading } = useQuery({
    queryKey: ["global-search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return null;
      
      const query = debouncedSearch.toLowerCase();
      
      // Parallel queries for better performance
      const [
        customersData,
        locationsData,
        quotesData,
        invoicesData,
        projectsData,
        serviceOrdersData,
        contractsData,
        helpdeskData,
        knowledgeData
      ] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, email, phone")
          .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(20),
        supabase
          .from("customer_locations")
          .select("id, name, address, customer_id, customers(name)")
          .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
          .limit(20),
        supabase
          .from("quotes")
          .select("id, quote_number, title, total_amount, customer_id, customers(name)")
          .or(`quote_number.ilike.%${query}%,title.ilike.%${query}%`)
          .limit(20),
        supabase
          .from("invoices")
          .select("id, invoice_number, total_amount, customer_id, customers(name)")
          .ilike("invoice_number", `%${query}%`)
          .limit(20),
        supabase
          .from("projects")
          .select("id, name, description, customer_id, customers(name)")
          .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(20),
        supabase
          .from("service_orders")
          .select("id, order_number, title, customer_id, customers(name)")
          .or(`order_number.ilike.%${query}%,title.ilike.%${query}%`)
          .limit(20),
        supabase
          .from("service_contracts")
          .select("id, contract_number, description, customer_id, customers(name)")
          .or(`contract_number.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(20),
        supabase
          .from("helpdesk_tickets")
          .select("id, ticket_number, subject, sender_name, sender_email")
          .or(`ticket_number.ilike.%${query}%,subject.ilike.%${query}%,sender_name.ilike.%${query}%,sender_email.ilike.%${query}%`)
          .limit(20),
        supabase
          .from("knowledge_articles")
          .select("id, title, summary, knowledge_categories(name)")
          .eq("status", "published")
          .or(`title.ilike.%${query}%,summary.ilike.%${query}%,content.ilike.%${query}%`)
          .limit(20)
      ]);

      return {
        customers: customersData.data || [],
        locations: locationsData.data || [],
        quotes: quotesData.data || [],
        invoices: invoicesData.data || [],
        projects: projectsData.data || [],
        serviceOrders: serviceOrdersData.data || [],
        contracts: contractsData.data || [],
        helpdesk: helpdeskData.data || [],
        knowledge: knowledgeData.data || []
      };
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
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

  // Fuzzy search with ranking
  const results = useMemo(() => {
    if (!searchQuery.trim() || !allData) return [];

    const allResults: SearchResult[] = [];

    // Prepare data for fuzzy search
    const prepareCustomers = allData.customers.map(c => ({
      ...c,
      searchText: `${c.name} ${c.email || ''} ${c.phone || ''}`.toLowerCase()
    }));
    const prepareLocations = allData.locations.map(l => ({
      ...l,
      searchText: `${l.name} ${l.address || ''} ${(l.customers as any)?.name || ''}`.toLowerCase()
    }));
    const prepareQuotes = allData.quotes.map(q => ({
      ...q,
      searchText: `${q.quote_number} ${q.title || ''} ${(q.customers as any)?.name || ''}`.toLowerCase()
    }));
    const prepareInvoices = allData.invoices.map(i => ({
      ...i,
      searchText: `${i.invoice_number} ${(i.customers as any)?.name || ''}`.toLowerCase()
    }));
    const prepareProjects = allData.projects.map(p => ({
      ...p,
      searchText: `${p.name} ${p.description || ''} ${(p.customers as any)?.name || ''}`.toLowerCase()
    }));
    const prepareServiceOrders = allData.serviceOrders.map(s => ({
      ...s,
      searchText: `${s.order_number} ${s.title || ''} ${(s.customers as any)?.name || ''}`.toLowerCase()
    }));
    const prepareContracts = allData.contracts.map(c => ({
      ...c,
      searchText: `${c.contract_number} ${c.description || ''} ${(c.customers as any)?.name || ''}`.toLowerCase()
    }));
    const prepareHelpdesk = allData.helpdesk.map(h => ({
      ...h,
      searchText: `${h.ticket_number} ${h.subject || ''} ${h.sender_name || ''} ${h.sender_email || ''}`.toLowerCase()
    }));
    const prepareKnowledge = allData.knowledge.map((k: any) => ({
      ...k,
      searchText: `${k.title} ${k.summary || ''} ${k.knowledge_categories?.name || ''}`.toLowerCase()
    }));

    // Fuzzy search configuration
    const fuseOptions = {
      keys: ['searchText'],
      threshold: 0.4,
      distance: 100,
      includeScore: true
    };

    // Search each category
    const customersFuse = new Fuse(prepareCustomers, fuseOptions);
    const locationsFuse = new Fuse(prepareLocations, fuseOptions);
    const quotesFuse = new Fuse(prepareQuotes, fuseOptions);
    const invoicesFuse = new Fuse(prepareInvoices, fuseOptions);
    const projectsFuse = new Fuse(prepareProjects, fuseOptions);
    const serviceOrdersFuse = new Fuse(prepareServiceOrders, fuseOptions);
    const contractsFuse = new Fuse(prepareContracts, fuseOptions);
    const helpdeskFuse = new Fuse(prepareHelpdesk, fuseOptions);
    const knowledgeFuse = new Fuse(prepareKnowledge, fuseOptions);

    // Get results
    customersFuse.search(searchQuery).forEach(result => {
      allResults.push({
        id: result.item.id,
        title: result.item.name || "Unnamed Customer",
        subtitle: result.item.email || result.item.phone,
        type: "customer",
        route: `/customers/${result.item.id}`,
        icon: Building2,
        score: result.score || 1
      });
    });

    locationsFuse.search(searchQuery).forEach(result => {
      allResults.push({
        id: result.item.id,
        title: result.item.name || "Unnamed Location",
        subtitle: (result.item.customers as any)?.name,
        type: "location",
        route: `/customer-locations/${result.item.id}`,
        icon: MapPin,
        score: result.score || 1
      });
    });

    quotesFuse.search(searchQuery).forEach(result => {
      allResults.push({
        id: result.item.id,
        title: result.item.quote_number || "Quote",
        subtitle: `${(result.item.customers as any)?.name || ''} ${result.item.total_amount ? `· $${result.item.total_amount.toLocaleString()}` : ''}`.trim(),
        type: "quote",
        route: `/quotes/${result.item.id}`,
        icon: FileText,
        score: result.score || 1
      });
    });

    invoicesFuse.search(searchQuery).forEach(result => {
      allResults.push({
        id: result.item.id,
        title: result.item.invoice_number || "Invoice",
        subtitle: `${(result.item.customers as any)?.name || ''} ${result.item.total_amount ? `· $${result.item.total_amount.toLocaleString()}` : ''}`.trim(),
        type: "invoice",
        route: `/invoices/${result.item.id}`,
        icon: DollarSign,
        score: result.score || 1
      });
    });

    projectsFuse.search(searchQuery).forEach(result => {
      allResults.push({
        id: result.item.id,
        title: result.item.name || "Project",
        subtitle: (result.item.customers as any)?.name,
        type: "project",
        route: `/projects/${result.item.id}`,
        icon: Briefcase,
        score: result.score || 1
      });
    });

    serviceOrdersFuse.search(searchQuery).forEach(result => {
      allResults.push({
        id: result.item.id,
        title: result.item.order_number || "Service Order",
        subtitle: `${(result.item.customers as any)?.name || ''} ${result.item.title ? `· ${result.item.title}` : ''}`.trim(),
        type: "service-order",
        route: `/service-orders/${result.item.id}`,
        icon: Wrench,
        score: result.score || 1
      });
    });

    contractsFuse.search(searchQuery).forEach(result => {
      allResults.push({
        id: result.item.id,
        title: result.item.contract_number || "Contract",
        subtitle: (result.item.customers as any)?.name,
        type: "contract",
        route: `/service-contracts/${result.item.id}`,
        icon: FileSignature,
        score: result.score || 1
      });
    });

    helpdeskFuse.search(searchQuery).forEach(result => {
      allResults.push({
        id: result.item.id,
        title: result.item.ticket_number || "Ticket",
        subtitle: result.item.subject || result.item.sender_name,
        type: "helpdesk",
        route: `/helpdesk?ticket=${result.item.id}`,
        icon: Headphones,
        score: result.score || 1
      });
    });

    knowledgeFuse.search(searchQuery).forEach(result => {
      const item = result.item as any;
      allResults.push({
        id: item.id,
        title: item.title || "Article",
        subtitle: item.knowledge_categories?.name || item.summary,
        type: "knowledge",
        route: `/knowledge-base/${item.id}`,
        icon: BookOpen,
        score: result.score || 1
      });
    });

    // Deduplicate by id and type, then sort by relevance score
    const seen = new Set<string>();
    const deduplicatedResults = allResults.filter(result => {
      const key = `${result.type}-${result.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    return deduplicatedResults.sort((a, b) => (a.score || 1) - (b.score || 1));
  }, [searchQuery, allData]);

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
            
            {isLoading && searchQuery.trim() && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Searching...
              </div>
            )}
            
            {!isLoading && searchQuery.trim() && results.length === 0 && (
              <CommandEmpty>No results found for "{searchQuery}"</CommandEmpty>
            )}

            {Object.entries(groupedResults).map(([type, items]) => (
              <CommandGroup key={type} heading={`${typeLabels[type] || type} (${items.length})`}>
                {items.slice(0, 5).map((item) => {
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
