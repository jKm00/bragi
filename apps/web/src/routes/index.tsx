import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  component: LandingPage,
});

function LandingPage() {
  const session = authClient.useSession();
  const { redirect, code } = Route.useSearch();

  const signIn = async () => {
    await authClient.signIn.social({
      provider: "spotify",
      callbackURL:
        redirect === "join" && code
          ? `http://127.0.0.1:5173/rooms/join?code=${code}`
          : "http://127.0.0.1:5173/dashboard",
    });
  };

  const signOut = async () => {
    await authClient.signOut();
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-4 py-10 md:px-6">
        <div className="space-y-4">
          <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
            Live Spotify rooms
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            See what your team is listening to.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
            Bragi keeps room presence in sync while the app is open.
          </p>
        </div>

        {redirect === "join" && code ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            Sign in with Spotify to join this room.
          </div>
        ) : null}

        {session.data?.session ? (
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
            <Button onClick={signOut} size="lg" variant="outline">
              Log out
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button onClick={signIn} size="lg">
              Sign in with Spotify
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
