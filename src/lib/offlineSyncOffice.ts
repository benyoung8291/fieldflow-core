import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfficeOfflineDB extends DBSchema {
  leads: {
    key: string;
    value: any;
  };
  quotes: {
    key: string;
    value: any;
  };
  serviceOrders: {
    key: string;
    value: any;
  };
  invoices: {
    key: string;
    value: any;
  };
  customers: {
    key: string;
    value: any;
  };
  officeSyncQueue: {
    key: string;
    value: {
      id: string;
      type: 'lead' | 'quote' | 'service_order' | 'invoice' | 'customer';
      operation: 'create' | 'update' | 'delete';
      data: any;
      timestamp: string;
      retries: number;
    };
  };
}

let officeDbInstance: IDBPDatabase<OfficeOfflineDB> | null = null;

export const initOfficeOfflineDB = async () => {
  if (officeDbInstance) return officeDbInstance;

  officeDbInstance = await openDB<OfficeOfflineDB>('service-pulse-office-offline', 1, {
    upgrade(db) {
      // Leads store
      if (!db.objectStoreNames.contains('leads')) {
        db.createObjectStore('leads', { keyPath: 'id' });
      }

      // Quotes store
      if (!db.objectStoreNames.contains('quotes')) {
        db.createObjectStore('quotes', { keyPath: 'id' });
      }

      // Service Orders store
      if (!db.objectStoreNames.contains('serviceOrders')) {
        db.createObjectStore('serviceOrders', { keyPath: 'id' });
      }

      // Invoices store
      if (!db.objectStoreNames.contains('invoices')) {
        db.createObjectStore('invoices', { keyPath: 'id' });
      }

      // Customers store
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id' });
      }

      // Office sync queue store
      if (!db.objectStoreNames.contains('officeSyncQueue')) {
        db.createObjectStore('officeSyncQueue', { keyPath: 'id' });
      }
    },
  });

  return officeDbInstance;
};

export const getOfficeDB = async () => {
  if (!officeDbInstance) {
    await initOfficeOfflineDB();
  }
  return officeDbInstance!;
};

// Cache functions for each module
export const cacheLeads = async (leads: any[]) => {
  const db = await getOfficeDB();
  const tx = db.transaction('leads', 'readwrite');
  await Promise.all([
    ...leads.map((lead) => tx.store.put(lead)),
    tx.done,
  ]);
};

export const getCachedLeads = async () => {
  const db = await getOfficeDB();
  return await db.getAll('leads');
};

export const cacheQuotes = async (quotes: any[]) => {
  const db = await getOfficeDB();
  const tx = db.transaction('quotes', 'readwrite');
  await Promise.all([
    ...quotes.map((quote) => tx.store.put(quote)),
    tx.done,
  ]);
};

export const getCachedQuotes = async () => {
  const db = await getOfficeDB();
  return await db.getAll('quotes');
};

export const cacheServiceOrders = async (serviceOrders: any[]) => {
  const db = await getOfficeDB();
  const tx = db.transaction('serviceOrders', 'readwrite');
  await Promise.all([
    ...serviceOrders.map((order) => tx.store.put(order)),
    tx.done,
  ]);
};

export const getCachedServiceOrders = async () => {
  const db = await getOfficeDB();
  return await db.getAll('serviceOrders');
};

export const cacheInvoices = async (invoices: any[]) => {
  const db = await getOfficeDB();
  const tx = db.transaction('invoices', 'readwrite');
  await Promise.all([
    ...invoices.map((invoice) => tx.store.put(invoice)),
    tx.done,
  ]);
};

export const getCachedInvoices = async () => {
  const db = await getOfficeDB();
  return await db.getAll('invoices');
};

export const cacheCustomers = async (customers: any[]) => {
  const db = await getOfficeDB();
  const tx = db.transaction('customers', 'readwrite');
  await Promise.all([
    ...customers.map((customer) => tx.store.put(customer)),
    tx.done,
  ]);
};

export const getCachedCustomers = async () => {
  const db = await getOfficeDB();
  return await db.getAll('customers');
};

// Queue operations for sync
export const queueOfficeOperation = async (operation: {
  type: 'lead' | 'quote' | 'service_order' | 'invoice' | 'customer';
  operation: 'create' | 'update' | 'delete';
  data: any;
}) => {
  const db = await getOfficeDB();
  const id = `${operation.type}-${operation.operation}-${Date.now()}`;
  
  await db.put('officeSyncQueue', {
    id,
    ...operation,
    timestamp: new Date().toISOString(),
    retries: 0,
  });

  return id;
};

// Get sync queue
export const getOfficeSyncQueue = async () => {
  const db = await getOfficeDB();
  return await db.getAll('officeSyncQueue');
};

// Remove from sync queue
export const removeFromOfficeSyncQueue = async (id: string) => {
  const db = await getOfficeDB();
  await db.delete('officeSyncQueue', id);
};

// Update sync queue retry count
export const incrementOfficeSyncRetry = async (id: string) => {
  const db = await getOfficeDB();
  const item = await db.get('officeSyncQueue', id);
  if (item) {
    item.retries += 1;
    await db.put('officeSyncQueue', item);
  }
};
