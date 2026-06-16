// Authentication store + helpers for the Hotel Harmony API.
//
// Tokens are persisted by the HTTP client (localStorage); this store persists
// the public-safe user profile so the UI can render the signed-in state across
// reloads without an extra round-trip.

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiFetch, clearTokens, getAccessToken, setTokens } from "./client";
import type { Session, SessionUser } from "./types";

interface AuthState {
  user: SessionUser | null;
  status: "idle" | "loading" | "error";
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      status: "idle",
      error: null,
      signIn: async (email, password) => {
        set({ status: "loading", error: null });
        try {
          const session = await apiFetch<Session>("/api/auth/sign-in", {
            method: "POST",
            body: { email, password },
            auth: false,
          });
          setTokens(session);
          set({ user: session.user, status: "idle", error: null });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Sign in failed";
          set({ status: "error", error: message });
          throw err;
        }
      },
      signOut: async () => {
        try {
          await apiFetch("/api/auth/sign-out", { method: "POST" });
        } catch {
          // Best-effort; clear local state regardless.
        }
        clearTokens();
        set({ user: null, status: "idle", error: null });
      },
    }),
    { name: "hh-auth", partialize: (s) => ({ user: s.user }) },
  ),
);

// True when we hold both a persisted user and an access token. Read this only
// on the client (it touches localStorage via getAccessToken).
export function isAuthenticated(): boolean {
  return !!getAccessToken() && !!useAuth.getState().user;
}
