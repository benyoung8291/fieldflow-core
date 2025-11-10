import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineDB extends DBSchema {
  appointments: {
    key: string;
    value: any;
    indexes: { 'by-date': string };
  };
  timeEntries: {
    key: string;
    value: {
      id: string;
      appointmentId: string;
      workerId: string;
      tenantId: string;
      action: 'clock_in' | 'clock_out';
      timestamp: string;
      location?: { latitude: number; longitude: number };
      hourlyRate?: number;
      notes?: string;
      timeLogId?: string;
      synced: boolean;
    };
  };
  syncQueue: {
    key: string;
    value: {
      id: string;
      type: string;
      data: any;
      timestamp: string;
      retries: number;
    };
  };
}

let dbInstance: IDBPDatabase<OfflineDB> | null = null;

export const initOfflineDB = async () => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineDB>('service-pulse-offline', 1, {
    upgrade(db) {
      // Appointments store
      if (!db.objectStoreNames.contains('appointments')) {
        const appointmentStore = db.createObjectStore('appointments', {
          keyPath: 'id',
        });
        appointmentStore.createIndex('by-date', 'start_time');
      }

      // Time entries store
      if (!db.objectStoreNames.contains('timeEntries')) {
        db.createObjectStore('timeEntries', { keyPath: 'id' });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
};

export const getDB = async () => {
  if (!dbInstance) {
    await initOfflineDB();
  }
  return dbInstance!;
};

// Cache active time logs for offline access
export const cacheActiveTimeLogs = async (appointmentId: string, timeLog: any) => {
  const db = await getDB();
  if (timeLog) {
    await db.put('timeEntries', {
      id: timeLog.id,
      appointmentId: appointmentId,
      workerId: timeLog.worker_id,
      tenantId: timeLog.tenant_id,
      action: 'clock_in',
      timestamp: timeLog.clock_in,
      notes: timeLog.notes,
      timeLogId: timeLog.id,
      synced: true, // Already synced to server
    });
  }
};

export const getCachedTimeLog = async (appointmentId: string, workerId: string) => {
  const db = await getDB();
  const entries = await db.getAll('timeEntries');
  // Return the most recent clock-in entry for this appointment and worker
  // This could be either synced (cached from server) or unsynced (offline entry)
  const clockInEntries = entries.filter(
    (entry) => 
      entry.appointmentId === appointmentId && 
      entry.workerId === workerId && 
      entry.action === 'clock_in'
  );
  
  // Return the most recent one
  if (clockInEntries.length > 0) {
    return clockInEntries.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
  }
  
  return null;
};

// Cache appointments for offline access
export const cacheAppointments = async (appointments: any[]) => {
  const db = await getDB();
  const tx = db.transaction('appointments', 'readwrite');
  
  await Promise.all([
    ...appointments.map((apt) => tx.store.put(apt)),
    tx.done,
  ]);
};

export const getCachedAppointments = async () => {
  const db = await getDB();
  return await db.getAll('appointments');
};

// Queue time entry for sync
export const queueTimeEntry = async (entry: {
  appointmentId: string;
  workerId: string;
  tenantId: string;
  action: 'clock_in' | 'clock_out';
  timestamp: string;
  location?: { latitude: number; longitude: number };
  hourlyRate?: number;
  notes?: string;
  timeLogId?: string;
}) => {
  const db = await getDB();
  const id = `${entry.appointmentId}-${entry.action}-${Date.now()}`;
  
  await db.put('timeEntries', {
    id,
    ...entry,
    synced: false,
  });

  // Also add to sync queue
  await db.put('syncQueue', {
    id,
    type: 'time_entry',
    data: entry,
    timestamp: new Date().toISOString(),
    retries: 0,
  });

  return id;
};

// Get unsynced time entries
export const getUnsyncedTimeEntries = async () => {
  const db = await getDB();
  const entries = await db.getAll('timeEntries');
  return entries.filter((entry) => !entry.synced);
};

// Mark time entry as synced
export const markTimeEntrySynced = async (id: string) => {
  const db = await getDB();
  const entry = await db.get('timeEntries', id);
  if (entry) {
    entry.synced = true;
    await db.put('timeEntries', entry);
  }
  // Remove from sync queue
  await db.delete('syncQueue', id);
};

// Get sync queue
export const getSyncQueue = async () => {
  const db = await getDB();
  return await db.getAll('syncQueue');
};

// Remove from sync queue
export const removeFromSyncQueue = async (id: string) => {
  const db = await getDB();
  await db.delete('syncQueue', id);
};

// Update sync queue retry count
export const incrementSyncRetry = async (id: string) => {
  const db = await getDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    item.retries += 1;
    await db.put('syncQueue', item);
  }
};

// Check if online
export const isOnline = () => navigator.onLine;

// Online/offline event listeners
export const setupOnlineListeners = (onOnline: () => void, onOffline: () => void) => {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
};
