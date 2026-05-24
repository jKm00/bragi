import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";

type Room = {
  id: string;
  name: string | null;
  inviteToken: string;
};

type RoomsResponse = {
  rooms: Room[];
};

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardHomePage,
});

function DashboardHomePage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [inviteToken, setInviteToken] = useState("");

  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await apiClient.api.v1.rooms.$get();
      if (!res.ok) throw new Error("Failed to load rooms");
      return (await res.json()) as RoomsResponse;
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async (roomName: string) => {
      const res = await apiClient.api.v1.rooms.$post({
        json: { name: roomName },
      });
      if (!res.ok) throw new Error("Failed to create room");
      return (await res.json()) as Room;
    },
    onSuccess: async () => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiClient.api.v1.rooms.join.$post({
        json: { inviteToken: token },
      });
      if (!res.ok) throw new Error("Failed to join room");
      return await res.json();
    },
    onSuccess: async () => {
      setInviteToken("");
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const rooms = roomsQuery.data?.rooms ?? [];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 md:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Bragi
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
              Dashboard
            </h1>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader className="space-y-1">
              <CardTitle>Your rooms</CardTitle>
              <CardDescription>
                Rooms you own or were invited to.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {roomsQuery.isPending ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 rounded-2xl" />
                  <Skeleton className="h-24 rounded-2xl" />
                </div>
              ) : rooms.length ? (
                rooms.map((room) => (
                  <Button
                    key={room.id}
                    asChild
                    variant="outline"
                    className="h-auto w-full justify-between rounded-2xl border-border/60 bg-background px-4 py-4"
                  >
                    <Link to="/rooms/$roomId" params={{ roomId: room.id }}>
                      <span className="text-left">
                        <span className="block text-base font-medium">
                          {room.name ?? "Untitled room"}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          Invite ready
                        </span>
                      </span>
                      <Badge variant="secondary">Open</Badge>
                    </Link>
                  </Button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No rooms yet. Create one or join with an invite link.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Create room</CardTitle>
                <CardDescription>
                  Start a private room for your team.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={name}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setName(event.target.value)
                  }
                  placeholder="Design, engineering, focus..."
                />
                <Button
                  className="w-full"
                  disabled={!name.trim() || createRoomMutation.isPending}
                  onClick={() => createRoomMutation.mutate(name.trim())}
                >
                  {createRoomMutation.isPending ? "Creating..." : "Create room"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Join room</CardTitle>
                <CardDescription>
                  Paste the invite code from a room link.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={inviteToken}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setInviteToken(event.target.value)
                  }
                  placeholder="Invite code"
                />
                <Button
                  className="w-full"
                  disabled={!inviteToken.trim() || joinRoomMutation.isPending}
                  onClick={() => joinRoomMutation.mutate(inviteToken.trim())}
                  variant="secondary"
                >
                  {joinRoomMutation.isPending ? "Joining..." : "Join room"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
