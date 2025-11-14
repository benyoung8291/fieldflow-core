import { useCallback } from "react";

interface UseFieldTypingOptions {
  fieldName: string;
  startTyping: (fieldName: string) => void;
  stopTyping: () => void;
}

/**
 * Hook to automatically track typing indicators for form fields
 * Usage:
 * 
 * const { onFocus, onChange, onBlur } = useFieldTyping({
 *   fieldName: "customer_name",
 *   startTyping,
 *   stopTyping
 * });
 * 
 * <Input {...onFocus} {...onChange} {...onBlur} />
 */
export function useFieldTyping({
  fieldName,
  startTyping,
  stopTyping,
}: UseFieldTypingOptions) {
  const handleFocus = useCallback(() => {
    startTyping(fieldName);
  }, [fieldName, startTyping]);

  const handleChange = useCallback(() => {
    startTyping(fieldName);
  }, [fieldName, startTyping]);

  const handleBlur = useCallback(() => {
    stopTyping();
  }, [stopTyping]);

  return {
    onFocus: handleFocus,
    onChange: handleChange,
    onBlur: handleBlur,
  };
}
