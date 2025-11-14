import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { debounce } from "lodash-es";

interface UseCollaborativeFieldOptions {
  table: string;
  id: string | undefined;
  fieldName: string;
  queryKey: string[];
  startTyping?: (fieldName: string) => void;
  stopTyping?: () => void;
  debounceMs?: number;
}

/**
 * Hook to manage a collaborative field with auto-save and typing indicators
 */
export function useCollaborativeField({
  table,
  id,
  fieldName,
  queryKey,
  startTyping,
  stopTyping,
  debounceMs = 1000,
}: UseCollaborativeFieldOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSavingRef = useRef(false);
  
  // Mutation for auto-save
  const saveMutation = useMutation({
    mutationFn: async (value: any) => {
      if (!id) throw new Error("No document ID");
      
      const { error } = await (supabase
        .from(table as any)
        .update({ [fieldName]: value, updated_at: new Date().toISOString() })
        .eq("id", id));

      if (error) throw error;
    },
    onSuccess: () => {
      console.log(`[AutoSave] Saved ${fieldName} to ${table}`);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      console.error(`[AutoSave] Error saving ${fieldName}:`, error);
      toast({
        title: "Failed to save",
        description: "Your changes could not be saved. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      isSavingRef.current = false;
      stopTyping?.();
    },
  });

  // Debounced save function
  const debouncedSave = useRef(
    debounce((value: any) => {
      if (!isSavingRef.current) {
        isSavingRef.current = true;
        saveMutation.mutate(value);
      }
    }, debounceMs)
  ).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const handleChange = useCallback((value: any) => {
    startTyping?.(fieldName);
    debouncedSave(value);
  }, [fieldName, startTyping, debouncedSave]);

  const handleFocus = useCallback(() => {
    startTyping?.(fieldName);
  }, [fieldName, startTyping]);

  const handleBlur = useCallback(() => {
    // Flush any pending saves immediately
    debouncedSave.flush();
    stopTyping?.();
  }, [debouncedSave, stopTyping]);

  return {
    handleChange,
    handleFocus,
    handleBlur,
    isSaving: saveMutation.isPending,
  };
}