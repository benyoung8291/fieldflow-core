-- Enable realtime for audit_logs table to track changes across all modules
ALTER TABLE audit_logs REPLICA IDENTITY FULL;

-- Add the audit_logs table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;