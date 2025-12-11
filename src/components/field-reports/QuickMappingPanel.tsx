import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Search, 
  Building2, 
  MapPin, 
  Check, 
  Loader2,
  ChevronRight,
  Phone,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MappingSuggestions } from './MappingSuggestions';

interface QuickMappingPanelProps {
  report: {
    id: string;
    report_number: string;
    manual_location_entry: string | null;
    contractor_phone: string | null;
    contractor_name: string | null;
    service_date: string;
  };
  onMapped: () => void;
  onNext?: () => void;
  hasNext?: boolean;
}

interface CustomerLocation {
  customerId: string;
  customerName: string;
  locationId: string;
  locationName: string;
  locationAddress: string | null;
}

export function QuickMappingPanel({ report, onMapped, onNext, hasNext }: QuickMappingPanelProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Reset when report changes
  useEffect(() => {
    setSelectedCustomerId('');
    setSelectedLocationId('');
    setSearchTerm('');
  }, [report.id]);

  // Fetch all customer locations in one query for better UX
  const { data: customerLocations = [], isLoading } = useQuery({
    queryKey: ['customer-locations-flat'],
    queryFn: async () => {
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (customersError) throw customersError;

      const { data: locations, error: locationsError } = await supabase
        .from('customer_locations')
        .select('id, name, address, customer_id')
        .eq('is_active', true)
        .order('name');

      if (locationsError) throw locationsError;

      // Flatten into customer-location pairs
      const flat: CustomerLocation[] = [];
      for (const location of locations || []) {
        const customer = customers?.find(c => c.id === location.customer_id);
        if (customer) {
          flat.push({
            customerId: customer.id,
            customerName: customer.name,
            locationId: location.id,
            locationName: location.name,
            locationAddress: location.address,
          });
        }
      }
      return flat;
    },
  });

  // Filter by search term
  const filteredLocations = useMemo(() => {
    if (!searchTerm.trim()) return customerLocations;
    const search = searchTerm.toLowerCase();
    return customerLocations.filter(cl =>
      cl.customerName.toLowerCase().includes(search) ||
      cl.locationName.toLowerCase().includes(search) ||
      cl.locationAddress?.toLowerCase().includes(search)
    );
  }, [customerLocations, searchTerm]);

  // Group by customer for display
  const groupedLocations = useMemo(() => {
    const groups: Record<string, CustomerLocation[]> = {};
    for (const cl of filteredLocations) {
      if (!groups[cl.customerId]) {
        groups[cl.customerId] = [];
      }
      groups[cl.customerId].push(cl);
    }
    return groups;
  }, [filteredLocations]);

  const saveMapping = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId || !selectedLocationId) {
        throw new Error('Please select a customer and location');
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('field_reports')
        .update({
          customer_id: selectedCustomerId,
          location_id: selectedLocationId,
          needs_customer_mapping: false,
          mapped_by: user?.id,
          mapped_at: new Date().toISOString(),
          status: 'contractor_submitted',
        })
        .eq('id', report.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-reports'] });
      queryClient.invalidateQueries({ queryKey: ['field-report', report.id] });
      toast.success('Report mapped successfully');
      onMapped();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to map report');
    },
  });

  const handleSuggestionSelect = (customerId: string, locationId: string) => {
    setSelectedCustomerId(customerId);
    setSelectedLocationId(locationId);
  };

  const handleLocationSelect = (cl: CustomerLocation) => {
    setSelectedCustomerId(cl.customerId);
    setSelectedLocationId(cl.locationId);
  };

  return (
    <div className="space-y-6">
      {/* Report Info Header */}
      <div className="rounded-lg border bg-destructive/5 border-destructive/20 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="font-semibold text-destructive">Needs Mapping</span>
          <Badge variant="outline">{report.report_number}</Badge>
        </div>
        
        {report.contractor_name && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{report.contractor_name}</span>
          </div>
        )}
        
        {report.contractor_phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{report.contractor_phone}</span>
          </div>
        )}

        {report.manual_location_entry && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-md p-3 mt-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium block">
                  Contractor entered:
                </span>
                <p className="text-foreground font-medium mt-1">
                  "{report.manual_location_entry}"
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Smart Suggestions */}
      <MappingSuggestions
        manualEntry={report.manual_location_entry}
        customerLocations={customerLocations}
        onSelect={handleSuggestionSelect}
        selectedCustomerId={selectedCustomerId}
        selectedLocationId={selectedLocationId}
      />

      {/* Manual Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Or search manually:</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers or locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(groupedLocations).length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            <div className="p-2">
              {Object.entries(groupedLocations).map(([customerId, locations]) => (
                <div key={customerId} className="mb-3">
                  <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>{locations[0].customerName}</span>
                  </div>
                  <div className="ml-4 space-y-1">
                    {locations.map((cl) => {
                      const isSelected = 
                        selectedCustomerId === cl.customerId && 
                        selectedLocationId === cl.locationId;
                      return (
                        <button
                          key={cl.locationId}
                          onClick={() => handleLocationSelect(cl)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent"
                          )}
                        >
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{cl.locationName}</p>
                            {cl.locationAddress && (
                              <p className={cn(
                                "text-xs truncate",
                                isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                {cl.locationAddress}
                              </p>
                            )}
                          </div>
                          {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Selected Summary */}
      {selectedCustomerId && selectedLocationId && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
          <p className="text-sm font-medium">Selected:</p>
          <p className="text-sm text-muted-foreground">
            {customerLocations.find(cl => cl.locationId === selectedLocationId)?.customerName}
            {' → '}
            {customerLocations.find(cl => cl.locationId === selectedLocationId)?.locationName}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => saveMapping.mutate()}
          disabled={!selectedCustomerId || !selectedLocationId || saveMapping.isPending}
          className="flex-1"
        >
          {saveMapping.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Mapping
            </>
          )}
        </Button>
        {hasNext && onNext && (
          <Button variant="outline" onClick={onNext}>
            Skip
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
