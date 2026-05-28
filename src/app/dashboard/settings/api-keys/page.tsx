import { listApiKeys } from "@/lib/api/actions";
import { ApiKeysClient } from "./api-keys-client";

export const metadata = {
  title: "مفاتيح API",
};

export default async function ApiKeysPage() {
  const keys = await listApiKeys();
  return <ApiKeysClient keys={keys} />;
}
