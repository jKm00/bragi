import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  return (
    <main>
      <h1>Login</h1>
      <p>Spotify sign-in will live here.</p>
      <Link to="/dashboard">Continue to dashboard</Link>
    </main>
  );
}
