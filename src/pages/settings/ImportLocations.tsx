import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, RefreshCw, Check, X, Bot, Hand, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";
import Fuse from "fuse.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { SelectWithSearch } from "@/components/ui/select-with-search";

interface LocationMapping {
  id: string;
  airtable_auto_id: string;
  airtable_location_name: string;
  airtable_property: string;
  airtable_site_name: string;
  airtable_state: string;
  customer_id: string | null;
  location_id: string | null;
  match_status: string;
  match_confidence: number | null;
  is_manually_mapped: boolean;
}

interface Customer {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  customer_id: string;
}

const ROWS_PER_PAGE = 50;

export default function ImportLocations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['location-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('airtable_location_mapping')
        .select('*')
        .order('airtable_property', { ascending: true });
      
      if (error) throw error;
      return data as LocationMapping[];
    }
  });

  const { data: customers } = useQuery({
    queryKey: ['customers-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data as Customer[];
    }
  });

  const { data: locations } = useQuery({
    queryKey: ['locations-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_locations')
        .select('id, name, customer_id')
        .order('name');
      
      if (error) throw error;
      return data as Location[];
    }
  });

  // Memoize customer options for SelectWithSearch
  const customerOptions = useMemo(() => {
    return customers?.map(c => ({ value: c.id, label: c.name })) || [];
  }, [customers]);

  // Memoize locations grouped by customer for quick lookup
  const locationsByCustomer = useMemo(() => {
    const map = new Map<string, Location[]>();
    locations?.forEach(loc => {
      const existing = map.get(loc.customer_id) || [];
      existing.push(loc);
      map.set(loc.customer_id, existing);
    });
    return map;
  }, [locations]);

  // Memoize stats calculation
  const stats = useMemo(() => ({
    total: mappings?.length || 0,
    matched: mappings?.filter(m => m.match_status === 'matched' || m.match_status === 'manual').length || 0,
    pending: mappings?.filter(m => m.match_status === 'pending').length || 0
  }), [mappings]);

  // Memoize paginated data
  const { paginatedMappings, totalPages } = useMemo(() => {
    if (!mappings) return { paginatedMappings: [], totalPages: 0 };
    const total = Math.ceil(mappings.length / ROWS_PER_PAGE);
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return {
      paginatedMappings: mappings.slice(start, end),
      totalPages: total
    };
  }, [mappings, currentPage]);

  const updateMappingMutation = useMutation({
    mutationFn: async ({ id, customer_id, location_id, is_manually_mapped }: { 
      id: string; 
      customer_id: string | null; 
      location_id: string | null;
      is_manually_mapped: boolean;
    }) => {
      const match_status = customer_id && location_id ? 'matched' : 'pending';
      const { error } = await supabase
        .from('airtable_location_mapping')
        .update({ 
          customer_id, 
          location_id, 
          match_status,
          is_manually_mapped,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    // Optimistic update
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['location-mappings'] });
      const previous = queryClient.getQueryData(['location-mappings']);
      
      queryClient.setQueryData(['location-mappings'], (old: LocationMapping[] | undefined) => {
        if (!old) return old;
        return old.map(m => {
          if (m.id === variables.id) {
            return {
              ...m,
              customer_id: variables.customer_id,
              location_id: variables.location_id,
              is_manually_mapped: variables.is_manually_mapped,
              match_status: variables.customer_id && variables.location_id ? 'matched' : 'pending'
            };
          }
          return m;
        });
      });
      
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['location-mappings'], context.previous);
      }
      toast.error("Failed to update mapping");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['import-location-stats'] });
    }
  });

  const clearMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('airtable_location_mapping')
        .update({ 
          customer_id: null, 
          location_id: null, 
          match_status: 'pending',
          match_confidence: null,
          is_manually_mapped: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    // Optimistic update
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['location-mappings'] });
      const previous = queryClient.getQueryData(['location-mappings']);
      
      queryClient.setQueryData(['location-mappings'], (old: LocationMapping[] | undefined) => {
        if (!old) return old;
        return old.map(m => {
          if (m.id === id) {
            return {
              ...m,
              customer_id: null,
              location_id: null,
              match_status: 'pending',
              match_confidence: null,
              is_manually_mapped: false
            };
          }
          return m;
        });
      });
      
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['location-mappings'], context.previous);
      }
      toast.error("Failed to clear mapping");
    },
    onSuccess: () => {
      toast.success("Match cleared");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['import-location-stats'] });
    }
  });

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          const { data: profile } = await supabase.auth.getUser();
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', profile.user?.id)
            .single();

          if (!userProfile?.tenant_id) {
            toast.error("Could not determine tenant");
            return;
          }

          // Extract unique locations - support multiple CSV formats
          const uniqueLocations = new Map<string, any>();
          results.data.forEach((row: any) => {
            // Support multiple column name variations
            const autoId = row['AutoID'] || row['Auto ID'] || row['autonumber (from Locations)'];
            if (autoId && !uniqueLocations.has(autoId)) {
              uniqueLocations.set(autoId, {
                airtable_auto_id: autoId,
                airtable_location_name: row['Name'] || row['Location'] || '',
                airtable_property: row['Property'] || row['Property (from Locations)'] || '',
                airtable_site_name: row['Location Name'] || row['Site Name (from Locations)'] || '',
                airtable_state: row['State'] || row['State (from Locations)'] || '',
                tenant_id: userProfile.tenant_id,
                match_status: 'pending'
              });
            }
          });

          // Insert or update mappings
          const mappingsToInsert = Array.from(uniqueLocations.values());
          
          for (const mapping of mappingsToInsert) {
            const { error } = await supabase
              .from('airtable_location_mapping')
              .upsert(mapping, { onConflict: 'tenant_id,airtable_auto_id' });
            
            if (error) {
              console.error('Error inserting mapping:', error);
            }
          }

          toast.success(`Uploaded ${mappingsToInsert.length} unique locations`);
          queryClient.invalidateQueries({ queryKey: ['location-mappings'] });
          queryClient.invalidateQueries({ queryKey: ['import-location-stats'] });
        } catch (error) {
          console.error('Upload error:', error);
          toast.error("Failed to upload locations");
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        console.error('Parse error:', error);
        toast.error("Failed to parse CSV");
        setIsUploading(false);
      }
    });

    event.target.value = '';
  }, [queryClient]);

  const runAutoMatch = useCallback(async () => {
    if (!mappings || !customers || !locations) return;

    setIsAutoMatching(true);

    const unmatchedMappings = mappings.filter(m => !m.is_manually_mapped && m.match_status === 'pending');
    
    const customerFuse = new Fuse(customers, {
      keys: ['name'],
      threshold: 0.4,
      includeScore: true
    });

    let matchedCount = 0;

    for (const mapping of unmatchedMappings) {
      const searchTerm = mapping.airtable_property;
      if (!searchTerm) continue;

      const customerResults = customerFuse.search(searchTerm);
      
      if (customerResults.length > 0 && customerResults[0].score !== undefined) {
        const bestMatch = customerResults[0];
        const confidence = Math.round((1 - bestMatch.score) * 100);
        
        if (confidence >= 60) {
          const matchedCustomer = bestMatch.item;
          
          // Try to find matching location
          const customerLocations = locationsByCustomer.get(matchedCustomer.id) || [];
          const locationFuse = new Fuse(customerLocations, {
            keys: ['name'],
            threshold: 0.4,
            includeScore: true
          });

          const siteName = mapping.airtable_site_name;
          let matchedLocation = null;

          if (siteName && customerLocations.length > 0) {
            const locationResults = locationFuse.search(siteName);
            if (locationResults.length > 0) {
              matchedLocation = locationResults[0].item;
            }
          }

          const { error } = await supabase
            .from('airtable_location_mapping')
            .update({
              customer_id: matchedCustomer.id,
              location_id: matchedLocation?.id || null,
              match_status: matchedLocation ? 'matched' : 'pending',
              match_confidence: confidence,
              updated_at: new Date().toISOString()
            })
            .eq('id', mapping.id);

          if (!error) {
            matchedCount++;
          }
        }
      }
    }

    toast.success(`Auto-matched ${matchedCount} locations, ${unmatchedMappings.length - matchedCount} still pending`);
    queryClient.invalidateQueries({ queryKey: ['location-mappings'] });
    queryClient.invalidateQueries({ queryKey: ['import-location-stats'] });
    setIsAutoMatching(false);
  }, [mappings, customers, locations, locationsByCustomer, queryClient]);

  const getConfidenceBadge = useCallback((confidence: number | null) => {
    if (confidence === null) return null;
    
    if (confidence >= 80) {
      return <Badge className="bg-green-500">{confidence}%</Badge>;
    } else if (confidence >= 50) {
      return <Badge className="bg-yellow-500">{confidence}%</Badge>;
    } else {
      return <Badge variant="destructive">{confidence}%</Badge>;
    }
  }, []);

  const getLocationOptions = useCallback((customerId: string | null) => {
    if (!customerId) return [];
    const locs = locationsByCustomer.get(customerId) || [];
    return locs.map(l => ({ value: l.id, label: l.name }));
  }, [locationsByCustomer]);

  const progress = stats.total > 0 ? (stats.matched / stats.total) * 100 : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings/import')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Location Mapping</h1>
          <p className="text-muted-foreground">Map Airtable locations to customers and sites</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Card className="flex-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Mapping Progress</span>
              <span className="text-sm text-muted-foreground">{stats.matched}/{stats.total} mapped</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <div className="relative">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <Button variant="outline" disabled={isUploading}>
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload CSV'}
            </Button>
          </div>

          <Button 
            onClick={runAutoMatch} 
            disabled={isAutoMatching || !mappings?.length}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAutoMatching ? 'animate-spin' : ''}`} />
            Retry Auto-Match
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Location Mappings</CardTitle>
          <CardDescription>
            Match each Airtable location to a customer and site. Manually mapped rows are protected from auto-matching.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !mappings?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Upload a CSV file to begin mapping locations
            </div>
          ) : (
            <>
              <TooltipProvider>
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[40px]">Type</TableHead>
                        <TableHead>Airtable Property</TableHead>
                        <TableHead>Site Name</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMappings.map((mapping) => (
                        <TableRow key={mapping.id} className={mapping.match_status === 'pending' ? 'bg-muted/30' : ''}>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger>
                                {mapping.is_manually_mapped ? (
                                  <Hand className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <Bot className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {mapping.is_manually_mapped ? 'Manually mapped' : 'Auto-matched'}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="font-medium max-w-[150px] truncate">{mapping.airtable_property}</TableCell>
                          <TableCell className="max-w-[120px] truncate">{mapping.airtable_site_name}</TableCell>
                          <TableCell>{mapping.airtable_state}</TableCell>
                          <TableCell>{getConfidenceBadge(mapping.match_confidence)}</TableCell>
                          <TableCell>
                            <SelectWithSearch
                              value={mapping.customer_id || ""}
                              onValueChange={(value) => {
                                updateMappingMutation.mutate({
                                  id: mapping.id,
                                  customer_id: value || null,
                                  location_id: null,
                                  is_manually_mapped: true
                                });
                              }}
                              options={customerOptions}
                              placeholder="Select customer..."
                              searchPlaceholder="Search customers..."
                              className="w-[180px]"
                            />
                          </TableCell>
                          <TableCell>
                            <SelectWithSearch
                              value={mapping.location_id || ""}
                              onValueChange={(value) => {
                                updateMappingMutation.mutate({
                                  id: mapping.id,
                                  customer_id: mapping.customer_id,
                                  location_id: value || null,
                                  is_manually_mapped: true
                                });
                              }}
                              options={getLocationOptions(mapping.customer_id)}
                              placeholder={mapping.customer_id ? "Select location..." : "Select customer first"}
                              searchPlaceholder="Search locations..."
                              className="w-[180px]"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {mapping.match_status === 'matched' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Check className="h-4 w-4 text-green-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>Mapped</TooltipContent>
                                </Tooltip>
                              )}
                              {(mapping.customer_id || mapping.location_id) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => clearMappingMutation.mutate(mapping.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * ROWS_PER_PAGE) + 1} - {Math.min(currentPage * ROWS_PER_PAGE, stats.total)} of {stats.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
