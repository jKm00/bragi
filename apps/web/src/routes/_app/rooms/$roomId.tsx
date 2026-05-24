import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { apiClient } from "../../../lib/api-client";

type RoomAccessResponse =
  | { room: { id: string; name: string | null }; accessible: true }
  | { accessible: false; message: string };

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
  const data = Route.useLoaderData();

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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-10">
      <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle className="text-3xl">
            {data.room.name ?? "Untitled room"}
          </CardTitle>
          <CardDescription>
            Room presence and active listeners will live here.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
