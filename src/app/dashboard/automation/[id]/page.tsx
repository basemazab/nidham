import { getWorkflow } from "../actions";
import { WorkflowEditor } from "@/components/workflow/workflow-editor";

export const metadata = {
  title: "تعديل قاعدة أتمتة",
};

export default async function WorkflowDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const workflow = await getWorkflow(id);

  return <WorkflowEditor workflow={workflow} />;
}
