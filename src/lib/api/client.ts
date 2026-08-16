// Low-level HTTP client for the Hotel Harmony Go API (golangserver).
//
// Responsibilities:
//   - Resolve the API base URL from VITE_API_URL.
//   - Attach the JWT access token as `Authorization: Bearer <token>`.
//   - Unwrap the `{ data }` / `{ error }` response envelope (pkg/response).
//   - Transparently refresh the access token once on a 401, then retry.
//
// Token storage lives here (plain localStorage) so this module has no
// dependency on the auth store — that keeps the dependency graph one-way
// (auth store -> client, never the reverse).

import type { Session } from "./types";

// Base URL for the Go API. Empty string => relative, same-origin requests
// (/api/...), which the deploy platform proxies to the backend (no CORS). A
// non-empty value (e.g. http://localhost:8787 in dev) is used as an absolute base.
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

const ACCESS_KEY = "hh_access_token";
const REFRESH_KEY = "hh_refresh_token";

const isBrowser = typeof window !== "undefined";

export function getAccessToken(): string | null {
  return isBrowser ? window.localStorage.getItem(ACCESS_KEY) : null;
}

export function getRefreshToken(): string | null {
  return isBrowser ? window.localStorage.getItem(REFRESH_KEY) : null;
}

/** Uploads a file as multipart/form-data.
 *
 *  Separate from apiFetch because that one JSON-stringifies its body and sets
 *  `Content-Type: application/json`. For multipart the boundary has to be
 *  chosen by the browser, so the header must be left unset — setting it by hand
 *  produces a body the server cannot parse.
 *
 *  No transparent 401 retry here: a FormData body containing a File cannot be
 *  replayed reliably after a token refresh, so a stale session surfaces as an
 *  error the caller handles rather than a silent half-upload. */
export async function apiUpload<T>(
  path: string,
  form: FormData,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const p = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_URL}${p}`, { method: "POST", headers, body: form });

  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) {
    throw new Error(json.error || `upload failed (${res.status})`);
  }
  return json.data as T;
}

/** Downloads a reservation document (ID proof or guest photo) and saves it via
 *  the browser's normal download flow.
 *
 *  A plain `<a href="...">` cannot carry the Authorization header the endpoint
 *  requires, so this fetches the bytes as a blob (with the header attached)
 *  and clicks a throwaway anchor pointed at an object URL — the same pattern
 *  as any other authenticated-file-download flow. The object URL is revoked
 *  right after, so nothing outlives the click. */
export async function downloadReservationDocument(
  reservationId: string,
  docId: string,
  suggestedFilename: string,
): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(
    `${API_URL}/api/reservations/${reservationId}/documents/${docId}/content`,
    { headers },
  );
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || `download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function setTokens(session: Session): void {
  if (!isBrowser) return;
  window.localStorage.setItem(ACCESS_KEY, session.access_token);
  if (session.refresh_token) {
    window.localStorage.setItem(REFRESH_KEY, session.refresh_token);
  }
}

export function clearTokens(): void {
  if (!isBrowser) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  // Internal: prevents infinite refresh recursion.
  _retried?: boolean;
  // Skip the Authorization header (used by the auth endpoints themselves).
  auth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const qs = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) qs.set(k, String(v));
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  // Relative (same-origin) when API_URL is empty; absolute otherwise.
  return `${API_URL}${p}${suffix}`;
}

// Refreshes the access token using the stored refresh token. Returns the new
// access token, or null if refresh is impossible (no token / refresh failed).
async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(buildUrl("/api/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const json = (await res.json()) as { data?: Session };
    if (json.data?.access_token) {
      setTokens(json.data);
      return json.data.access_token;
    }
    clearTokens();
    return null;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true, _retried = false } = opts;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Attempt a single transparent refresh on auth failure.
  if (res.status === 401 && auth && !_retried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, { ...opts, _retried: true });
    }
  }

  let json: { data?: T; error?: string } | null = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON response body.
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, json?.error || res.statusText || "Request failed");
  }

  // Success envelope is { data: ... }; some endpoints may return the value bare.
  return (json && "data" in json ? json.data : (json as unknown)) as T;
}
