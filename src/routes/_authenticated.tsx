import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "@/lib/auth.functions";
import { getProfile } from "@/functions/profiles";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    const profile = await getProfile();
    if (!profile) {
      throw redirect({ to: "/setup" });
    }
    return { session, profile };
  },
  component: () => <Outlet />,
});
