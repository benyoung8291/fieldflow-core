/**
 * Generate and manage unique session IDs for browser tabs
 * Used for multi-tab presence tracking
 */
export const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('presence-session-id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('presence-session-id', sessionId);
  }
  return sessionId;
};
