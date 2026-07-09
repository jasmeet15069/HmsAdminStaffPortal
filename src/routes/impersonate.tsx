import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import { useAuth } from "@/lib/api/auth";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/impersonate")({
  head: () => ({ meta: [{ title: "Signing in · MHMS" }] }),
  component: ImpersonatePage,
});

function ImpersonatePage() {
  const navigate = useNavigate();
  const exchangeImpersonationTicket = useAuth((s) => s.exchangeImpersonationTicket);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const ticket = new URLSearchParams(window.location.search).get("ticket");
    if (!ticket) {
      setError("Missing impersonation ticket.");
      return;
    }
    exchangeImpersonationTicket(ticket)
      .then(() => navigate({ to: "/" }))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "This link is invalid or has expired.");
      });
  }, [exchangeImpersonationTicket, navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <Card className="w-full max-w-sm p-8 text-center">
        {error ? (
          <>
            <div className="size-12 rounded-xl bg-destructive/10 text-destructive grid place-items-center mb-3 mx-auto">
              <ShieldAlert className="size-6" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Sign-in link failed</h1>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <a href="/login" className="text-sm text-primary underline mt-4 inline-block">
              Go to sign in
            </a>
          </>
        ) : (
          <>
            <Loader2 className="size-6 animate-spin mx-auto mb-3" />
            <h1 className="text-lg font-semibold tracking-tight">Signing you in…</h1>
            <p className="text-sm text-muted-foreground mt-1">One moment while we verify your access.</p>
          </>
        )}
      </Card>
    </div>
  );
}
