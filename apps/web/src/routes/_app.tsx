import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();

    if (!session?.data) {
      const inviteCode = new URLSearchParams(location.search).get("code");
      throw redirect({
        to: "/",
        search: inviteCode ? { redirect: "join", code: inviteCode } : undefined,
      });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return <Outlet />;
}
