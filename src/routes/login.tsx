import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Hotel, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · MHMS" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, status, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
      navigate({ to: "/" });
    } catch {
      // Error surfaced via the store's `error` field below.
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="size-12 rounded-xl bg-primary text-primary-foreground grid place-items-center mb-3">
            <Hotel className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">MHMS Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to the Hotel Harmony console</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@hotel.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={status === "loading"}>
            {status === "loading" && <Loader2 className="size-4 animate-spin" />}
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
