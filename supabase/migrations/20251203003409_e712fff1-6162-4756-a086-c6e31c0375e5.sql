-- Fix search_path for update_channel_last_message_at function
CREATE OR REPLACE FUNCTION public.update_channel_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_channels
  SET last_message_at = NEW.created_at
  WHERE id = NEW.channel_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;