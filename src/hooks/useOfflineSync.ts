import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  initOfflineDB,
  getSyncQueue,
  removeFromSyncQueue,
  incrementSyncRetry,
  setupOnlineListeners,
  isOnline as checkIsOnline,
} from '@/lib/offlineSync';
import { toast } from 'sonner';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(checkIsOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingItems, setPendingItems] = useState(0);

  const syncPendingItems = async () => {
    if (!checkIsOnline() || isSyncing) return;

    setIsSyncing(true);
    const queue = await getSyncQueue();
    setPendingItems(queue.length);

    if (queue.length === 0) {
      setIsSyncing(false);
      return;
    }

    console.log(`Syncing ${queue.length} pending items...`);

    for (const item of queue) {
      try {
        if (item.type === 'time_entry') {
          const { 
            appointmentId, 
            workerId, 
            tenantId, 
            action, 
            timestamp, 
            location,
            hourlyRate,
            notes,
            timeLogId
          } = item.data;

          if (action === 'clock_in') {
            // Insert new time log for clock in
            const timeLogData: any = {
              appointment_id: appointmentId,
              worker_id: workerId,
              tenant_id: tenantId,
              clock_in: timestamp,
              hourly_rate: hourlyRate || 0,
              overhead_percentage: 0,
            };

            if (location) {
              timeLogData.latitude = location.latitude;
              timeLogData.longitude = location.longitude;
            }

            if (notes) {
              timeLogData.notes = notes;
            }

            const { error } = await supabase.from('time_logs').insert(timeLogData);
            if (error) throw error;

            // Update appointment status
            await supabase
              .from('appointments')
              .update({ status: 'checked_in' })
              .eq('id', appointmentId);
          } else if (action === 'clock_out' && timeLogId) {
            // Update existing time log for clock out
            const updateData: any = {
              clock_out: timestamp,
              status: 'completed',
            };

            if (notes) {
              updateData.notes = notes;
            }

            const { error } = await supabase
              .from('time_logs')
              .update(updateData)
              .eq('id', timeLogId);

            if (error) throw error;

            // Check if all workers have clocked out before completing appointment
            const { data: remainingLogs } = await supabase
              .from('time_logs')
              .select('id, clock_out')
              .eq('appointment_id', appointmentId)
              .is('clock_out', null);

            // Only update appointment status to completed if all workers have clocked out
            if (!remainingLogs || remainingLogs.length === 0) {
              await supabase
                .from('appointments')
                .update({ status: 'completed' })
                .eq('id', appointmentId);
            }
          }

          await removeFromSyncQueue(item.id);
          console.log(`Synced: ${item.id}`);
        }
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        
        // Increment retry count
        await incrementSyncRetry(item.id);
        
        // If too many retries, remove from queue
        if (item.retries >= 5) {
          await removeFromSyncQueue(item.id);
          toast.error(`Failed to sync time entry after 5 attempts`);
        }
      }
    }

    const remainingQueue = await getSyncQueue();
    setPendingItems(remainingQueue.length);
    setIsSyncing(false);

    if (remainingQueue.length === 0) {
      toast.success('All offline data synced successfully');
    }
  };

  useEffect(() => {
    initOfflineDB();

    // Initial sync check
    syncPendingItems();

    // Set up online/offline listeners
    const cleanup = setupOnlineListeners(
      () => {
        setIsOnline(true);
        toast.success('Back online - syncing data...');
        syncPendingItems();
      },
      () => {
        setIsOnline(false);
        toast.warning('Offline mode - changes will sync when online');
      }
    );

    // Periodic sync check (every 30 seconds when online)
    const interval = setInterval(() => {
      if (checkIsOnline()) {
        syncPendingItems();
      }
    }, 30000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingItems,
    syncNow: syncPendingItems,
  };
};
