import { redirect } from "next/navigation";

export default function OldHelpRedirect() {
  redirect("/dashboard/academy");
}
