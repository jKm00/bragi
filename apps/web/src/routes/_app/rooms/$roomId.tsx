import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Crown,
  Eye,
  LogOut,
  Trash2,
  Clipboard,
  EyeClosed,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { subscribeToPresence } from "@/lib/realtime";
import { Input } from "@/components/ui/input";

type RoomAccessResponse =
  | {
      room: {
        id: string;
        name: string | null;
        isOwner: boolean;
        role: "owner" | "member";
        inviteToken: string | null;
      };
      accessible: true;
    }
  | { accessible: false; message: string };

type Member = {
  userId: string;
  name: string;
  image: string | null;
  role: "owner" | "member";
  status: "active";
};

type MembersResponse = {
  members: Member[];
};

type RealtimePresenceSnapshot = {
  userId: string;
  state: "playing" | "paused" | "offline" | "hidden" | "private";
  trackId: string | null;
  trackName: string | null;
  artistName: string | null;
  albumName: string | null;
  albumArtUrl: string | null;
  spotifyUrl: string | null;
  progressMs: number | null;
  durationMs: number | null;
  syncedAt: string | null;
};

type RoomPresenceUpdate = {
  roomId: string;
  snapshot: RealtimePresenceSnapshot;
};

type RoomPresenceResponse = {
  snapshots: RealtimePresenceSnapshot[];
};

export const Route = createFileRoute("/_app/rooms/$roomId")({
  loader: async ({ params }) => {
    const res = await apiClient.api.v1.rooms[":roomId"].$get({
      param: { roomId: params.roomId },
    });

    if (!res.ok) {
      return {
        accessible: false,
        message:
          "Make sure the room link is correct, or ask the owner for an invite link.",
      } as RoomAccessResponse;
    }

    return (await res.json()) as RoomAccessResponse;
  },
  component: RoomPage,
});

function RoomPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const data = Route.useLoaderData();
  const [sidebarTab, setSidebarTab] = useState<"members" | "actions">(
    "members",
  );
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [presenceByUserId, setPresenceByUserId] = useState<
    Record<string, RealtimePresenceSnapshot>
  >({});
  const [presenceLoading, setPresenceLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const membersQuery = useQuery({
    queryKey: ["room-members", data.accessible ? data.room.id : "no-room"],
    enabled: data.accessible,
    queryFn: async () => {
      if (!data.accessible) throw new Error("Room is not accessible");
      const res = await apiClient.api.v1.rooms[":roomId"].members.$get({
        param: { roomId: data.room.id },
      });

      if (!res.ok) throw new Error("Failed to load members");
      return (await res.json()) as MembersResponse;
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!data.accessible) throw new Error("Room is not accessible");
      const res = await apiClient.api.v1.rooms[":roomId"].transfer[
        ":userId"
      ].$post({
        param: { roomId: data.room.id, userId },
      });
      if (!res.ok) throw new Error("Failed to transfer ownership");
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["room-members"] });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!data.accessible) throw new Error("Room is not accessible");
      const res = await apiClient.api.v1.rooms[":roomId"].leave.$post({
        param: { roomId: data.room.id },
      });
      if (!res.ok) throw new Error("Failed to leave room");
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      await navigate({ to: "/dashboard" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!data.accessible) throw new Error("Room is not accessible");
      const res = await apiClient.api.v1.rooms[":roomId"].delete.$post({
        param: { roomId: data.room.id },
      });
      if (!res.ok) throw new Error("Failed to delete room");
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      await navigate({ to: "/dashboard" });
    },
  });

  const members = membersQuery.data?.members ?? [];
  const owner = useMemo(
    () => members.find((member) => member.role === "owner"),
    [members],
  );
  const memberLookup = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );
  const transferCandidates = useMemo(
    () => members.filter((member) => member.role !== "owner"),
    [members],
  );
  const activeListeners = useMemo(() => {
    const listeners = Object.values(presenceByUserId).filter((listener) =>
      ["playing", "paused"].includes(listener.state),
    );
    const sorted = listeners.sort((a, b) => {
      if (a.state === b.state) return 0;
      return a.state === "playing" ? -1 : 1;
    });
    return sorted;
  }, [presenceByUserId]);

  useEffect(() => {
    if (!data.accessible) return;
    setPresenceByUserId({});
    setPresenceLoading(true);

    apiClient.api.v1.rooms[":roomId"].presence
      .$get({
        param: { roomId: data.room.id },
      })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as RoomPresenceResponse;
      })
      .then((payload) => {
        if (!payload) return;
        const next: Record<string, RealtimePresenceSnapshot> = {};
        payload.snapshots.forEach((snapshot) => {
          if (["offline", "hidden", "private"].includes(snapshot.state)) return;
          next[snapshot.userId] = {
            ...snapshot,
            syncedAt: snapshot.syncedAt ?? new Date().toISOString(),
          };
        });
        setPresenceByUserId(next);
      })
      .finally(() => {
        setPresenceLoading(false);
      });

    return subscribeToPresence((message: RoomPresenceUpdate) => {
      if (message.roomId !== data.room.id) return;
      const snapshot = message.snapshot;
      setPresenceByUserId((prev) => {
        const next = { ...prev };
        if (["offline", "hidden", "private"].includes(snapshot.state)) {
          delete next[snapshot.userId];
          return next;
        }
        next[snapshot.userId] = {
          ...snapshot,
          syncedAt: snapshot.syncedAt ?? new Date().toISOString(),
        };
        return next;
      });
    });
  }, [data.accessible, data.accessible ? data.room.id : ""]);

  if (!data.accessible) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-10">
        <Card className="w-full border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>{data.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Room
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {data.room.name ?? "Untitled room"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
          <Badge variant={data.room.isOwner ? "default" : "secondary"}>
            {data.room.isOwner ? "Owner" : "Member"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Active listeners</h2>
            <p className="text-sm text-muted-foreground">
              Live presence from this room.
            </p>
          </div>
          {presenceLoading ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Loading active listeners...
            </div>
          ) : activeListeners.length ? (
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              }}
            >
              {activeListeners.map((listener) => {
                const member = memberLookup.get(listener.userId);
                const isPlaying = listener.state === "playing";
                return (
                  <div
                    key={listener.userId}
                    className="flex gap-4 rounded-2xl border border-border/60 bg-background p-4"
                  >
                    <div className="h-16 w-16 overflow-hidden rounded-xl bg-muted/40">
                      {listener.albumArtUrl ? (
                        <img
                          src={listener.albumArtUrl}
                          alt={listener.albumName ?? "Album art"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          No art
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {member?.name ?? "Listener"}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            isPlaying
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                          }
                        >
                          {isPlaying ? "Playing" : "Paused"}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {listener.trackName ?? "Unknown track"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {listener.artistName ?? "Unknown artist"}
                      </div>
                      {listener.spotifyUrl ? (
                        <a
                          className="text-xs font-medium text-foreground hover:underline"
                          href={listener.spotifyUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Spotify
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No one is listening yet.
            </div>
          )}
        </section>

        <div>
          {data.room.isOwner && data.room.inviteToken && (
            <div className="flex gap-1 mb-4">
              <Input
                value={
                  showInvite
                    ? `${window.location.origin}/rooms/join?code=${data.room.inviteToken}`
                    : "************************"
                }
                readOnly
                className="grow"
              />
              <Button
                variant="outline"
                onClick={() => setShowInvite((prev) => !prev)}
              >
                {showInvite ? <Eye /> : <EyeOff />}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${window.location.origin}/rooms/join?code=${data.room.inviteToken}`,
                  )
                }
              >
                <Clipboard />
              </Button>
            </div>
          )}
          <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur mb-4">
            <CardHeader>
              <CardTitle>Room details</CardTitle>
              <CardDescription>Key info about this room.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Owner</span>
                <span className="text-foreground">
                  {owner?.name ?? "Unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Members</span>
                <span className="text-foreground">{members.length}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex rounded-2xl border border-border/60 bg-background p-1 mb-2">
            <Button
              className="flex-1"
              variant={sidebarTab === "members" ? "secondary" : "ghost"}
              onClick={() => setSidebarTab("members")}
            >
              Members
            </Button>
            <Button
              className="flex-1"
              variant={sidebarTab === "actions" ? "secondary" : "ghost"}
              onClick={() => setSidebarTab("actions")}
            >
              Actions
            </Button>
          </div>

          {sidebarTab === "members" ? (
            <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>Everyone in this room.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {membersQuery.isPending ? (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    Loading members...
                  </div>
                ) : members.length ? (
                  members.map((member) => {
                    const presence = presenceByUserId[member.userId];
                    const statusDot =
                      presence?.state === "playing"
                        ? "bg-emerald-500"
                        : presence?.state === "paused"
                          ? "bg-amber-500"
                          : null;
                    return (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between rounded-2xl border border-border/60 bg-background px-4 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.name}</span>
                          {member.role === "owner" ? (
                            <Badge variant="secondary">Owner</Badge>
                          ) : null}
                        </div>
                        {statusDot ? (
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${statusDot}`}
                            aria-hidden
                          />
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No members yet.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Room actions</CardTitle>
                <CardDescription>
                  Actions you can do for this room.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.room.isOwner ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setTransferDialogOpen(true)}
                  >
                    <Crown className="mr-2 h-4 w-4" />
                    Transfer ownership
                  </Button>
                ) : null}
                {!data.room.isOwner ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => leaveMutation.mutate()}
                    disabled={leaveMutation.isPending}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave room
                  </Button>
                ) : null}
                {data.room.isOwner ? (
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete room
                  </Button>
                ) : null}
                <Separator />
                <Button asChild variant="ghost" className="w-full">
                  <Link to="/dashboard">Back to dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership</DialogTitle>
            <DialogDescription>
              Select the member who should own this room next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {transferCandidates.length ? (
              transferCandidates.map((member) => (
                <Button
                  key={member.userId}
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => {
                    setTransferTarget(member);
                    setConfirmDialogOpen(true);
                  }}
                >
                  <span>{member.name}</span>
                  <Crown className="h-4 w-4" />
                </Button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No eligible members yet.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm transfer</DialogTitle>
            <DialogDescription>
              {transferTarget
                ? `Transfer ownership to ${transferTarget.name}?`
                : "Select a member to transfer ownership."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={!transferTarget || transferMutation.isPending}
              onClick={async () => {
                if (!transferTarget) return;
                await transferMutation.mutateAsync(transferTarget.userId);
                setConfirmDialogOpen(false);
                setTransferDialogOpen(false);
                setTransferTarget(null);
              }}
            >
              Confirm transfer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete room</DialogTitle>
            <DialogDescription>
              This will permanently delete the room and remove all members.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                await deleteMutation.mutateAsync();
                setDeleteDialogOpen(false);
              }}
            >
              Delete room
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
