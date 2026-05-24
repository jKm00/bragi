import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const signIn = async () => {
    await authClient.signIn.social({
      provider: "spotify",
      callbackURL: "http://127.0.0.1:5173/dashboard",
    });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">Bragi</h1>
        <p className="mt-3 max-w-xl text-base text-slate-600">
          See what coworkers are listening to while the app is open.
        </p>
      </div>
      <button
        className="w-fit rounded-full bg-black px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
        onClick={signIn}
        type="button"
      >
        Sign in with Spotify
      </button>
    </main>
  );
}
