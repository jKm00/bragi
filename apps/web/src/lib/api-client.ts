import { hc } from "hono/client";
import type { ApiType } from "@bragi/api";

export const apiClient = hc<ApiType>(import.meta.env.VITE_BETTER_AUTH_URL ?? "http://127.0.0.1:3000", {
  init: {
    credentials: "include",
  },
});
