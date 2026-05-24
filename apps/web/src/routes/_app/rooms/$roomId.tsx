import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Crown, LogOut, Trash2 } from "lucide-react";
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

type RoomAccessResponse =
  | {
      room: {
        id: string;
        name: string | null;
        isOwner: boolean;
        role: "owner" | "member";
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
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
      const res = await apiClient.api.v1.rooms[":roomId"].transfer[":userId"].$post({
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
  const transferCandidates = useMemo(
    () => members.filter((member) => member.role !== "owner"),
    [members],
  );

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

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Active people in this room.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {membersQuery.isPending ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                Loading members...
              </div>
            ) : members.length ? (
              members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-background px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{member.name}</span>
                      {member.role === "owner" ? (
                        <Badge variant="secondary">Owner</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No active members yet.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader>
              <CardTitle>Room actions</CardTitle>
              <CardDescription>Actions you can do for this room.</CardDescription>
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

          {owner ? (
            <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Owner controls
                </CardTitle>
                <CardDescription>
                  Current owner: {owner.name}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}
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
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
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
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
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
