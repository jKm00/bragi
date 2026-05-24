import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const session = authClient.useSession();

  const signIn = async () => {
    await authClient.signIn.social({
      provider: "spotify",
      callbackURL: "http://127.0.0.1:5173/dashboard",
    });
  };

  const signOut = async () => {
    await authClient.signOut();
  };

  return (
    <main className="min-h-screen bg-background bg-[radial-gradient(80%_60%_at_15%_0%,rgba(56,189,248,0.12),transparent)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-10 md:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
              Live room presence for Spotify
            </Badge>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-7xl">
              See what your team is listening to, while the app is open.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Bragi keeps room presence, invite flows, and Spotify state in sync.
              Sign in once, create a room, and share an invite link.
            </p>

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
                <Button asChild size="lg" variant="outline">
                  <Link to="/dashboard">Preview dashboard</Link>
                </Button>
              </div>
            )}
          </div>

          <Card className="border-border/60 bg-card/70 shadow-sm backdrop-blur">
            <CardHeader>
              <CardTitle>What Bragi does</CardTitle>
              <CardDescription>
                Auth, rooms, invite links, and presence all in one flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>• Spotify sign-in creates your app identity.</p>
              <p>• Rooms are invite-only and easy to join.</p>
              <p>• Dashboard keeps your active rooms in one place.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
