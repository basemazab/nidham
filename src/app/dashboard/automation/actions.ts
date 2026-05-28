"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function listWorkflows() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflows")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getWorkflow(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createWorkflow(formData: FormData) {
  const supabase = await createClient();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const triggerType = formData.get("trigger_type") as string;

  const { data, error } = await supabase
    .from("workflows")
    .insert({
      name,
      description,
      trigger_type: triggerType,
      trigger_config: {},
      conditions: [],
      actions: [],
      is_active: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/automation");
  return data;
}

export async function updateWorkflow(id: string, formData: FormData) {
  const supabase = await createClient();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const isActive = formData.get("is_active") === "true";

  const { data, error } = await supabase
    .from("workflows")
    .update({ name, description, is_active: isActive })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/automation");
  return data;
}

export async function saveWorkflowDefinition(
  id: string,
  definition: {
    trigger_config: Record<string, unknown>;
    conditions: unknown[];
    actions: unknown[];
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workflows")
    .update({
      trigger_config: definition.trigger_config,
      conditions: definition.conditions,
      actions: definition.actions,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/automation");
}

export async function toggleWorkflow(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workflows")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/automation");
}

export async function deleteWorkflow(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workflows")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/automation");
}

export async function listExecutionLogs(workflowId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("workflow_execution_logs")
    .select("*, workflows:workflow_id(name)")
    .order("started_at", { ascending: false })
    .limit(50);

  if (workflowId) {
    query = query.eq("workflow_id", workflowId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
