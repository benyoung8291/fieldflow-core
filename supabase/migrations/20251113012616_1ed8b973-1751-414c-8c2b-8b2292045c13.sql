-- Add foreign key constraints for expense policy rules
ALTER TABLE public.expense_policy_rules
ADD CONSTRAINT fk_expense_policy_vendor
FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;

ALTER TABLE public.expense_policy_rules
ADD CONSTRAINT fk_expense_policy_category
FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE CASCADE;