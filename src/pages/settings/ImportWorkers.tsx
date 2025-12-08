import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, RefreshCw, Check, X, Bot, Hand, Plus } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface WorkerMapping {
  id: string;
  airtable_technician_name: string;
  worker_type: string | null;
  profile_id: string | null;
  contact_id: string | null;
  supplier_id: string | null;
  match_status: string;
  match_confidence: number | null;
  is_manually_mapped: boolean;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  supplier_id: string | null;
  is_assignable_worker: boolean | null;
  suppliers?: { name: string } | null;
}

interface Supplier {
  id: string;
  name: string;
}

export default function ImportWorkers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<WorkerMapping | null>(null);
  const [newContact, setNewContact] = useState({
    first_name: '',
    last_name: '',
    supplier_id: '',
    worker_state: ''
  });

  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['worker-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('airtable_worker_mapping')
        .select('*')
        .order('airtable_technician_name', { ascending: true });
      
      if (error) throw error;
      return data as WorkerMapping[];
    }
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .order('first_name');
      
      if (error) throw error;
      return data as Profile[];
    }
  });

  const { data: subcontractorContacts } = useQuery({
    queryKey: ['subcontractor-contacts-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, supplier_id, is_assignable_worker, suppliers(name)')
        .eq('is_assignable_worker', true)
        .order('first_name');
      
      if (error) throw error;
      return data as Contact[];
    }
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data as Supplier[];
    }
  });

  const updateMappingMutation = useMutation({
    mutationFn: async ({ 
      id, 
      worker_type,
      profile_id, 
      contact_id, 
      supplier_id,
      is_manually_mapped 
    }: { 
      id: string;
      worker_type: string;
      profile_id: string | null; 
      contact_id: string | null;
      supplier_id: string | null;
      is_manually_mapped: boolean;
    }) => {
      const match_status = profile_id || contact_id ? 'matched' : 'pending';
      const { error } = await supabase
        .from('airtable_worker_mapping')
        .update({ 
          worker_type,
          profile_id, 
          contact_id,
          supplier_id,
          match_status,
          is_manually_mapped,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['import-worker-stats'] });
    }
  });

  const clearMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('airtable_worker_mapping')
        .update({ 
          worker_type: null,
          profile_id: null, 
          contact_id: null,
          supplier_id: null,
          match_status: 'pending',
          match_confidence: null,
          is_manually_mapped: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['import-worker-stats'] });
      toast.success("Match cleared");
    }
  });

  const createContactMutation = useMutation({
    mutationFn: async ({ mappingId, contact }: { mappingId: string; contact: typeof newContact }) => {
      const { data: profile } = await supabase.auth.getUser();
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', profile.user?.id)
        .single();

      if (!userProfile?.tenant_id) throw new Error("No tenant");

      // Create the contact
      const { data: newContactData, error: contactError } = await supabase
        .from('contacts')
        .insert({
          tenant_id: userProfile.tenant_id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          supplier_id: contact.supplier_id,
          worker_state: contact.worker_state || null,
          is_assignable_worker: true,
          contact_type: 'supplier',
          status: 'active'
        })
        .select()
        .single();

      if (contactError) throw contactError;

      // Update the mapping
      const { error: mappingError } = await supabase
        .from('airtable_worker_mapping')
        .update({
          worker_type: 'subcontractor',
          contact_id: newContactData.id,
          supplier_id: contact.supplier_id,
          match_status: 'created',
          is_manually_mapped: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', mappingId);

      if (mappingError) throw mappingError;

      return newContactData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['import-worker-stats'] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor-contacts-for-import'] });
      setCreateDialogOpen(false);
      setSelectedMapping(null);
      setNewContact({ first_name: '', last_name: '', supplier_id: '', worker_state: '' });
      toast.success("Subcontractor contact created and mapped");
    },
    onError: (error) => {
      console.error('Error creating contact:', error);
      toast.error("Failed to create contact");
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

          // Extract unique technician names
          const uniqueWorkers = new Set<string>();
          results.data.forEach((row: any) => {
            const technician = row['Technician']?.trim();
            if (technician) {
              uniqueWorkers.add(technician);
            }
          });

          // Insert or update mappings
          for (const technicianName of uniqueWorkers) {
            const { error } = await supabase
              .from('airtable_worker_mapping')
              .upsert({
                tenant_id: userProfile.tenant_id,
                airtable_technician_name: technicianName,
                match_status: 'pending'
              }, { onConflict: 'tenant_id,airtable_technician_name' });
            
            if (error) {
              console.error('Error inserting worker mapping:', error);
            }
          }

          toast.success(`Uploaded ${uniqueWorkers.size} unique technician names`);
          queryClient.invalidateQueries({ queryKey: ['worker-mappings'] });
          queryClient.invalidateQueries({ queryKey: ['import-worker-stats'] });
        } catch (error) {
          console.error('Upload error:', error);
          toast.error("Failed to upload workers");
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
    if (!mappings || !profiles || !subcontractorContacts) return;

    setIsAutoMatching(true);

    const unmatchedMappings = mappings.filter(m => !m.is_manually_mapped && m.match_status === 'pending');
    
    // Create searchable arrays
    const profilesWithName = profiles.map(p => ({
      ...p,
      fullName: `${p.first_name || ''} ${p.last_name || ''}`.trim()
    }));

    const contactsWithName = subcontractorContacts.map(c => ({
      ...c,
      fullName: `${c.first_name} ${c.last_name}`.trim()
    }));

    const profileFuse = new Fuse(profilesWithName, {
      keys: ['fullName'],
      threshold: 0.3,
      includeScore: true
    });

    const contactFuse = new Fuse(contactsWithName, {
      keys: ['fullName'],
      threshold: 0.3,
      includeScore: true
    });

    let matchedCount = 0;

    for (const mapping of unmatchedMappings) {
      const searchTerm = mapping.airtable_technician_name;
      if (!searchTerm) continue;

      // Try profiles first
      const profileResults = profileFuse.search(searchTerm);
      
      if (profileResults.length > 0 && profileResults[0].score !== undefined) {
        const bestMatch = profileResults[0];
        const confidence = Math.round((1 - bestMatch.score) * 100);
        
        if (confidence >= 70) {
          const { error } = await supabase
            .from('airtable_worker_mapping')
            .update({
              worker_type: 'internal',
              profile_id: bestMatch.item.id,
              contact_id: null,
              supplier_id: null,
              match_status: 'matched',
              match_confidence: confidence,
              updated_at: new Date().toISOString()
            })
            .eq('id', mapping.id);

          if (!error) {
            matchedCount++;
            continue;
          }
        }
      }

      // Try subcontractor contacts
      const contactResults = contactFuse.search(searchTerm);
      
      if (contactResults.length > 0 && contactResults[0].score !== undefined) {
        const bestMatch = contactResults[0];
        const confidence = Math.round((1 - bestMatch.score) * 100);
        
        if (confidence >= 70) {
          const { error } = await supabase
            .from('airtable_worker_mapping')
            .update({
              worker_type: 'subcontractor',
              profile_id: null,
              contact_id: bestMatch.item.id,
              supplier_id: bestMatch.item.supplier_id,
              match_status: 'matched',
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

    toast.success(`Auto-matched ${matchedCount} workers, ${unmatchedMappings.length - matchedCount} still pending`);
    queryClient.invalidateQueries({ queryKey: ['worker-mappings'] });
    queryClient.invalidateQueries({ queryKey: ['import-worker-stats'] });
    setIsAutoMatching(false);
  }, [mappings, profiles, subcontractorContacts, queryClient]);

  const openCreateDialog = (mapping: WorkerMapping) => {
    const nameParts = mapping.airtable_technician_name.split(' ');
    setNewContact({
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
      supplier_id: '',
      worker_state: ''
    });
    setSelectedMapping(mapping);
    setCreateDialogOpen(true);
  };

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

  const getMatchDisplay = (mapping: WorkerMapping) => {
    if (mapping.worker_type === 'internal' && mapping.profile_id) {
      const profile = profiles?.find(p => p.id === mapping.profile_id);
      return profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown';
    }
    if (mapping.worker_type === 'subcontractor' && mapping.contact_id) {
      const contact = subcontractorContacts?.find(c => c.id === mapping.contact_id);
      if (contact) {
        const supplierName = contact.suppliers?.name || suppliers?.find(s => s.id === contact.supplier_id)?.name;
        return `${contact.first_name} ${contact.last_name}${supplierName ? ` (${supplierName})` : ''}`;
      }
      return 'Unknown';
    }
    return '-';
  };

  const stats = {
    total: mappings?.length || 0,
    matched: mappings?.filter(m => m.match_status === 'matched' || m.match_status === 'manual' || m.match_status === 'created').length || 0,
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
          <h1 className="text-3xl font-bold">Worker Mapping</h1>
          <p className="text-muted-foreground">Map technician names to internal workers or subcontractors</p>
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
          <CardTitle>Worker Mappings</CardTitle>
          <CardDescription>
            Match each technician to an internal worker or subcontractor contact. You can create new subcontractor contacts if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !mappings?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Upload a CSV file to begin mapping workers
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[40px]">Type</TableHead>
                    <TableHead>Technician Name</TableHead>
                    <TableHead>Match Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Matched To</TableHead>
                    <TableHead className="w-[300px]">Actions</TableHead>
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
                      <TableCell className="font-medium">{mapping.airtable_technician_name}</TableCell>
                      <TableCell>
                        {mapping.worker_type === 'internal' && <Badge variant="outline">Internal</Badge>}
                        {mapping.worker_type === 'subcontractor' && <Badge variant="secondary">Subcontractor</Badge>}
                        {!mapping.worker_type && <Badge variant="destructive">Unmatched</Badge>}
                      </TableCell>
                      <TableCell>{getConfidenceBadge(mapping.match_confidence)}</TableCell>
                      <TableCell>{getMatchDisplay(mapping)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          <Select
                            value={mapping.worker_type === 'internal' && mapping.profile_id ? `profile:${mapping.profile_id}` : ''}
                            onValueChange={(value) => {
                              const profileId = value.replace('profile:', '');
                              updateMappingMutation.mutate({
                                id: mapping.id,
                                worker_type: 'internal',
                                profile_id: profileId,
                                contact_id: null,
                                supplier_id: null,
                                is_manually_mapped: true
                              });
                            }}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Internal..." />
                            </SelectTrigger>
                            <SelectContent>
                              {profiles?.map(profile => (
                                <SelectItem key={profile.id} value={`profile:${profile.id}`}>
                                  {profile.first_name} {profile.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={mapping.worker_type === 'subcontractor' && mapping.contact_id ? `contact:${mapping.contact_id}` : ''}
                            onValueChange={(value) => {
                              const contactId = value.replace('contact:', '');
                              const contact = subcontractorContacts?.find(c => c.id === contactId);
                              updateMappingMutation.mutate({
                                id: mapping.id,
                                worker_type: 'subcontractor',
                                profile_id: null,
                                contact_id: contactId,
                                supplier_id: contact?.supplier_id || null,
                                is_manually_mapped: true
                              });
                            }}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Subcontractor..." />
                            </SelectTrigger>
                            <SelectContent>
                              {subcontractorContacts?.map(contact => (
                                <SelectItem key={contact.id} value={`contact:${contact.id}`}>
                                  {contact.first_name} {contact.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openCreateDialog(mapping)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>

                          {(mapping.profile_id || mapping.contact_id) && (
                            <>
                              <Check className="h-4 w-4 text-green-500" />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => clearMappingMutation.mutate(mapping.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Subcontractor Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select
                value={newContact.supplier_id}
                onValueChange={(value) => setNewContact(prev => ({ ...prev, supplier_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={newContact.first_name}
                  onChange={(e) => setNewContact(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={newContact.last_name}
                  onChange={(e) => setNewContact(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Worker State</Label>
              <Select
                value={newContact.worker_state}
                onValueChange={(value) => setNewContact(prev => ({ ...prev, worker_state: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIC">VIC</SelectItem>
                  <SelectItem value="NSW">NSW</SelectItem>
                  <SelectItem value="QLD">QLD</SelectItem>
                  <SelectItem value="SA">SA</SelectItem>
                  <SelectItem value="WA">WA</SelectItem>
                  <SelectItem value="TAS">TAS</SelectItem>
                  <SelectItem value="NT">NT</SelectItem>
                  <SelectItem value="ACT">ACT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedMapping) return;
                if (!newContact.supplier_id || !newContact.first_name || !newContact.last_name) {
                  toast.error("Please fill in all required fields");
                  return;
                }
                createContactMutation.mutate({
                  mappingId: selectedMapping.id,
                  contact: newContact
                });
              }}
              disabled={createContactMutation.isPending}
            >
              {createContactMutation.isPending ? 'Creating...' : 'Create & Map'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
