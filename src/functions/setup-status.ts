import { createServerFn } from "@tanstack/react-start";
import { ensureSession } from "@/lib/auth.functions";
import { getStackSetupStatus } from "@/lib/mcp/setup-status";
import { getActiveOrgId } from "./context";

export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await ensureSession();
  const orgId = await getActiveOrgId(session);
  return getStackSetupStatus(orgId);
});
