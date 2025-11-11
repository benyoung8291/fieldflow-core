import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  initOfficeOfflineDB,
  getOfficeSyncQueue,
  removeFromOfficeSyncQueue,
  incrementOfficeSyncRetry,
} from '@/lib/offlineSyncOffice';
import { isOnline as checkIsOnline, setupOnlineListeners } from '@/lib/offlineSync';
import { toast } from 'sonner';

export const useOfflineSyncOffice = () => {
  const [isOnline, setIsOnline] = useState(checkIsOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingItems, setPendingItems] = useState(0);

  const syncPendingItems = async () => {
    if (!checkIsOnline() || isSyncing) return;

    setIsSyncing(true);
    const queue = await getOfficeSyncQueue();
    setPendingItems(queue.length);

    if (queue.length === 0) {
      setIsSyncing(false);
      return;
    }

    console.log(`Syncing ${queue.length} pending office items...`);

    for (const item of queue) {
      try {
        const { type, operation, data } = item;
        
        // Type-safe table operations with type assertions for offline sync
        if (type === 'lead') {
          if (operation === 'create') {
            const { error } = await (supabase.from as any)('crm_leads').insert(data);
            if (error) throw error;
          } else if (operation === 'update') {
            const { error } = await (supabase.from as any)('crm_leads').update(data).eq('id', data.id);
            if (error) throw error;
          } else if (operation === 'delete') {
            const { error } = await (supabase.from as any)('crm_leads').delete().eq('id', data.id);
            if (error) throw error;
          }
        } else if (type === 'quote') {
          if (operation === 'create') {
            const { error } = await (supabase.from as any)('quotes').insert(data);
            if (error) throw error;
          } else if (operation === 'update') {
            const { error } = await (supabase.from as any)('quotes').update(data).eq('id', data.id);
            if (error) throw error;
          } else if (operation === 'delete') {
            const { error } = await (supabase.from as any)('quotes').delete().eq('id', data.id);
            if (error) throw error;
          }
        } else if (type === 'service_order') {
          if (operation === 'create') {
            const { error } = await (supabase.from as any)('service_orders').insert(data);
            if (error) throw error;
          } else if (operation === 'update') {
            const { error } = await (supabase.from as any)('service_orders').update(data).eq('id', data.id);
            if (error) throw error;
          } else if (operation === 'delete') {
            const { error } = await (supabase.from as any)('service_orders').delete().eq('id', data.id);
            if (error) throw error;
          }
        } else if (type === 'invoice') {
          if (operation === 'create') {
            const { error } = await (supabase.from as any)('invoices').insert(data);
            if (error) throw error;
          } else if (operation === 'update') {
            const { error } = await (supabase.from as any)('invoices').update(data).eq('id', data.id);
            if (error) throw error;
          } else if (operation === 'delete') {
            const { error } = await (supabase.from as any)('invoices').delete().eq('id', data.id);
            if (error) throw error;
          }
        } else if (type === 'customer') {
          if (operation === 'create') {
            const { error } = await (supabase.from as any)('customers').insert(data);
            if (error) throw error;
          } else if (operation === 'update') {
            const { error } = await (supabase.from as any)('customers').update(data).eq('id', data.id);
            if (error) throw error;
          } else if (operation === 'delete') {
            const { error } = await (supabase.from as any)('customers').delete().eq('id', data.id);
            if (error) throw error;
          }
        }

        await removeFromOfficeSyncQueue(item.id);
        console.log(`Synced: ${item.id}`);
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        
        await incrementOfficeSyncRetry(item.id);
        
        if (item.retries >= 5) {
          await removeFromOfficeSyncQueue(item.id);
          toast.error(`Failed to sync ${item.type} after 5 attempts`);
        }
      }
    }

    const remainingQueue = await getOfficeSyncQueue();
    setPendingItems(remainingQueue.length);
    setIsSyncing(false);

    if (remainingQueue.length === 0) {
      toast.success('All offline office data synced successfully');
    }
  };

  useEffect(() => {
    initOfficeOfflineDB();

    // Initial sync check
    syncPendingItems();

    // Set up online/offline listeners
    const cleanup = setupOnlineListeners(
      () => {
        setIsOnline(true);
        syncPendingItems();
      },
      () => {
        setIsOnline(false);
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
