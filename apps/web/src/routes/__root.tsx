import { useEffect } from "react";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { authClient } from "../lib/auth-client";
import { startRealtime, stopRealtime } from "../lib/realtime";

type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const session = authClient.useSession();

  useEffect(() => {
    if (session.data?.session) {
      startRealtime();
    } else {
      stopRealtime();
    }
  }, [session.data?.session]);

  return <Outlet />;
}
