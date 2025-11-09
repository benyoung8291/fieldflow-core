// Sanitized error handling utility to prevent information leakage

export function sanitizeError(error: unknown, context: string): string {
  // Log full error server-side for debugging
  console.error(`[${context}] Error details:`, error);
  
  // Return generic message to client
  return 'An error occurred processing your request';
}

export function sanitizeAuthError(error: unknown, context: string): string {
  console.error(`[${context}] Auth error:`, error);
  return 'Authentication failed';
}

export function sanitizeDatabaseError(error: unknown, context: string): string {
  console.error(`[${context}] Database error:`, error);
  return 'Unable to process request';
}

export function sanitizeValidationError(message: string): string {
  // Validation errors can be returned as they don't expose system internals
  return message;
}
