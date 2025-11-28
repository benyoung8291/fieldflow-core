import { useEditor } from "@craftjs/core";
import { useEffect } from "react";

export const TemplateLoader = ({ 
  templateJson 
}: { 
  templateJson: string | null 
}) => {
  const { actions } = useEditor();
  
  useEffect(() => {
    if (templateJson) {
      try {
        const parsed = JSON.parse(templateJson);
        actions.deserialize(parsed);
      } catch (error) {
        console.error("Error loading template:", error);
      }
    }
  }, [templateJson, actions]);

  return null;
};
