import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PolicyViolation {
  rule_id: string;
  rule_name: string;
  rule_type: string;
  violation_action: string;
  message: string;
}

interface PolicyCheckParams {
  amount?: number;
  supplier_id?: string;
  category_id?: string;
  document_type: "expense" | "purchase_order";
}

export function useExpensePolicyCheck(params: PolicyCheckParams) {
  return useQuery({
    queryKey: ["policy-check", params],
    queryFn: async () => {
      const { data: rules, error } = await supabase
        .from("expense_policy_rules")
        .select(`
          *,
          supplier:suppliers!supplier_id(name),
          category:expense_categories(name)
        `)
        .eq("is_active", true)
        .in("applies_to", [params.document_type === "expense" ? "expenses" : "purchase_orders", "both"]);

      if (error) throw error;

      const violations: PolicyViolation[] = [];
      const blockingViolations: PolicyViolation[] = [];

      for (const rule of rules || []) {
        let violated = false;
        let message = "";

        switch (rule.rule_type) {
          case "max_amount":
            if (params.amount && rule.max_amount && params.amount > rule.max_amount) {
              violated = true;
              message = `Amount $${params.amount.toFixed(2)} exceeds maximum allowed of $${rule.max_amount.toFixed(2)}`;
            }
            break;

          case "restricted_vendor":
            if (params.supplier_id && rule.supplier_id === params.supplier_id) {
              violated = true;
              message = `Supplier "${rule.supplier?.name}" is restricted by policy`;
            }
            break;

          case "prohibited_category":
            if (params.category_id && rule.category_id === params.category_id) {
              violated = true;
              message = `Category "${rule.category?.name}" is prohibited by policy`;
            }
            break;
        }

        if (violated) {
          const violation: PolicyViolation = {
            rule_id: rule.id,
            rule_name: rule.rule_name,
            rule_type: rule.rule_type,
            violation_action: rule.violation_action,
            message,
          };

          violations.push(violation);

          if (rule.violation_action === "block") {
            blockingViolations.push(violation);
          }
        }
      }

      return {
        violations,
        blockingViolations,
        hasViolations: violations.length > 0,
        isBlocked: blockingViolations.length > 0,
        isPolicyCompliant: violations.length === 0,
      };
    },
    enabled: !!(params.amount || params.supplier_id || params.category_id),
  });
}
