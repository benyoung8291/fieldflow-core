import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Fuse from "fuse.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search } from "lucide-react";
import {
  Home,
  Users,
  FileText,
  DollarSign,
  Calendar,
  Wrench,
  ClipboardList,
  Building2,
  MapPin,
  Briefcase,
  ListChecks,
  UserCircle,
  Headphones,
  ShoppingCart,
  CreditCard,
  Settings,
  BarChart3,
  Package,
  Clock,
  TrendingUp,
} from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  route: string;
  icon: any;
}

interface AccessHistory {
  id: string;
  count: number;
  lastAccessed: number;
}

interface RecentSearch {
  query: string;
  timestamp: number;
}

interface GlobalSearchProps {
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export function GlobalSearch({ open: externalOpen, setOpen: externalSetOpen }: GlobalSearchProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();

  // Use external state if provided, otherwise use internal state
  const open = externalOpen ?? internalOpen;
  const setOpen = externalSetOpen ?? setInternalOpen;

  // Open dropdown when focused or has content
  const showDropdown = isFocused || searchQuery.trim().length > 0;

  // Load access history and recent searches from localStorage
  const [accessHistory, setAccessHistory] = useState<Record<string, AccessHistory>>(() => {
    try {
      const saved = localStorage.getItem('searchAccessHistory');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage when access history changes
  useEffect(() => {
    localStorage.setItem('searchAccessHistory', JSON.stringify(accessHistory));
  }, [accessHistory]);

  // Save to localStorage when recent searches change
  useEffect(() => {
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  // Keyboard shortcut to focus search
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

  // Static navigation items
  const navigationItems: SearchResult[] = [
    { id: "home", title: "Dashboard", type: "page", route: "/", icon: Home },
    { id: "customers", title: "Customers", type: "page", route: "/customers", icon: Users },
    { id: "quotes", title: "Quotes", type: "page", route: "/quotes", icon: FileText },
    { id: "invoices", title: "Invoices", type: "page", route: "/invoices", icon: DollarSign },
    { id: "scheduler", title: "Scheduler", type: "page", route: "/scheduler", icon: Calendar },
    { id: "service-orders", title: "Service Orders", type: "page", route: "/service-orders", icon: Wrench },
    { id: "projects", title: "Projects", type: "page", route: "/projects", icon: Briefcase },
    { id: "tasks", title: "Tasks", type: "page", route: "/tasks", icon: ListChecks },
    { id: "workers", title: "Workers", type: "page", route: "/workers", icon: UserCircle },
    { id: "helpdesk", title: "Help Desk", type: "page", route: "/helpdesk", icon: Headphones },
    { id: "expenses", title: "Expenses", type: "page", route: "/expenses", icon: CreditCard },
    { id: "purchase-orders", title: "Purchase Orders", type: "page", route: "/purchase-orders", icon: ShoppingCart },
    { id: "suppliers", title: "Suppliers", type: "page", route: "/suppliers", icon: Package },
    { id: "analytics", title: "Analytics", type: "page", route: "/analytics", icon: BarChart3 },
    { id: "settings", title: "Settings", type: "page", route: "/settings", icon: Settings },
  ];

  // Fetch documents from database
  const { data: customers } = useQuery({
    queryKey: ["search-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email")
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: quotes } = useQuery({
    queryKey: ["search-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, quote_number, customers(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["search-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, customers(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["search-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, customers(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ["search-service-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("id, order_number, customers(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["search-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_locations")
        .select("id, name, address, customers(name)")
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Combine all searchable items
  const allResults: SearchResult[] = useMemo(() => {
    const results: SearchResult[] = [...navigationItems];

    // Add customers
    customers?.forEach((customer) => {
      results.push({
        id: customer.id,
        title: customer.name || "Unnamed Customer",
        subtitle: customer.email,
        type: "customer",
        route: `/customers/${customer.id}`,
        icon: Building2,
      });
    });

    // Add quotes
    quotes?.forEach((quote) => {
      const customerName = (quote.customers as any)?.name;
      results.push({
        id: quote.id,
        title: quote.quote_number || "Quote",
        subtitle: customerName,
        type: "quote",
        route: `/quotes/${quote.id}`,
        icon: FileText,
      });
    });

    // Add invoices
    invoices?.forEach((invoice) => {
      const customerName = (invoice.customers as any)?.name;
      results.push({
        id: invoice.id,
        title: invoice.invoice_number || "Invoice",
        subtitle: customerName,
        type: "invoice",
        route: `/invoices/${invoice.id}`,
        icon: DollarSign,
      });
    });

    // Add projects
    projects?.forEach((project) => {
      const customerName = (project.customers as any)?.name;
      results.push({
        id: project.id,
        title: project.name || "Project",
        subtitle: customerName,
        type: "project",
        route: `/projects/${project.id}`,
        icon: Briefcase,
      });
    });

    // Add service orders
    serviceOrders?.forEach((order) => {
      const customerName = (order.customers as any)?.name;
      results.push({
        id: order.id,
        title: order.order_number || "Service Order",
        subtitle: customerName,
        type: "service-order",
        route: `/service-orders/${order.id}`,
        icon: Wrench,
      });
    });

    // Add locations
    locations?.forEach((location) => {
      const customerName = (location.customers as any)?.name;
      results.push({
        id: location.id,
        title: location.name || location.address || "Location",
        subtitle: customerName,
        type: "location",
        route: `/customer-locations/${location.id}`,
        icon: MapPin,
      });
    });

    return results;
  }, [customers, quotes, invoices, projects, serviceOrders, locations, navigationItems]);

  const handleSelect = (result: SearchResult) => {
    // Track access
    const now = Date.now();
    setAccessHistory(prev => ({
      ...prev,
      [result.id]: {
        id: result.id,
        count: (prev[result.id]?.count || 0) + 1,
        lastAccessed: now,
      }
    }));

    // Track search query if not empty
    if (searchQuery.trim()) {
      setRecentSearches(prev => {
        const filtered = prev.filter(s => s.query !== searchQuery.trim());
        return [{ query: searchQuery.trim(), timestamp: now }, ...filtered].slice(0, 10);
      });
    }

    setSearchQuery("");
    setIsFocused(false);
    navigate(result.route);
  };

  // Initialize Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(allResults, {
      keys: [
        { name: "title", weight: 2 },
        { name: "subtitle", weight: 1 },
        { name: "type", weight: 0.5 },
      ],
      threshold: 0.4, // Lower = more strict, higher = more fuzzy (0-1)
      distance: 100,
      minMatchCharLength: 2,
      includeScore: true,
    });
  }, [allResults]);

  // Get frequently accessed items
  const frequentlyAccessed = useMemo(() => {
    const sorted = Object.values(accessHistory)
      .sort((a, b) => {
        // Sort by count first, then by last accessed time
        if (b.count !== a.count) return b.count - a.count;
        return b.lastAccessed - a.lastAccessed;
      })
      .slice(0, 5);

    return sorted
      .map(item => allResults.find(r => r.id === item.id))
      .filter((item): item is SearchResult => item !== undefined);
  }, [accessHistory, allResults]);

  // Filter results using fuzzy search
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) {
      // When empty, show all results but frequently accessed will be shown first
      return allResults;
    }
    
    const fuseResults = fuse.search(searchQuery);
    return fuseResults.map(result => result.item);
  }, [searchQuery, fuse, allResults]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      pages: [],
      customers: [],
      quotes: [],
      invoices: [],
      projects: [],
      "service-orders": [],
      locations: [],
    };

    filteredResults.forEach((result) => {
      if (result.type === "page") {
        groups.pages.push(result);
      } else if (groups[result.type]) {
        groups[result.type].push(result);
      }
    });

    return groups;
  }, [filteredResults]);

  return (
    <Popover open={showDropdown} onOpenChange={setIsFocused}>
      <PopoverTrigger asChild>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="global-search-input"
            placeholder="Search pages and documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            className="pl-9 pr-4"
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
            <CommandEmpty>No results found.</CommandEmpty>

            {!searchQuery.trim() && recentSearches.length > 0 && (
              <>
                <CommandGroup heading="Recent Searches">
                  {recentSearches.slice(0, 5).map((search, index) => (
                    <CommandItem
                      key={`recent-${index}`}
                      value={search.query}
                      onSelect={() => setSearchQuery(search.query)}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      <span>{search.query}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {!searchQuery.trim() && frequentlyAccessed.length > 0 && (
              <>
                <CommandGroup heading="Frequently Accessed">
                  {frequentlyAccessed.map((item) => {
                    const Icon = item.icon;
                    const accessInfo = accessHistory[item.id];
                    return (
                      <CommandItem
                        key={`frequent-${item.id}`}
                        value={`${item.title} ${item.subtitle || ""}`}
                        onSelect={() => handleSelect(item)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <div className="flex flex-col flex-1">
                          <span>{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="h-3 w-3" />
                          <span>{accessInfo.count}</span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {groupedResults.pages.length > 0 && (
              <>
                <CommandGroup heading="Pages">
                  {groupedResults.pages.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.id}
                        value={item.title}
                        onSelect={() => handleSelect(item)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {groupedResults.customers.length > 0 && (
              <>
                <CommandGroup heading="Customers">
                  {groupedResults.customers.slice(0, 5).map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.id}
                        value={`${item.title} ${item.subtitle || ""}`}
                        onSelect={() => handleSelect(item)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {groupedResults.quotes.length > 0 && (
              <>
                <CommandGroup heading="Quotes">
                  {groupedResults.quotes.slice(0, 5).map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.id}
                        value={`${item.title} ${item.subtitle || ""}`}
                        onSelect={() => handleSelect(item)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {groupedResults.invoices.length > 0 && (
              <>
                <CommandGroup heading="Invoices">
                  {groupedResults.invoices.slice(0, 5).map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.id}
                        value={`${item.title} ${item.subtitle || ""}`}
                        onSelect={() => handleSelect(item)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {groupedResults.projects.length > 0 && (
              <>
                <CommandGroup heading="Projects">
                  {groupedResults.projects.slice(0, 5).map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.id}
                        value={`${item.title} ${item.subtitle || ""}`}
                        onSelect={() => handleSelect(item)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {groupedResults["service-orders"].length > 0 && (
              <>
                <CommandGroup heading="Service Orders">
                  {groupedResults["service-orders"].slice(0, 5).map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.id}
                        value={`${item.title} ${item.subtitle || ""}`}
                        onSelect={() => handleSelect(item)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {groupedResults.locations.length > 0 && (
              <CommandGroup heading="Locations">
                {groupedResults.locations.slice(0, 5).map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.title} ${item.subtitle || ""}`}
                      onSelect={() => handleSelect(item)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{item.title}</span>
                        {item.subtitle && (
                          <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
