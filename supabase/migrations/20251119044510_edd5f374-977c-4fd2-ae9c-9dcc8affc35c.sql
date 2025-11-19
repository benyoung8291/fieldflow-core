-- Change received_by from UUID to TEXT to store user names
ALTER TABLE po_receipts 
ALTER COLUMN received_by TYPE TEXT;