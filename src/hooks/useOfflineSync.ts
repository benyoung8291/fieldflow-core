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
          const { appointmentId, action, timestamp, location } = item.data;

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) continue;

          // Get tenant_id from profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single();

          if (!profile?.tenant_id) continue;

          // Insert time log
          const { error } = await supabase.from('time_logs').insert({
            appointment_id: appointmentId,
            worker_id: user.id,
            tenant_id: profile.tenant_id,
            clock_in: action === 'check_in' ? timestamp : null,
            clock_out: action === 'check_out' ? timestamp : null,
          });

          if (error) throw error;

          // Update appointment status if checking in
          if (action === 'check_in') {
            await supabase
              .from('appointments')
              .update({ status: 'checked_in' })
              .eq('id', appointmentId);
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
