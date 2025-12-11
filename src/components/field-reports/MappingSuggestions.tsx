import { useMemo } from 'react';
import Fuse from 'fuse.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerLocation {
  customerId: string;
  customerName: string;
  locationId: string;
  locationName: string;
  locationAddress: string | null;
}

interface MappingSuggestionsProps {
  manualEntry: string | null;
  customerLocations: CustomerLocation[];
  onSelect: (customerId: string, locationId: string) => void;
  selectedCustomerId?: string;
  selectedLocationId?: string;
}

export function MappingSuggestions({
  manualEntry,
  customerLocations,
  onSelect,
  selectedCustomerId,
  selectedLocationId,
}: MappingSuggestionsProps) {
  const suggestions = useMemo(() => {
    if (!manualEntry || !customerLocations.length) return [];

    // Create searchable items combining customer and location info
    const searchItems = customerLocations.map(cl => ({
      ...cl,
      searchText: `${cl.customerName} ${cl.locationName} ${cl.locationAddress || ''}`.toLowerCase(),
    }));

    const fuse = new Fuse(searchItems, {
      keys: ['customerName', 'locationName', 'locationAddress', 'searchText'],
      threshold: 0.4, // More lenient matching
      includeScore: true,
      ignoreLocation: true,
    });

    const results = fuse.search(manualEntry);
    
    // Return top 3 suggestions with confidence scores
    return results.slice(0, 3).map(result => ({
      ...result.item,
      confidence: Math.round((1 - (result.score || 0)) * 100),
    }));
  }, [manualEntry, customerLocations]);

  if (!manualEntry || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span>Suggested matches based on "{manualEntry}"</span>
      </div>
      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const isSelected = 
            selectedCustomerId === suggestion.customerId && 
            selectedLocationId === suggestion.locationId;
          
          return (
            <Button
              key={`${suggestion.customerId}-${suggestion.locationId}`}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "w-full justify-start h-auto py-3 px-4",
                isSelected && "ring-2 ring-primary"
              )}
              onClick={() => onSelect(suggestion.customerId, suggestion.locationId)}
            >
              <div className="flex items-start gap-3 w-full">
                <div className="flex-1 text-left space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium">{suggestion.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm opacity-80">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span>{suggestion.locationName}</span>
                    {suggestion.locationAddress && (
                      <span className="text-xs">• {suggestion.locationAddress}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={suggestion.confidence > 70 ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {suggestion.confidence}% match
                  </Badge>
                  {isSelected && <Check className="h-4 w-4" />}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
