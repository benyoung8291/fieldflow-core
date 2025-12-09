import React, { createContext, useContext, useRef, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AccessLogEntry {
  table_name: string;
  record_id?: string;
  action: 'view' | 'list' | 'search' | 'export' | 'download';
  metadata?: Record<string, any>;
}

interface UserContext {
  userId: string;
  userName: string;
  tenantId: string;
}

interface DataAccessLoggerContextValue {
  logAccess: (entry: AccessLogEntry) => void;
  flushLogs: () => Promise<void>;
}

const DataAccessLoggerContext = createContext<DataAccessLoggerContextValue | null>(null);

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30000; // 30 seconds

export function DataAccessLoggerProvider({ children }: { children: React.ReactNode }) {
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const queueRef = useRef<Array<AccessLogEntry & { accessed_at: string }>>([]);
  const flushingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load user context on mount
  useEffect(() => {
    const loadUserContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, first_name, last_name')
        .eq('id', user.id)
        .single();

      if (profile?.tenant_id) {
        const userName = profile.first_name 
          ? `${profile.first_name} ${profile.last_name || ''}`.trim()
          : user.email?.split('@')[0] || 'Unknown';
        
        setUserContext({
          userId: user.id,
          userName,
          tenantId: profile.tenant_id,
        });
      }
    };

    loadUserContext();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        loadUserContext();
      } else if (event === 'SIGNED_OUT') {
        setUserContext(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const flushLogs = useCallback(async () => {
    if (flushingRef.current || queueRef.current.length === 0 || !userContext) {
      return;
    }

    flushingRef.current = true;
    const logsToFlush = [...queueRef.current];
    queueRef.current = [];

    try {
      const formattedLogs = logsToFlush.map(log => ({
        tenant_id: userContext.tenantId,
        user_id: userContext.userId,
        user_name: userContext.userName,
        table_name: log.table_name,
        record_id: log.record_id || null,
        action: log.action,
        metadata: log.metadata || {},
        user_agent: navigator.userAgent,
        accessed_at: log.accessed_at,
      }));

      // Use RPC for batch insert
      const { error } = await supabase.rpc('batch_insert_access_logs', {
        logs: formattedLogs
      });

      if (error) {
        console.error('[DataAccessLogger] Batch insert failed:', error);
        // Re-queue failed logs (but limit to prevent memory issues)
        if (queueRef.current.length < 100) {
          queueRef.current = [...logsToFlush, ...queueRef.current];
        }
      }
    } catch (err) {
      console.error('[DataAccessLogger] Flush error:', err);
    } finally {
      flushingRef.current = false;
    }
  }, [userContext]);

  const logAccess = useCallback((entry: AccessLogEntry) => {
    if (!userContext) return;

    queueRef.current.push({
      ...entry,
      accessed_at: new Date().toISOString(),
    });

    // Flush if batch size reached
    if (queueRef.current.length >= BATCH_SIZE) {
      flushLogs();
    }
  }, [userContext, flushLogs]);

  // Periodic flush
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (queueRef.current.length > 0) {
        flushLogs();
      }
    }, FLUSH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [flushLogs]);

  // Flush on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (queueRef.current.length > 0 && userContext) {
        // Use sendBeacon for reliable delivery on unload
        const formattedLogs = queueRef.current.map(log => ({
          tenant_id: userContext.tenantId,
          user_id: userContext.userId,
          user_name: userContext.userName,
          table_name: log.table_name,
          record_id: log.record_id || null,
          action: log.action,
          metadata: log.metadata || {},
          user_agent: navigator.userAgent,
          accessed_at: log.accessed_at,
        }));

        // sendBeacon is fire-and-forget, works during unload
        navigator.sendBeacon(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/batch_insert_access_logs`,
          JSON.stringify({ logs: formattedLogs })
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushLogs();
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userContext, flushLogs]);

  return (
    <DataAccessLoggerContext.Provider value={{ logAccess, flushLogs }}>
      {children}
    </DataAccessLoggerContext.Provider>
  );
}

export function useDataAccessLogger() {
  const context = useContext(DataAccessLoggerContext);
  if (!context) {
    // Return no-op functions when outside provider
    return {
      logAccess: () => {},
      flushLogs: async () => {},
    };
  }
  return context;
}
