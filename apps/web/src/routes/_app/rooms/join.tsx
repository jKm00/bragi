import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { apiClient } from "../../../lib/api-client";

export const Route = createFileRoute("/_app/rooms/join")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  component: JoinRoomPage,
});

function JoinRoomPage() {
  const navigate = useNavigate();
  const { code } = Route.useSearch();

  const joinMutation = useMutation({
    mutationFn: async (inviteToken: string) => {
      const res = await apiClient.api.v1.rooms.join.$post({
        json: { inviteToken },
      });

      if (!res.ok) {
        throw new Error("make sure the invite link is correct");
      }

      return (await res.json()) as { room: { id: string } };
    },
    onSuccess: async (data) => {
      await navigate({ to: "/rooms/$roomId", params: { roomId: data.room.id } });
    },
  });

  useEffect(() => {
    if (code && !joinMutation.isPending && !joinMutation.isSuccess) {
      joinMutation.mutate(code);
    }
  }, [code, joinMutation]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-10">
      <Card className="w-full border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>Joining room</CardTitle>
        <CardDescription>
          We’re checking the invite code and adding you to the room.
        </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {joinMutation.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-12 rounded-2xl" />
              <Skeleton className="h-12 rounded-2xl" />
            </div>
          ) : joinMutation.isError ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We could not join this room. Make sure the invite link is correct.
              </p>
              <Button asChild>
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
