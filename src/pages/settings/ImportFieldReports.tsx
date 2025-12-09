import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Play, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportRow {
  date_of_service: string;
  time_of_arrival: string;
  technician: string;
  notes: string;
  internal_note: string;
  incident: boolean;
  problem_areas: boolean;
  problem_description: string;
  carpet_condition: number | null;
  hardfloor_condition: number | null;
  swms: boolean;
  test_tag: boolean;
  equipment_good: boolean;
  furniture_qty: number | null;
  flooring_sqm: number | null;
  location_auto_id: string;
  wo_number: string;
  pdf_url: string;
  airtable_id: string;
}

interface ImportResult {
  success: boolean;
  report_number?: string;
  report_id?: string;
  error?: string;
  row_index: number;
  pdf_status?: 'uploaded' | 'failed' | 'no_url' | 'pending';
}

export default function ImportFieldReports() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0, phase: '' });

  // Download PDF from Airtable URL and upload to Supabase storage
  const downloadAndUploadPdf = async (
    airtableUrl: string,
    tenantId: string,
    reportId: string
  ): Promise<string | null> => {
    try {
      // Download from Airtable URL
      const response = await fetch(airtableUrl);
      if (!response.ok) {
        console.warn(`Failed to download PDF: ${response.status}`);
        return null;
      }

      const blob = await response.blob();
      
      // Verify it's a PDF
      if (!blob.type.includes('pdf') && !airtableUrl.toLowerCase().includes('.pdf')) {
        console.warn('Downloaded file is not a PDF');
        return null;
      }

      const filename = `legacy/${tenantId}/${reportId}.pdf`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('field-report-photos')
        .upload(filename, blob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (error) {
        console.error('PDF upload error:', error);
        return null;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('field-report-photos')
        .getPublicUrl(filename);

      return publicUrl;
    } catch (error) {
      console.error('PDF download/upload failed:', error);
      return null;
    }
  };

  const { data: locationMappings } = useQuery({
    queryKey: ['location-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('airtable_location_mapping')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: workerMappings } = useQuery({
    queryKey: ['worker-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('airtable_worker_mapping')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  const locationStats = {
    total: locationMappings?.length || 0,
    mapped: locationMappings?.filter(m => m.match_status === 'matched' || m.match_status === 'manual').length || 0
  };

  const workerStats = {
    total: workerMappings?.length || 0,
    mapped: workerMappings?.filter(m => m.match_status === 'matched' || m.match_status === 'manual' || m.match_status === 'created').length || 0
  };

  const canImport = locationStats.total > 0 && locationStats.mapped === locationStats.total &&
    workerStats.total > 0 && workerStats.mapped === workerStats.total;

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const rows: ImportRow[] = results.data.map((row: any) => ({
          date_of_service: row['Date of service'] || '',
          time_of_arrival: row['Time of arrival'] || '',
          technician: row['Technician'] || '',
          notes: row['Notes/Comments'] || '',
          internal_note: row['Internal Note'] || '',
          incident: row['Incident or Near Miss?']?.toLowerCase() === 'yes',
          problem_areas: row['Areas couldnt get clean']?.toLowerCase() === 'yes',
          problem_description: row['Describe problem areas'] || '',
          carpet_condition: parseInt(row['Condition CPT ARRIVAL']) || null,
          hardfloor_condition: parseInt(row['Condition HRDFL ARRIVAL']) || null,
          swms: row['SWMS']?.toLowerCase() === 'yes',
          test_tag: row['Test and tag']?.toLowerCase() === 'yes',
          equipment_good: row['Equipment good order']?.toLowerCase() === 'yes',
          furniture_qty: parseInt(row['Furniture qty']) || null,
          flooring_sqm: parseFloat(row['Flooring m2']) || null,
          location_auto_id: row['autonumber (from Locations)'] || row['Auto ID'] || '',
          wo_number: row['WO or Appt Number'] || '',
          pdf_url: row['Report'] || '',
          airtable_id: row['Record ID'] || row['id'] || `row-${Math.random().toString(36).substr(2, 9)}`
        })).filter((row: ImportRow) => row.date_of_service);

        setParsedData(rows);
        toast.success(`Parsed ${rows.length} field reports ready for import`);
      },
      error: (error) => {
        console.error('Parse error:', error);
        toast.error("Failed to parse CSV");
      }
    });

    event.target.value = '';
  }, []);

  const getNextReportNumber = async (tenantId: string): Promise<string> => {
    const { data } = await supabase
      .from('field_reports')
      .select('report_number')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (data && data.length > 0) {
      const match = data[0].report_number?.match(/FR-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    return `FR-${String(nextNum).padStart(4, '0')}-L`;
  };

  const runImport = async () => {
    if (!canImport || parsedData.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportResults([]);

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

      const results: ImportResult[] = [];
      const batchSize = 50;

      for (let i = 0; i < parsedData.length; i++) {
        if (isPaused) {
          toast.info("Import paused");
          break;
        }

        const row = parsedData[i];
        
        try {
          // Find location mapping
          const locationMapping = locationMappings?.find(
            m => m.airtable_auto_id === row.location_auto_id
          );

          if (!locationMapping?.customer_id || !locationMapping?.location_id) {
            results.push({
              success: false,
              error: 'Location not mapped',
              row_index: i
            });
            continue;
          }

          // Find worker mapping
          const workerMapping = workerMappings?.find(
            m => m.airtable_technician_name === row.technician
          );

          if (!workerMapping?.profile_id && !workerMapping?.contact_id) {
            results.push({
              success: false,
              error: 'Worker not mapped',
              row_index: i
            });
            continue;
          }

          // Check for existing import
          const { data: existing } = await supabase
            .from('field_reports')
            .select('id')
            .eq('airtable_record_id', row.airtable_id)
            .single();

          if (existing) {
            results.push({
              success: false,
              error: 'Already imported',
              row_index: i
            });
            continue;
          }

          // Get next report number
          const reportNumber = await getNextReportNumber(userProfile.tenant_id);

          // Parse date
          let serviceDate = null;
          if (row.date_of_service) {
            const parts = row.date_of_service.split('/');
            if (parts.length === 3) {
              serviceDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }

          // Create field report
          const { data: insertedReport, error: insertError } = await supabase
            .from('field_reports')
            .insert({
              tenant_id: userProfile.tenant_id,
              report_number: reportNumber,
              customer_id: locationMapping.customer_id,
              location_id: locationMapping.location_id,
              worker_name: row.technician || 'Unknown',
              service_date: serviceDate || new Date().toISOString().split('T')[0],
              arrival_time: row.time_of_arrival || '08:00',
              work_description: row.notes || 'Legacy import - no description provided',
              internal_notes: row.internal_note || null,
              had_incident: row.incident,
              had_problem_areas: row.problem_areas,
              problem_areas_description: row.problem_description || null,
              carpet_condition_rating: row.carpet_condition,
              hardfloor_condition_rating: row.hardfloor_condition,
              swms_completed: row.swms,
              test_tag_completed: row.test_tag,
              equipment_good_order: row.equipment_good,
              furniture_quantity: row.furniture_qty,
              flooring_sqm: row.flooring_sqm,
              service_order_number_reference: row.wo_number || null,
              legacy_pdf_url: row.pdf_url || null,
              airtable_record_id: row.airtable_id,
              is_legacy_import: true,
              status: 'approved',
              approved_at: new Date().toISOString(),
              created_by: profile.user?.id || ''
            })
            .select('id')
            .single();

          if (insertError) {
            results.push({
              success: false,
              error: insertError.message,
              row_index: i
            });
          } else {
            results.push({
              success: true,
              report_number: reportNumber,
              report_id: insertedReport?.id,
              row_index: i,
              pdf_status: row.pdf_url ? 'pending' : 'no_url'
            });
          }
        } catch (error: any) {
          results.push({
            success: false,
            error: error.message || 'Unknown error',
            row_index: i
          });
        }

        setImportProgress(Math.round(((i + 1) / parsedData.length) * 100));
        setImportResults([...results]);

        // Small delay every batch to avoid overwhelming
        if ((i + 1) % batchSize === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      toast.success(`Import complete: ${successCount} succeeded, ${failCount} failed`);
      
      // Phase 2: Download and upload PDFs for successful imports
      const reportsWithPdfs = results.filter(r => r.success && r.report_id && r.pdf_status === 'pending');
      
      if (reportsWithPdfs.length > 0) {
        setPdfProgress({ current: 0, total: reportsWithPdfs.length, phase: 'Downloading PDFs...' });
        
        let pdfSuccessCount = 0;
        let pdfFailCount = 0;
        
        for (let i = 0; i < reportsWithPdfs.length; i++) {
          const result = reportsWithPdfs[i];
          const row = parsedData[result.row_index];
          
          if (row.pdf_url && result.report_id) {
            const publicUrl = await downloadAndUploadPdf(
              row.pdf_url,
              userProfile.tenant_id,
              result.report_id
            );
            
            if (publicUrl) {
              // Update the field report with the new PDF URL
              await supabase
                .from('field_reports')
                .update({ pdf_url: publicUrl })
                .eq('id', result.report_id);
              
              result.pdf_status = 'uploaded';
              pdfSuccessCount++;
            } else {
              result.pdf_status = 'failed';
              pdfFailCount++;
            }
          }
          
          setPdfProgress({ 
            current: i + 1, 
            total: reportsWithPdfs.length, 
            phase: `Uploading PDFs... (${i + 1}/${reportsWithPdfs.length})` 
          });
          setImportResults([...results]);
          
          // Small delay between PDF downloads
          if ((i + 1) % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        toast.success(`PDF migration: ${pdfSuccessCount} uploaded, ${pdfFailCount} failed`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['field-reports'] });
    } catch (error) {
      console.error('Import error:', error);
      toast.error("Import failed");
    } finally {
      setIsImporting(false);
      setIsPaused(false);
    }
  };

  const successCount = importResults.filter(r => r.success).length;
  const failCount = importResults.filter(r => !r.success).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings/import')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Field Report Import</h1>
          <p className="text-muted-foreground">Import historical field reports with PDFs</p>
        </div>
      </div>

      {/* Prerequisites Check */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={locationStats.mapped === locationStats.total && locationStats.total > 0 ? 'border-green-500' : 'border-destructive'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {locationStats.mapped === locationStats.total && locationStats.total > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              Location Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{locationStats.mapped}/{locationStats.total}</p>
            <p className="text-sm text-muted-foreground">locations mapped</p>
          </CardContent>
        </Card>

        <Card className={workerStats.mapped === workerStats.total && workerStats.total > 0 ? 'border-green-500' : 'border-destructive'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {workerStats.mapped === workerStats.total && workerStats.total > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              Worker Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{workerStats.mapped}/{workerStats.total}</p>
            <p className="text-sm text-muted-foreground">workers mapped</p>
          </CardContent>
        </Card>
      </div>

      {!canImport && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Prerequisites Not Met</AlertTitle>
          <AlertDescription>
            Complete location and worker mapping before importing field reports.
          </AlertDescription>
        </Alert>
      )}

      {/* Upload & Import */}
      <Card>
        <CardHeader>
          <CardTitle>Import Field Reports</CardTitle>
          <CardDescription>
            Upload the Airtable field reports CSV and import records into the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={!canImport || isImporting}
              />
              <Button variant="outline" disabled={!canImport || isImporting}>
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
            </div>

            {parsedData.length > 0 && (
              <Button 
                onClick={runImport} 
                disabled={!canImport || isImporting}
              >
                <Play className="h-4 w-4 mr-2" />
                {isImporting ? 'Importing...' : `Import ${parsedData.length} Reports`}
              </Button>
            )}

            {isImporting && (
              <Button 
                variant="outline"
                onClick={() => setIsPaused(true)}
              >
                Pause
              </Button>
            )}
          </div>

          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Ready to import</span>
                <Badge variant="secondary">
                  <FileText className="h-3 w-3 mr-1" />
                  {parsedData.length} reports
                </Badge>
              </div>
            </div>
          )}

          {isImporting && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {pdfProgress.phase || 'Importing records...'}
                  </span>
                  <span className="text-sm text-muted-foreground">{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">✓ {successCount} succeeded</span>
                  <span className="text-destructive">✗ {failCount} failed</span>
                </div>
              </div>
              
              {pdfProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">PDF Migration</span>
                    <span className="text-sm text-muted-foreground">
                      {pdfProgress.current}/{pdfProgress.total}
                    </span>
                  </div>
                  <Progress 
                    value={(pdfProgress.current / pdfProgress.total) * 100} 
                    className="h-2" 
                  />
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600">
                      ✓ {importResults.filter(r => r.pdf_status === 'uploaded').length} PDFs uploaded
                    </span>
                    <span className="text-destructive">
                      ✗ {importResults.filter(r => r.pdf_status === 'failed').length} PDFs failed
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {importResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
            <CardDescription>
              {successCount} succeeded, {failCount} failed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Report Number</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResults.filter(r => !r.success).slice(0, 100).map((result, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{result.row_index + 1}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">Failed</Badge>
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{result.error}</TableCell>
                    </TableRow>
                  ))}
                  {importResults.filter(r => r.success && r.pdf_status === 'failed').slice(0, 100).map((result, idx) => (
                    <TableRow key={`pdf-${idx}`}>
                      <TableCell>{result.row_index + 1}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Imported</Badge>
                      </TableCell>
                      <TableCell>{result.report_number}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">PDF Failed</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">PDF download/upload failed</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
