-- Update line items with past next_generation_date to current date
-- This makes them immediately available for generation
UPDATE service_contract_line_items scli
SET next_generation_date = CURRENT_DATE
FROM service_contracts sc
WHERE scli.contract_id = sc.id
  AND sc.status = 'active'
  AND scli.next_generation_date < CURRENT_DATE;