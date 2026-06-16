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
  RotateCw,
  LogIn,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useMHMS } from "@/lib/mhms-store";
import { useAuth } from "@/lib/api/auth";
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
  { to: "/front-desk", label: "Front Desk", icon: Hotel },
  { to: "/housekeeping", label: "Housekeeping", icon: Sparkles },
  { to: "/revenue", label: "Revenue Mgmt", icon: TrendingUp },
  { to: "/billing", label: "Billing & Finance", icon: Receipt },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/pos", label: "POS & Restaurant", icon: UtensilsCrossed },
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
  const { properties, currentProperty, setProperty, resetData } = useMHMS();
  const current = properties.find((p) => p.id === currentProperty) ?? properties[0];

  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  // Avoid SSR/hydration mismatch: auth state lives in localStorage and is only
  // known after mount. Until then, render the neutral (signed-out) label.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const authedUser = mounted ? user : null;

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Building2 className="size-4" />
                <span className="font-medium">{current?.name}</span>
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
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search guests, reservations, rooms…"
              className="pl-9 h-9 bg-background"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetData();
              toast.success("Demo data reset");
            }}
            className="gap-2"
          >
            <RotateCw className="size-4" /> Reset
          </Button>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-5" />
            <Badge className="absolute -top-1 -right-1 size-4 p-0 grid place-items-center text-[10px]">
              3
            </Badge>
          </Button>
          {authedUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="max-w-[200px] truncate">
                  {displayName}
                </DropdownMenuLabel>
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Preferences</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
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
