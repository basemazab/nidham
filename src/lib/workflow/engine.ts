import type {
  ConditionNode,
  ExecutionContext,
  ActionNode,
  ConditionOperator,
} from "./types";

// ──────────────────────────────────────────────────
// CONDITION EVALUATOR
// ──────────────────────────────────────────────────

function evaluateSingleCondition(
  node: ConditionNode,
  ctx: ExecutionContext,
): boolean {
  const { field, operator, value } = node;
  if (!field || !operator) return true;

  const actual = ctx.triggerData[field];

  switch (operator as ConditionOperator) {
    case "eq":
      return actual === value;
    case "neq":
      return actual !== value;
    case "gt":
      return Number(actual) > Number(value);
    case "gte":
      return Number(actual) >= Number(value);
    case "lt":
      return Number(actual) < Number(value);
    case "lte":
      return Number(actual) <= Number(value);
    case "contains":
      return String(actual).includes(String(value));
    case "not_contains":
      return !String(actual).includes(String(value));
    case "in":
      return Array.isArray(value) && value.includes(actual);
    case "not_in":
      return Array.isArray(value) && !value.includes(actual);
    case "between":
      return (
        Array.isArray(value) &&
        value.length === 2 &&
        Number(actual) >= Number(value[0]) &&
        Number(actual) <= Number(value[1])
      );
    default:
      return true;
  }
}

export function evaluateConditions(
  conditions: ConditionNode[],
  ctx: ExecutionContext,
): boolean {
  if (conditions.length === 0) return true;

  return conditions.every((node) => {
    if (node.type === "group" && node.conditions) {
      const op = node.logical_op ?? "and";
      const results = node.conditions.map((c) =>
        evaluateSingleCondition(c, ctx),
      );
      return op === "and" ? results.every(Boolean) : results.some(Boolean);
    }
    return evaluateSingleCondition(node, ctx);
  });
}

// ──────────────────────────────────────────────────
// ACTION EXECUTOR
// ──────────────────────────────────────────────────

export interface ActionResult {
  actionId: string;
  actionType: string;
  success: boolean;
  error?: string;
}

export async function executeActions(
  actions: ActionNode[],
  ctx: ExecutionContext,
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "send_notification":
          results.push(
            await executeSendNotification(action, ctx),
          );
          break;
        case "update_record":
          results.push(await executeUpdateRecord(action, ctx));
          break;
        case "create_record":
          results.push(await executeCreateRecord(action, ctx));
          break;
        case "trigger_webhook":
          results.push(await executeTriggerWebhook(action, ctx));
          break;
        case "set_employee_status":
          results.push(
            await executeSetEmployeeStatus(action, ctx),
          );
          break;
        case "assign_approver":
          results.push(await executeAssignApprover(action, ctx));
          break;
        default:
          results.push({
            actionId: action.id,
            actionType: action.type,
            success: false,
            error: `Unsupported action type: ${action.type}`,
          });
      }
    } catch (err) {
      results.push({
        actionId: action.id,
        actionType: action.type,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

// ── Action implementations ──

async function executeSendNotification(
  action: ActionNode,
  ctx: ExecutionContext,
): Promise<ActionResult> {
  const { title, body, recipients } = action.config;
  console.info(
    `[workflow] send_notification: "${title}" to ${recipients?.join(", ")}`,
    { body, companyId: ctx.companyId },
  );

  // TODO: Insert into a notifications table
  return {
    actionId: action.id,
    actionType: action.type,
    success: true,
  };
}

async function executeUpdateRecord(
  action: ActionNode,
  ctx: ExecutionContext,
): Promise<ActionResult> {
  const { table, record_id_field, changes } = action.config;
  if (!table || !changes) {
    return {
      actionId: action.id,
      actionType: action.type,
      success: false,
      error: "Missing table or changes config",
    };
  }

  console.info(
    `[workflow] update_record: ${table} where ${record_id_field}`,
    { changes, companyId: ctx.companyId },
  );

  return {
    actionId: action.id,
    actionType: action.type,
    success: true,
  };
}

async function executeCreateRecord(
  action: ActionNode,
  ctx: ExecutionContext,
): Promise<ActionResult> {
  const { table, data } = action.config;
  if (!table || !data) {
    return {
      actionId: action.id,
      actionType: action.type,
      success: false,
      error: "Missing table or data config",
    };
  }

  console.info(`[workflow] create_record: ${table}`, {
    data,
    companyId: ctx.companyId,
  });

  return {
    actionId: action.id,
    actionType: action.type,
    success: true,
  };
}

async function executeTriggerWebhook(
  action: ActionNode,
  ctx: ExecutionContext,
): Promise<ActionResult> {
  const { url, method = "POST", body } = action.config;
  if (!url) {
    return {
      actionId: action.id,
      actionType: action.type,
      success: false,
      error: "Missing URL",
    };
  }

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body
        ? JSON.stringify({ webhookBody: body, triggerData: ctx.triggerData })
        : undefined,
    });

    return {
      actionId: action.id,
      actionType: action.type,
      success: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      actionId: action.id,
      actionType: action.type,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function executeSetEmployeeStatus(
  action: ActionNode,
  ctx: ExecutionContext,
): Promise<ActionResult> {
  const { status } = action.config;
  if (!status || !ctx.employeeId) {
    return {
      actionId: action.id,
      actionType: action.type,
      success: false,
      error: "Missing status or employee ID",
    };
  }

  console.info(
    `[workflow] set_employee_status: employee ${ctx.employeeId} → ${status}`,
  );

  return {
    actionId: action.id,
    actionType: action.type,
    success: true,
  };
}

async function executeAssignApprover(
  action: ActionNode,
  ctx: ExecutionContext,
): Promise<ActionResult> {
  const { request_type, approver_field } = action.config;
  console.info(
    `[workflow] assign_approver: ${request_type} → ${approver_field}`,
  );

  return {
    actionId: action.id,
    actionType: action.type,
    success: true,
  };
}

// ──────────────────────────────────────────────────
// MAIN WORKFLOW RUNNER
// ──────────────────────────────────────────────────

export interface WorkflowRunResult {
  conditionsMet: boolean;
  actionResults: ActionResult[];
  executionMs: number;
}

export async function runWorkflow(
  conditions: ConditionNode[],
  actions: ActionNode[],
  ctx: ExecutionContext,
): Promise<WorkflowRunResult> {
  const startedAt = Date.now();

  const conditionsMet = evaluateConditions(conditions, ctx);

  if (!conditionsMet) {
    return {
      conditionsMet: false,
      actionResults: [],
      executionMs: Date.now() - startedAt,
    };
  }

  const actionResults = await executeActions(actions, ctx);

  return {
    conditionsMet: true,
    actionResults,
    executionMs: Date.now() - startedAt,
  };
}
