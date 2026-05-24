import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff, Clipboard, LogOut } from "lucide-react";

type Room = {
  id: string;
  name: string | null;
  inviteToken: string | null;
  isOwner: boolean;
};

type RoomsResponse = {
  rooms: Room[];
};

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardHomePage,
});

function DashboardHomePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");

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

  const rooms = roomsQuery.data?.rooms ?? [];
  const [visibleInviteIds, setVisibleInviteIds] = useState<
    Record<string, boolean>
  >({});

  const toggleInviteVisibility = (roomId: string) => {
    setVisibleInviteIds((prev) => ({
      ...prev,
      [roomId]: !prev[roomId],
    }));
  };

  const copyInvite = async (inviteToken: string) => {
    const link = `${window.location.origin}/rooms/join?code=${inviteToken}`;
    await navigator.clipboard.writeText(link);
  };

  const signOut = async () => {
    await authClient.signOut();
    await navigate({ to: "/" });
  };

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
          <Button variant="ghost" onClick={signOut}>
            Sign out <LogOut />
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Your rooms</h2>
              <p className="text-sm text-muted-foreground">
                Rooms you own or were invited to.
              </p>
            </div>
            <div className="space-y-3">
              {roomsQuery.isPending ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 rounded-2xl" />
                  <Skeleton className="h-24 rounded-2xl" />
                </div>
              ) : rooms.length ? (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    className="rounded-2xl border border-border/60 bg-background px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <Link
                        to="/rooms/$roomId"
                        params={{ roomId: room.id }}
                        className="flex flex-1 items-center justify-between gap-4"
                      >
                        <span className="text-left">
                          <span className="block text-base font-medium">
                            {room.name ?? "Untitled room"}
                          </span>
                          <span className="block text-sm text-muted-foreground">
                            {room.isOwner ? "Invite available" : "Member"}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge variant={room.isOwner ? "default" : "secondary"}>
                            {room.isOwner ? "Owner" : "Member"}
                          </Badge>
                          <Badge variant="secondary">Open</Badge>
                        </span>
                      </Link>
                    </div>
                    {room.isOwner && room.inviteToken ? (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-muted-foreground">
                          Invite link
                        </div>
                        <div className="mt-1 flex gap-1">
                          <Input
                            value={
                              visibleInviteIds[room.id]
                                ? `${window.location.origin}/rooms/join?code=${room.inviteToken}`
                                : "************************"
                            }
                            readOnly
                            className="grow"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleInviteVisibility(room.id)}
                          >
                            {visibleInviteIds[room.id] ? <Eye /> : <EyeOff />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyInvite(room.inviteToken ?? "")}
                            disabled={!room.inviteToken}
                          >
                            <Clipboard />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No rooms yet. Create one or join with an invite link.
                </div>
              )}
            </div>
          </section>

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
          </div>
        </div>
      </div>
    </main>
  );
}
