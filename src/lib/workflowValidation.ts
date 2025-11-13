import { Node, Edge } from "reactflow";

export interface ValidationIssue {
  severity: "error" | "warning";
  nodeId?: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export function validateWorkflow(nodes: Node[], edges: Edge[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Check if there's at least one trigger node
  const triggerNodes = nodes.filter(n => n.type === "trigger");
  if (triggerNodes.length === 0) {
    issues.push({
      severity: "error",
      message: "Workflow must have at least one trigger node"
    });
  }

  if (triggerNodes.length > 1) {
    issues.push({
      severity: "error",
      message: "Workflow can only have one trigger node"
    });
  }

  // Check for disconnected nodes (nodes not reachable from trigger)
  if (triggerNodes.length === 1) {
    const reachableNodes = getReachableNodes(triggerNodes[0].id, edges);
    const disconnectedNodes = nodes.filter(
      n => n.id !== triggerNodes[0].id && !reachableNodes.has(n.id)
    );

    disconnectedNodes.forEach(node => {
      issues.push({
        severity: "warning",
        nodeId: node.id,
        message: `Node "${node.data.label}" is not connected to the workflow`
      });
    });
  }

  // Check condition nodes for incomplete branches
  const conditionNodes = nodes.filter(n => n.type === "condition");
  conditionNodes.forEach(node => {
    const outgoingEdges = edges.filter(e => e.source === node.id);
    const hasTrueBranch = outgoingEdges.some(e => e.sourceHandle === "true");
    const hasFalseBranch = outgoingEdges.some(e => e.sourceHandle === "false");

    if (!hasTrueBranch || !hasFalseBranch) {
      issues.push({
        severity: "error",
        nodeId: node.id,
        message: `Condition "${node.data.label}" must have both true and false branches`
      });
    }

    // Check if condition has configuration
    const config = node.data.config || {};
    if (!config.field || !config.operator || !config.value) {
      issues.push({
        severity: "warning",
        nodeId: node.id,
        message: `Condition "${node.data.label}" is missing configuration`
      });
    }
  });

  // Check action nodes for missing configurations
  const actionNodes = nodes.filter(n => n.type === "action");
  actionNodes.forEach(node => {
    const config = node.data.config || {};
    const actionType = node.data.actionType;

    // Check specific action types for required fields
    if (actionType === "send_email") {
      if (!config.to || !config.subject || !config.message) {
        issues.push({
          severity: "warning",
          nodeId: node.id,
          message: `Email action "${node.data.label}" is missing required fields`
        });
      }
    }

    if (actionType === "delay") {
      if (!config.duration || !config.unit) {
        issues.push({
          severity: "warning",
          nodeId: node.id,
          message: `Delay action "${node.data.label}" is missing duration configuration`
        });
      }
    }

    if (actionType === "create_task" || actionType === "create_project" || 
        actionType === "create_service_order" || actionType === "create_invoice") {
      if (!config.name && !config.title) {
        issues.push({
          severity: "warning",
          nodeId: node.id,
          message: `Action "${node.data.label}" should have a name or title configured`
        });
      }
    }

    if (actionType === "update_status") {
      if (!config.status) {
        issues.push({
          severity: "warning",
          nodeId: node.id,
          message: `Status update "${node.data.label}" is missing target status`
        });
      }
    }

    if (actionType === "assign_user") {
      if (!config.assignment_type) {
        issues.push({
          severity: "warning",
          nodeId: node.id,
          message: `User assignment "${node.data.label}" is missing assignment type`
        });
      }
    }
  });

  // Check for nodes with no outgoing connections (except condition nodes which need specific checks)
  const nodesWithoutOutput = nodes.filter(node => {
    if (node.type === "trigger") return false; // Triggers should have output
    const hasOutgoing = edges.some(e => e.source === node.id);
    return !hasOutgoing;
  });

  if (nodesWithoutOutput.length > 0 && nodesWithoutOutput.length < nodes.length - 1) {
    nodesWithoutOutput.forEach(node => {
      issues.push({
        severity: "warning",
        nodeId: node.id,
        message: `Node "${node.data.label}" has no outgoing connections (workflow will end here)`
      });
    });
  }

  // Check if trigger has no outgoing connections
  if (triggerNodes.length === 1) {
    const triggerHasOutput = edges.some(e => e.source === triggerNodes[0].id);
    if (!triggerHasOutput) {
      issues.push({
        severity: "error",
        message: "Trigger node must be connected to at least one action or condition"
      });
    }
  }

  const hasErrors = issues.some(i => i.severity === "error");
  
  return {
    isValid: !hasErrors,
    issues
  };
}

function getReachableNodes(startNodeId: string, edges: Edge[]): Set<string> {
  const reachable = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    
    // Find all edges starting from current node
    const outgoingEdges = edges.filter(e => e.source === currentId);
    
    outgoingEdges.forEach(edge => {
      if (!reachable.has(edge.target)) {
        reachable.add(edge.target);
        queue.push(edge.target);
      }
    });
  }

  return reachable;
}
