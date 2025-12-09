import { useEffect, useRef } from 'react';
import { useDataAccessLogger } from '@/contexts/DataAccessLoggerContext';

/**
 * Hook to automatically log when a user views a detail page.
 * Call this in detail page components to track data access.
 * 
 * @param tableName - The database table being accessed (e.g., 'customers', 'service_orders')
 * @param recordId - The ID of the record being viewed
 * @param metadata - Optional additional metadata to log
 */
export function useLogDetailPageAccess(
  tableName: string,
  recordId: string | undefined,
  metadata?: Record<string, any>
) {
  const { logAccess } = useDataAccessLogger();
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    // Only log once per record view (prevent double-logging from re-renders)
    if (recordId && loggedRef.current !== recordId) {
      loggedRef.current = recordId;
      logAccess({
        table_name: tableName,
        record_id: recordId,
        action: 'view',
        metadata,
      });
    }
  }, [tableName, recordId, metadata, logAccess]);
}

/**
 * Hook to log list page access with optional search/filter context.
 * 
 * @param tableName - The database table being accessed
 * @param metadata - Optional metadata like search terms, filters applied
 */
export function useLogListPageAccess(
  tableName: string,
  metadata?: Record<string, any>
) {
  const { logAccess } = useDataAccessLogger();
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!loggedRef.current) {
      loggedRef.current = true;
      logAccess({
        table_name: tableName,
        action: 'list',
        metadata,
      });
    }
  }, [tableName, metadata, logAccess]);
}

/**
 * Function to manually log an export action.
 * Call this when users export data to CSV/PDF.
 */
export function useLogExportAction() {
  const { logAccess } = useDataAccessLogger();

  return (tableName: string, recordId?: string, metadata?: Record<string, any>) => {
    logAccess({
      table_name: tableName,
      record_id: recordId,
      action: 'export',
      metadata,
    });
  };
}

/**
 * Function to manually log a download action.
 * Call this when users download files/documents.
 */
export function useLogDownloadAction() {
  const { logAccess } = useDataAccessLogger();

  return (tableName: string, recordId?: string, metadata?: Record<string, any>) => {
    logAccess({
      table_name: tableName,
      record_id: recordId,
      action: 'download',
      metadata,
    });
  };
}
