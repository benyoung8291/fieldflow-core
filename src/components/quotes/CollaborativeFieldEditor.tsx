import { ReactNode, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CollaborativeFieldEditorProps {
  fieldName: string;
  children: ReactNode;
  fieldEditors: Array<{
    user_id: string;
    user_name: string;
    field_name: string;
    color: string;
  }>;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
}

/**
 * Wraps input fields with collaborative editing indicators
 * Shows colored borders and user badges when others are editing
 */
export function CollaborativeFieldEditor({
  fieldName,
  children,
  fieldEditors,
  onFocus,
  onBlur,
  className,
}: CollaborativeFieldEditorProps) {
  // Find editors currently editing this field
  const activeEditors = fieldEditors.filter((e) => e.field_name === fieldName);
  const hasActiveEditors = activeEditors.length > 0;

  // Get the primary editor (first one)
  const primaryEditor = activeEditors[0];

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (onBlur) {
        onBlur();
      }
    };
  }, [onBlur]);

  return (
    <div className={cn("relative", className)}>
      {/* Wrapper with colored border if someone is editing */}
      <div
        className={cn(
          "relative rounded-md transition-all duration-200",
          hasActiveEditors && "ring-2 ring-offset-2"
        )}
        style={
          hasActiveEditors
            ? {
                "--tw-ring-color": primaryEditor.color,
                borderColor: primaryEditor.color,
              } as React.CSSProperties
            : undefined
        }
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {children}

        {/* Editor badges */}
        {hasActiveEditors && (
          <div className="absolute -top-2 -right-2 flex gap-1 z-10">
            {activeEditors.map((editor) => (
              <Badge
                key={editor.user_id}
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 shadow-sm animate-in fade-in zoom-in duration-200"
                style={{
                  backgroundColor: `${editor.color}15`,
                  borderColor: editor.color,
                  color: editor.color,
                }}
              >
                {editor.user_name.split(" ")[0]} editing
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Pulse animation for active editing */}
      {hasActiveEditors && (
        <div
          className="absolute inset-0 rounded-md pointer-events-none animate-pulse"
          style={{
            boxShadow: `0 0 0 2px ${primaryEditor.color}20`,
          }}
        />
      )}
    </div>
  );
}
