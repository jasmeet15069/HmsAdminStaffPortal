import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarCheck,
  Hotel,
  Sparkles,
  TrendingUp,
  Receipt,
  Boxes,
  UtensilsCrossed,
  ShoppingCart,
  Wrench,
  Users,
  Globe2,
  Calendar,
  BarChart3,
  Moon,
  Building2,
  ShieldCheck,
  Settings,
  Bell,
  Search,
  ChevronDown,
  LogIn,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useMHMS } from "@/lib/mhms-store";
import { useAuth, isAuthenticated } from "@/lib/api/auth";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/reservations", label: "Reservations", icon: CalendarCheck },
  { to: "/pos", label: "POS & Restaurant", icon: UtensilsCrossed },
  { to: "/front-desk", label: "Front Desk", icon: Hotel },
  { to: "/housekeeping", label: "Housekeeping", icon: Sparkles },
  { to: "/revenue", label: "Revenue Mgmt", icon: TrendingUp },
  { to: "/billing", label: "Billing & Finance", icon: Receipt },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/procurement", label: "Procurement", icon: ShoppingCart },
  { to: "/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/crm", label: "CRM & Loyalty", icon: Users },
  { to: "/channel-manager", label: "Channel Manager", icon: Globe2 },
  { to: "/booking-engine", label: "Booking Engine", icon: Calendar },
  { to: "/reports", label: "Reports & Analytics", icon: BarChart3 },
  { to: "/night-audit", label: "Night Audit", icon: Moon },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/users", label: "Users & Roles", icon: ShieldCheck },
  { to: "/admin", label: "System Admin", icon: Settings },
] as const;

export default function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { properties, currentProperty, setProperty } = useMHMS();
  const current = properties.find((p) => p.id === currentProperty) ?? properties[0];

  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  // Avoid SSR/hydration mismatch: auth state lives in localStorage and is only
  // known after mount. Until then, render the neutral (signed-out) label.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const authedUser = mounted ? user : null;

  // Auth guard: redirect unauthenticated users to /login; redirect authenticated
  // users away from /login. Only runs client-side (after mount) to avoid SSR mismatch.
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated() && path !== "/login") {
      navigate({ to: "/login" });
    } else if (isAuthenticated() && path === "/login") {
      navigate({ to: "/" });
    }
  }, [mounted, path, navigate]);

  const displayName = authedUser?.email ?? "Guest";
  const initials =
    (authedUser?.email ?? "G")
      .replace(/@.*/, "")
      .split(/[.\-_]/)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "G";

  // The login route renders its own full-screen layout — no app chrome.
  if (path === "/login") {
    return (
      <>
        <Outlet />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  // While auth state is loading (pre-mount), don't flash the full portal.
  if (!mounted || !isAuthenticated()) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-[260px] shrink-0 bg-sidebar text-sidebar-foreground flex flex-col fixed inset-y-0 left-0">
        <div className="h-16 px-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="size-8 rounded-md bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">
            M
          </div>
          <div>
            <div className="font-display font-semibold leading-tight">MHMS</div>
            <div className="text-[11px] text-sidebar-foreground/60">Hotel Suite</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/85"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border text-[11px] text-sidebar-foreground/60">
          v2.0 · Enterprise
        </div>
      </aside>

      <div className="flex-1 ml-[260px] flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-30 bg-card/80 backdrop-blur border-b flex items-center gap-3 px-6">
          {/* Left — property selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 shrink-0">
                <Building2 className="size-4" />
                <span className="font-medium hidden sm:inline">{current?.name}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Switch Property</DropdownMenuLabel>
              {properties.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => {
                    setProperty(p.id);
                    toast.success(`Switched to ${p.name}`);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.city} · {p.rooms} rooms
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Centre — search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search guests, reservations, rooms…"
              className="pl-9 h-9 bg-background"
            />
          </div>

          {/* Right — notifications + profile pushed to far right */}
          <div className="ml-auto flex items-center gap-1 border-l pl-4">
            {/* Notification bell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative size-9">
                  <Bell className="size-[18px]" />
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-card" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  Notifications
                  <Badge variant="secondary" className="text-[10px]">3 new</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[
                  { icon: "🛎️", title: "Room 204 — Early check-in request", time: "2 min ago" },
                  { icon: "⚠️", title: "Maintenance ticket #14 overdue", time: "18 min ago" },
                  { icon: "💳", title: "Folio balance unsettled — Mr. Sharma", time: "1 hr ago" },
                ].map((n) => (
                  <DropdownMenuItem key={n.title} className="flex items-start gap-2.5 py-2.5">
                    <span className="text-base mt-px">{n.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug">{n.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="justify-center text-xs text-muted-foreground">
                  View all notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Vertical divider */}
            <div className="w-px h-6 bg-border mx-1" />

            {/* Profile avatar */}
            {authedUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start leading-tight">
                      <span className="text-xs font-semibold truncate max-w-[120px]">
                        {(authedUser.email ?? "Guest").replace(/@.*/, "")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Admin</span>
                    </div>
                    <ChevronDown className="size-3.5 opacity-50 hidden md:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="font-medium">{(authedUser.email ?? "Guest").replace(/@.*/, "")}</span>
                    <span className="text-xs text-muted-foreground font-normal truncate">{authedUser.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Preferences</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={async () => {
                      await signOut();
                      toast.success("Signed out");
                      navigate({ to: "/login" });
                    }}
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => navigate({ to: "/login" })}
              >
                <LogIn className="size-4" /> Sign in
              </Button>
            )}
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "success" | "warning" | "info" | "destructive";
}) {
  const toneCls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning-foreground"
        : tone === "destructive"
          ? "text-destructive"
          : tone === "info"
            ? "text-info"
            : "";
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-2xl font-semibold font-display mt-1 ${toneCls}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
