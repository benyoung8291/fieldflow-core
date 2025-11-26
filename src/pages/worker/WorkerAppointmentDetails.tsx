import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  MessageSquare,
  Navigation,
  Camera,
  FileSignature,
  Play,
  Square,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import PhotoCapture from '@/components/worker/PhotoCapture';
import QuickPhotoCapture from '@/components/worker/QuickPhotoCapture';
import SignaturePad from '@/components/worker/SignaturePad';
import { LocationPermissionHelp } from '@/components/worker/LocationPermissionHelp';
import { cacheAppointments } from '@/lib/offlineSync';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { queueTimeEntry } from '@/lib/offlineSync';
import WorkerTimeLogsView from '@/components/worker/WorkerTimeLogsView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import FieldReportsList from '@/components/field-reports/FieldReportsList';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/worker/PullToRefreshIndicator';

export default function WorkerAppointmentDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isOnline } = useOfflineSync();
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [showQuickPhotoCapture, setShowQuickPhotoCapture] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [timeLog, setTimeLog] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [workNotes, setWorkNotes] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isPaused, setIsPaused] = useState(false);

  const { containerRef, isRefreshing: isPulling, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadAppointmentData();
      await refetchFieldReports();
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: fieldReports = [], refetch: refetchFieldReports } = useQuery({
    queryKey: ['field-reports', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_reports')
        .select('id, status, created_by, approved_at, pdf_url, created_at, submitted_at, report_number')
        .eq('appointment_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    loadAppointmentData();
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [id]);

  const loadAppointmentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to load from cache first if offline
      if (!isOnline) {
        console.log('[Offline] Loading from cache...');
        const { getCachedAppointments, getCachedTimeLog } = await import('@/lib/offlineSync');
        const cached = await getCachedAppointments();
        const cachedApt = cached.find((apt: any) => apt.id === id);
        
        if (cachedApt) {
          setAppointment(cachedApt);
          
          // Load cached active time log
          const cachedLog = await getCachedTimeLog(id!, user.id);
          
          if (cachedLog) {
            setTimeLog({
              id: cachedLog.timeLogId || cachedLog.id,
              clock_in: cachedLog.timestamp,
              notes: cachedLog.notes,
              worker_id: cachedLog.workerId,
              tenant_id: cachedLog.tenantId,
            });
          }
          
          setLoading(false);
          return;
        } else {
          toast.error('Appointment not available offline. Please connect to internet.');
          setLoading(false);
          return;
        }
      }

      // Load appointment with only essential fields first
      const { data: aptData, error: aptError } = await supabase
        .from('appointments')
        .select(`
          id,
          title,
          description,
          start_time,
          end_time,
          status,
          location_address,
          location_lat,
          location_lng,
          gps_check_in_radius,
          check_in_time,
          check_out_time,
          notes,
          service_order_id
        `)
        .eq('id', id)
        .single();

      if (aptError || !aptData) {
        console.error('Error loading appointment:', aptError);
        toast.error('Failed to load appointment');
        setLoading(false);
        return;
      }

      // Load related data in parallel for speed
      const [serviceOrderData, workersData] = await Promise.all([
        aptData.service_order_id
          ? supabase
              .from('service_orders')
              .select(`
                id,
                work_order_number,
                description,
                worker_can_contact_customer,
                customer:customers(name, phone, email, address, city, state, postcode),
                line_items:service_order_line_items(id, description, quantity, estimated_hours)
              `)
              .eq('id', aptData.service_order_id)
              .single()
          : Promise.resolve({ data: null }),
        supabase
          .from('appointment_workers')
          .select(`
            id,
            worker:workers(id, first_name, last_name, phone)
          `)
          .eq('appointment_id', id)
      ]);

      // Merge all data into single appointment object
      const fullAptData = {
        ...aptData,
        service_order: serviceOrderData.data,
        appointment_workers: workersData.data || []
      };
      
      // Single state update with complete data
      setAppointment(fullAptData as any);
      
      // Cache for offline access
      await cacheAppointments([fullAptData]);

      // Get worker data and load time log + attachments in parallel
      const { data: worker } = await supabase
        .from('workers')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!worker) {
        setLoading(false);
        return;
      }

      // Load time log and attachments in parallel
      const [logResult, filesResult] = await Promise.all([
        supabase
          .from('time_logs')
          .select('*')
          .eq('appointment_id', id)
          .eq('worker_id', worker.id)
          .is('clock_out', null)
          .maybeSingle(),
        supabase
          .from('appointment_attachments')
          .select('*')
          .eq('appointment_id', id)
          .order('uploaded_at', { ascending: false })
      ]);

      setTimeLog(logResult.data);
      setAttachments(filesResult.data || []);
      
      // Cache time log if exists
      if (logResult.data) {
        const { cacheActiveTimeLogs } = await import('@/lib/offlineSync');
        await cacheActiveTimeLogs(id!, logResult.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load appointment');
    } finally {
      setLoading(false);
    }
  };

  const getLocationWithPermission = async (): Promise<GeolocationPosition> => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      throw new Error('GEOLOCATION_NOT_SUPPORTED');
    }

    // Check current permission state if Permissions API is available
    if ('permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        
        if (permission.state === 'denied') {
          throw new Error('PERMISSION_DENIED');
        }
      } catch (permError) {
        console.warn('Permissions API not fully supported:', permError);
      }
    }

    // Get the location - browser will prompt for permission if needed
    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  };

  const handleClockIn = async () => {
    setProcessing(true);
    try {
      console.log('[Clock In] Starting clock-in process...', { isOnline });
      
      // Show loading toast while getting location
      const loadingToast = toast.loading('Getting your location...');

      // Try to get location, but allow clock-in even if it fails
      let position: GeolocationPosition | null = null;
      let locationDenied = false;
      
      try {
        position = await getLocationWithPermission();
        console.log('[Clock In] Location obtained:', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      } catch (locationError: any) {
        console.warn('[Clock In] Location access failed:', locationError);
        locationDenied = true;
        toast.warning('Location access denied - clocking in without GPS', {
          description: 'Your supervisor will be notified that location was not available',
          duration: 4000,
        });
      }

      toast.dismiss(loadingToast);

      console.log('[Clock In] Getting user data...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[Clock In] User not authenticated');
        throw new Error('Not authenticated');
      }

      console.log('[Clock In] Getting worker data for user:', user.id);
      const { data: worker, error: workerError } = await supabase
        .from('workers')
        .select('id, tenant_id, pay_rate_category:pay_rate_categories(hourly_rate)')
        .eq('id', user.id)
        .single();

      if (workerError) {
        console.error('[Clock In] Worker query error:', workerError);
        throw workerError;
      }

      if (!worker) {
        console.error('[Clock In] Worker not found for user:', user.id);
        throw new Error('Worker profile not found. Please contact support.');
      }

      console.log('[Clock In] Worker found:', { workerId: worker.id, tenantId: worker.tenant_id });

      // Auto clock-out from other appointments
      console.log('[Clock In] Checking for other active appointments...');
      const { error: clockOutError } = await supabase.rpc('auto_clock_out_other_appointments', {
        p_worker_id: worker.id,
        p_new_appointment_id: id,
        p_tenant_id: worker.tenant_id,
      });

      if (clockOutError) {
        console.warn('[Clock In] Auto clock-out warning:', clockOutError);
        // Don't fail the clock-in if auto clock-out fails
      }

      const hourlyRate = (worker.pay_rate_category as any)?.hourly_rate || 0;
      const timestamp = new Date().toISOString();
      
      // Build notes based on location availability
      let notes = '';
      if (locationDenied) {
        notes = '⚠️ LOCATION PERMISSIONS DENIED - Worker clocked in without GPS verification';
      } else if (position) {
        notes = `Clocked in at GPS: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
      } else {
        notes = '⚠️ LOCATION NOT AVAILABLE - Worker clocked in without GPS verification';
      }

      // If offline, queue the action
      if (!isOnline) {
        console.log('[Clock In] Offline - queueing action');
        await queueTimeEntry({
          appointmentId: id!,
          workerId: worker.id,
          tenantId: worker.tenant_id,
          action: 'clock_in',
          timestamp,
          location: position ? {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          } : null,
          hourlyRate,
          notes,
        });

        toast.success('Clocked in offline - will sync when online', {
          description: 'Your clock-in has been saved and will sync automatically',
          duration: 5000,
        });
        
        // Update local state
        setTimeLog({
          clock_in: timestamp,
          notes,
          worker_id: worker.id,
          tenant_id: worker.tenant_id,
        });
        
        if (appointment) {
          setAppointment({ ...appointment, status: 'checked_in' });
        }
        
        setProcessing(false);
        return;
      }

      console.log('[Clock In] Online - inserting directly to database');
      const timeLogData = {
        tenant_id: worker.tenant_id,
        appointment_id: id,
        worker_id: worker.id,
        clock_in: timestamp,
        hourly_rate: hourlyRate,
        overhead_percentage: 0,
        latitude: position?.coords.latitude || null,
        longitude: position?.coords.longitude || null,
        notes,
      };
      
      console.log('[Clock In] Time log data:', timeLogData);
      
      const { error, data: insertedLog } = await supabase.from('time_logs').insert(timeLogData).select();

      if (error) {
        console.error('[Clock In] Time log insert error:', error);
        throw error;
      }

      console.log('[Clock In] Time log inserted successfully:', insertedLog);

      console.log('[Clock In] Updating appointment status...');
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'checked_in' })
        .eq('id', id);

      if (updateError) {
        console.error('[Clock In] Appointment update error:', updateError);
        throw updateError;
      }

      // Update local state immediately for instant UI feedback
      setTimeLog(insertedLog[0]);
      if (appointment) {
        setAppointment({ ...appointment, status: 'checked_in' });
      }

      console.log('[Clock In] Clock-in completed successfully!');
      toast.success(`Clocked in successfully at your location!`);
    } catch (error: any) {
      console.error('[Clock In] Error caught:', error);
      
      // Handle custom error messages
      if (error.message === 'GEOLOCATION_NOT_SUPPORTED') {
        toast.error('Geolocation is not supported by your browser');
      } else if (error.message === 'PERMISSION_DENIED' || error.code === 1) {
        toast.error('📍 Location access blocked! Tap "Location Help" button above for instructions to enable it.', {
          duration: 10000,
        });
      } else if (error.code === 2) {
        toast.error('Unable to determine your location. Please check that location services are enabled on your device.', {
          duration: 8000,
        });
      } else if (error.code === 3) {
        toast.error('Location request timed out. Please try again in a moment.', {
          duration: 6000,
        });
      } else if (error.message?.includes('Worker profile not found')) {
        toast.error('Worker profile not found. Please contact support.');
      } else if (error.message?.includes('Not authenticated')) {
        toast.error('Session expired. Please log in again.');
        navigate('/worker/auth');
      } else {
        // Database or other errors
        const errorMessage = error.message || error.hint || 'Unknown error';
        toast.error(`Failed to clock in: ${errorMessage}`, {
          duration: 6000,
        });
        console.error('[Clock In] Full error details:', JSON.stringify(error, null, 2));
      }
    } finally {
      // Always reset processing state
      setProcessing(false);
    }
  };

  const handleClockOut = async () => {
    if (!timeLog) return;

    setProcessing(true);
    try {
      console.log('[Clock Out] Starting clock-out process...', { isOnline });

      const loadingToast = toast.loading('Getting your location...');

      // Try to get location, but allow clock-out even if it fails
      let position: GeolocationPosition | null = null;
      let locationDenied = false;
      
      try {
        position = await getLocationWithPermission();
        console.log('[Clock Out] Location obtained:', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      } catch (locationError: any) {
        console.warn('[Clock Out] Location access failed:', locationError);
        locationDenied = true;
        toast.warning('Location access denied - clocking out without GPS', {
          description: 'Your supervisor will be notified that location was not available',
          duration: 4000,
        });
      }

      toast.dismiss(loadingToast);

      const timestamp = new Date().toISOString();
      
      // Build notes based on location availability
      let locationNote = '';
      if (locationDenied) {
        locationNote = '⚠️ LOCATION PERMISSIONS DENIED - Worker clocked out without GPS verification';
      } else if (position) {
        locationNote = `Clocked out at GPS: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
      } else {
        locationNote = '⚠️ LOCATION NOT AVAILABLE - Worker clocked out without GPS verification';
      }
      
      const clockOutNotes = `${timeLog.notes || ''}\n${locationNote}${workNotes ? `\nWork Notes: ${workNotes}` : ''}`.trim();

      // If offline, queue the action
      if (!isOnline) {
        console.log('[Clock Out] Offline - queueing action');
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Use data from the cached timeLog instead of querying database
        await queueTimeEntry({
          appointmentId: id!,
          workerId: timeLog.worker_id,
          tenantId: timeLog.tenant_id || appointment?.tenant_id,
          action: 'clock_out',
          timestamp,
          location: position ? {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          } : undefined,
          notes: clockOutNotes,
          timeLogId: timeLog.id,
        });

        toast.success('Clocked out offline - will sync when online', {
          description: 'Your clock-out has been saved and will sync automatically',
          duration: 5000,
        });
        
        // Update local state
        setTimeLog(null);
        setWorkNotes('');
        
        if (appointment) {
          setAppointment({ ...appointment, status: 'completed' });
        }
        
        setProcessing(false);
        return;
      }

      console.log('[Clock Out] Online - updating database directly');
      const { error } = await supabase
        .from('time_logs')
        .update({
          clock_out: timestamp,
          notes: clockOutNotes,
          status: 'completed',
        })
        .eq('id', timeLog.id);

      if (error) throw error;

      // Check if all workers have clocked out
      const { data: remainingLogs } = await supabase
        .from('time_logs')
        .select('id, clock_out')
        .eq('appointment_id', id)
        .is('clock_out', null);

      // Only update appointment status to completed if all workers have clocked out
      if (!remainingLogs || remainingLogs.length === 0) {
        await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', id);
      }

      toast.success('Clocked out successfully!');
      setWorkNotes('');
      loadAppointmentData();
    } catch (error: any) {
      console.error('Clock out error:', error);
      
      const errorMessage = error.message || error.hint || 'Unknown error';
      toast.error(`Failed to clock out: ${errorMessage}`, {
        duration: 6000,
      });
    } finally {
      setProcessing(false);
    }
  };

  const handlePause = async () => {
    if (!timeLog) return;
    
    setProcessing(true);
    try {
      const timestamp = new Date().toISOString();
      
      // Clock out the current time log (pause)
      const { error } = await supabase
        .from('time_logs')
        .update({
          clock_out: timestamp,
          notes: (timeLog.notes || '') + '\n[Paused]',
          status: 'completed',
        })
        .eq('id', timeLog.id);
      
      if (error) throw error;
      
      toast.success('Timer paused');
      setTimeLog(null);
      setIsPaused(true);
    } catch (error: any) {
      console.error('Pause error:', error);
      toast.error('Failed to pause timer');
    } finally {
      setProcessing(false);
    }
  };

  const handleResume = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: worker } = await supabase
        .from('workers')
        .select('id, tenant_id, pay_rate_category:pay_rate_categories(hourly_rate)')
        .eq('id', user.id)
        .single();

      if (!worker) throw new Error('Worker not found');

      const hourlyRate = (worker.pay_rate_category as any)?.hourly_rate || 0;
      const timestamp = new Date().toISOString();

      // Create a new time log entry (resume)
      const { data: newLog, error } = await supabase
        .from('time_logs')
        .insert({
          tenant_id: worker.tenant_id,
          appointment_id: id,
          worker_id: worker.id,
          clock_in: timestamp,
          hourly_rate: hourlyRate,
          overhead_percentage: 0,
          notes: '[Resumed]',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Timer resumed');
      setTimeLog(newLog);
      setIsPaused(false);
    } catch (error: any) {
      console.error('Resume error:', error);
      toast.error('Failed to resume timer');
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteAppointment = () => {
    setShowSignature(true);
  };

  const handleSaveSignature = async (signatureData: string) => {
    setProcessing(true);
    try {
      // Convert data URL to blob
      const response = await fetch(signatureData);
      const blob = await response.blob();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const fileName = `signature_${Date.now()}.png`;
      const filePath = `${profile?.tenant_id}/${id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('appointment-files')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('appointment-files')
        .getPublicUrl(filePath);

      await supabase.from('appointment_attachments').insert({
        tenant_id: profile?.tenant_id,
        appointment_id: id,
        file_name: fileName,
        file_url: publicUrl,
        file_type: 'image/png',
        category: 'signature',
        notes: 'Customer signature',
        uploaded_by: user.id,
      });

      await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', id);

      toast.success('Job completed successfully!');
      setShowSignature(false);
      loadAppointmentData();
    } catch (error) {
      console.error('Error saving signature:', error);
      toast.error('Failed to save signature');
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickPhotoSave = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/before_photo/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('appointment-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('appointment-attachments')
        .getPublicUrl(fileName);

      await supabase.from('appointment_attachments').insert({
        tenant_id: profile?.tenant_id,
        appointment_id: id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        category: 'before_photo',
        notes: null,
        uploaded_by: user.id,
      });

      await loadAppointmentData();
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  };

  const handleSavePhoto = async (file: File, category: string, notes: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/before_photo/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('appointment-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('appointment-attachments')
        .getPublicUrl(fileName);

      await supabase.from('appointment_attachments').insert({
        tenant_id: profile?.tenant_id,
        appointment_id: id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        category: 'before_photo',
        notes: notes || null,
        uploaded_by: user.id,
      });

      setShowPhotoCapture(false);
      loadAppointmentData();
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  };

  const callCustomer = () => {
    const phone = appointment?.service_order?.customer?.phone;
    if (phone) window.location.href = `tel:${phone}`;
  };

  const smsCustomer = () => {
    const phone = appointment?.service_order?.customer?.phone;
    if (phone) window.location.href = `sms:${phone}`;
  };

  const emailCustomer = () => {
    const email = appointment?.service_order?.customer?.email;
    if (email) window.location.href = `mailto:${email}`;
  };

  const openInMaps = () => {
    const customer = appointment?.service_order?.customer;
    let query = '';
    
    if (appointment?.location_address) {
      query = encodeURIComponent(appointment.location_address);
    } else if (customer?.address) {
      const address = `${customer.address}, ${customer.city}, ${customer.state} ${customer.postcode}`;
      query = encodeURIComponent(address);
    } else {
      return;
    }

    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      window.open(`maps://maps.apple.com/?q=${query}`);
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`);
    }
  };

  const formatDuration = (clockIn: string) => {
    const start = new Date(clockIn);
    const diffMs = currentTime.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading || !appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const customer = appointment.service_order?.customer;
  const isCompleted = appointment.status === 'completed';

  return (
    <div ref={containerRef} className="min-h-screen bg-background pb-20">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isPulling} />
      <header className="bg-gradient-to-br from-primary to-primary-hover text-primary-foreground sticky top-0 z-10 shadow-md">
        <div className="max-w-screen-lg mx-auto px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/worker/dashboard')}
                className="text-primary-foreground hover:bg-primary-foreground/15 h-7 w-7 rounded-lg"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <h1 className="text-base font-semibold">Job Details</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                {isCompleted ? 'Completed' : timeLog ? 'In Progress' : 'Pending'}
              </Badge>
              <LocationPermissionHelp />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {/* Clock In/Out Card */}
        {!isCompleted && (
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-6">
              {timeLog ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Working for</p>
                    <p className="text-4xl font-bold text-primary">
                      {formatDuration(timeLog.clock_in)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Started at {format(new Date(timeLog.clock_in), 'h:mm a')}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Work Notes (Optional)</label>
                    <Textarea
                      value={workNotes}
                      onChange={(e) => setWorkNotes(e.target.value)}
                      placeholder="Add notes about work completed..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/worker/field-report/${id}`)}
                      className="w-full"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Create Field Report
                    </Button>

                    <div className="flex gap-2">
                      <Button
                        onClick={handlePause}
                        disabled={processing}
                        size="lg"
                        variant="outline"
                        className="flex-1"
                      >
                        Pause
                      </Button>
                      <Button
                        onClick={handleClockOut}
                        disabled={processing}
                        size="lg"
                        variant="destructive"
                        className="flex-1"
                      >
                        <Square className="h-5 w-5 mr-2" />
                        Clock Out
                      </Button>
                    </div>
                  </div>
                </div>
              ) : isPaused ? (
                <div className="text-center space-y-4">
                  <div>
                    <Clock className="h-12 w-12 mx-auto text-warning mb-2" />
                    <p className="text-lg font-semibold">Timer Paused</p>
                    <p className="text-sm text-muted-foreground">
                      Resume when you're ready to continue
                    </p>
                  </div>
                  <Button
                    onClick={handleResume}
                    disabled={processing}
                    size="lg"
                    className="w-full"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Resume
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div>
                    <Clock className="h-12 w-12 mx-auto text-primary mb-2" />
                    <p className="text-lg font-semibold">Ready to start?</p>
                    <p className="text-sm text-muted-foreground">
                      Clock in when you arrive at the job site
                    </p>
                  </div>
                  <Button
                    onClick={handleClockIn}
                    disabled={processing}
                    size="lg"
                    className="w-full"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Clock In
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Job Title */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-xl font-bold">{appointment.title}</h2>
            {appointment.description && (
              <p className="text-sm text-muted-foreground mt-2">{appointment.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Schedule Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {format(parseISO(appointment.start_time), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Scheduled Time</p>
                <p className="font-medium">
                  {format(parseISO(appointment.start_time), 'h:mm a')} - {format(parseISO(appointment.end_time), 'h:mm a')}
                </p>
                {appointment.service_order?.line_items && appointment.service_order.line_items.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Est. {appointment.service_order.line_items.reduce((sum: number, item: any) => sum + (item.estimated_hours || 0), 0)}h total
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-medium text-lg">{customer?.name}</p>
            
            {appointment.service_order?.worker_can_contact_customer && (
              <>
                {customer?.phone && (
                  <div className="flex gap-2">
                    <Button onClick={callCustomer} variant="outline" className="flex-1">
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                    <Button onClick={smsCustomer} variant="outline" className="flex-1">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      SMS
                    </Button>
                  </div>
                )}

                {customer?.email && (
                  <Button onClick={emailCustomer} variant="outline" className="w-full">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        {(appointment.location_address || customer?.address) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Job Site
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                {appointment.location_address || (
                  <>
                    {customer.address}
                    <br />
                    {customer.city}, {customer.state} {customer.postcode}
                  </>
                )}
              </p>
              <Button onClick={openInMaps} className="w-full">
                <Navigation className="h-4 w-4 mr-2" />
                Get Directions
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Assigned Workers */}
        {appointment.appointment_workers && appointment.appointment_workers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Assigned Workers ({appointment.appointment_workers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {appointment.appointment_workers.map((aw: any) => (
                <div key={aw.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">
                      {aw.worker?.first_name} {aw.worker?.last_name}
                    </p>
                    {aw.worker?.phone && (
                      <p className="text-xs text-muted-foreground">{aw.worker.phone}</p>
                    )}
                  </div>
                  {aw.worker?.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `tel:${aw.worker.phone}`}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Line Items */}
        {appointment.service_order?.line_items && appointment.service_order.line_items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Work Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {appointment.service_order.line_items.map((item: any) => (
                <div key={item.id} className="flex justify-between items-start p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quantity: {item.quantity}
                    </p>
                  </div>
                  {item.estimated_hours > 0 && (
                    <Badge variant="outline">
                      {item.estimated_hours}h
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Before Photos & Documentation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Before Photos ({attachments.length})
            </CardTitle>
            <Button onClick={() => setShowPhotoCapture(true)} size="sm">
              <Camera className="h-4 w-4 mr-2" />
              Add Before Photo
            </Button>
          </CardHeader>
          <CardContent>
            {attachments.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {attachments.map((file) => (
                  <div key={file.id} className="relative rounded-lg overflow-hidden border">
                    <img
                      src={file.file_url}
                      alt={file.file_name}
                      className="w-full h-32 object-cover"
                      loading="lazy"
                      onError={(e) => {
                        console.error('Image failed to load:', file.file_url);
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="w-full h-32 flex items-center justify-center bg-muted"><p class="text-xs text-muted-foreground">Image unavailable</p></div>';
                        }
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2">
                      <p className="text-xs truncate">{file.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No before photos yet</p>
                <p className="text-xs mt-1">Add photos showing the condition before work starts</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Field Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Field Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => {
                const userReport = fieldReports.find((r: any) => r.created_by === currentUser?.id);
                if (userReport && !userReport.approved_at && !userReport.pdf_url) {
                  navigate(`/worker/field-report/${id}/edit/${userReport.id}`);
                } else {
                  navigate(`/worker/field-report/${id}`);
                }
              }}
              variant="outline"
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              {(() => {
                const userReport = fieldReports.find((r: any) => r.created_by === currentUser?.id);
                if (!userReport) return 'Create Field Report';
                const isLocked = userReport.approved_at && userReport.pdf_url;
                if (userReport.status === 'draft') return 'Finish Field Report';
                if (userReport.status === 'submitted' && !isLocked) return 'Edit Submitted Report';
                return 'View Field Report';
              })()}
            </Button>
            <FieldReportsList appointmentId={id!} onReportStateChange={refetchFieldReports} />
          </CardContent>
        </Card>

        {/* Complete Job */}
        {timeLog && !timeLog.clock_out && !isCompleted && (
          <Button
            onClick={handleCompleteAppointment}
            size="lg"
            className="w-full"
          >
            <FileSignature className="h-5 w-5 mr-2" />
            Complete Job & Get Signature
          </Button>
        )}

        {/* Time Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Your Time Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkerTimeLogsView appointmentId={id!} />
          </CardContent>
        </Card>

        {/* Notes */}
        {appointment.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Job Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {showQuickPhotoCapture && (
        <QuickPhotoCapture
          onSave={handleQuickPhotoSave}
          onClose={() => setShowQuickPhotoCapture(false)}
        />
      )}

      {showPhotoCapture && (
        <PhotoCapture
          onSave={handleSavePhoto}
          onClose={() => setShowPhotoCapture(false)}
        />
      )}

      {showSignature && (
        <SignaturePad
          onSave={handleSaveSignature}
          onClose={() => setShowSignature(false)}
        />
      )}
    </div>
  );
}
