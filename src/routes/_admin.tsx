import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ensureSuperAdmin } from "@/lib/auth.functions";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ location }) => {
    try {
      const session = await ensureSuperAdmin();
      return { session };
    } catch {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
