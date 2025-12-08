import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, RefreshCw, Check, X, Bot, Hand } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";
import Fuse from "fuse.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

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

export default function ImportLocations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [isAutoMatching, setIsAutoMatching] = useState(false);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-mappings'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['import-location-stats'] });
      toast.success("Match cleared");
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

          // Extract unique locations
          const uniqueLocations = new Map<string, any>();
          results.data.forEach((row: any) => {
            const autoId = row['autonumber (from Locations)'] || row['Auto ID'];
            if (autoId && !uniqueLocations.has(autoId)) {
              uniqueLocations.set(autoId, {
                airtable_auto_id: autoId,
                airtable_location_name: row['Location'] || '',
                airtable_property: row['Property (from Locations)'] || '',
                airtable_site_name: row['Site Name (from Locations)'] || '',
                airtable_state: row['State (from Locations)'] || '',
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
          const customerLocations = locations.filter(l => l.customer_id === matchedCustomer.id);
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
  }, [mappings, customers, locations, queryClient]);

  const getConfidenceBadge = (confidence: number | null) => {
    if (confidence === null) return null;
    
    if (confidence >= 80) {
      return <Badge className="bg-green-500">{confidence}%</Badge>;
    } else if (confidence >= 50) {
      return <Badge className="bg-yellow-500">{confidence}%</Badge>;
    } else {
      return <Badge variant="destructive">{confidence}%</Badge>;
    }
  };

  const getLocationsForCustomer = (customerId: string | null) => {
    if (!customerId || !locations) return [];
    return locations.filter(l => l.customer_id === customerId);
  };

  const stats = {
    total: mappings?.length || 0,
    matched: mappings?.filter(m => m.match_status === 'matched' || m.match_status === 'manual').length || 0,
    pending: mappings?.filter(m => m.match_status === 'pending').length || 0
  };

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
            <div className="border rounded-lg overflow-auto max-h-[600px]">
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
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping) => (
                    <TableRow key={mapping.id} className={mapping.match_status === 'pending' ? 'bg-muted/30' : ''}>
                      <TableCell>
                        <TooltipProvider>
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
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="font-medium">{mapping.airtable_property}</TableCell>
                      <TableCell>{mapping.airtable_site_name}</TableCell>
                      <TableCell>{mapping.airtable_state}</TableCell>
                      <TableCell>{getConfidenceBadge(mapping.match_confidence)}</TableCell>
                      <TableCell>
                        <Select
                          value={mapping.customer_id || ""}
                          onValueChange={(value) => {
                            updateMappingMutation.mutate({
                              id: mapping.id,
                              customer_id: value || null,
                              location_id: null,
                              is_manually_mapped: true
                            });
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select customer..." />
                          </SelectTrigger>
                          <SelectContent>
                            {customers?.map(customer => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping.location_id || ""}
                          onValueChange={(value) => {
                            updateMappingMutation.mutate({
                              id: mapping.id,
                              customer_id: mapping.customer_id,
                              location_id: value || null,
                              is_manually_mapped: true
                            });
                          }}
                          disabled={!mapping.customer_id}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select location..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getLocationsForCustomer(mapping.customer_id).map(location => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {mapping.match_status === 'matched' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Check className="h-4 w-4 text-green-500" />
                                </TooltipTrigger>
                                <TooltipContent>Mapped</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {(mapping.customer_id || mapping.location_id) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
