import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadResult {
  path: string;
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export function useChatStorage() {
  const uploadFile = async (
    file: File,
    channelId: string
  ): Promise<UploadResult | null> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error("You must be logged in to upload files");
        return null;
      }

      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `${channelId}/${user.user.id}/${timestamp}-${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("chat_attachments")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("[ChatStorage] Upload error:", uploadError);
        toast.error(`Failed to upload ${file.name}`);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from("chat_attachments")
        .getPublicUrl(path);

      return {
        path,
        url: urlData.publicUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      };
    } catch (error) {
      console.error("[ChatStorage] Error:", error);
      toast.error("Failed to upload file");
      return null;
    }
  };

  const getPublicUrl = (path: string): string => {
    const { data } = supabase.storage
      .from("chat_attachments")
      .getPublicUrl(path);
    return data.publicUrl;
  };

  return { uploadFile, getPublicUrl };
}
