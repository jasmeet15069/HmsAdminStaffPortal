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
  BookOpen,
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
  ConciergeBell,
  Briefcase,
  ClipboardList,
  Share2,
  Landmark,
  Cog,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type Notif = { id: string; icon: string; title: string; body: string; time: string; read: boolean; category: string };

const INITIAL_NOTIFS: Notif[] = [
  { id: "n1",  icon: "🛎️", category: "Front Desk",   title: "Early check-in request",       body: "Room 204 — guest requesting check-in at 10 AM.",          time: "2 min ago",  read: false },
  { id: "n2",  icon: "⚠️", category: "Maintenance",  title: "Work order #14 overdue",        body: "AC repair in Room 312 — assigned to Rajesh, SLA breached.", time: "18 min ago", read: false },
  { id: "n3",  icon: "💳", category: "Billing",       title: "Unsettled folio",               body: "Mr. Sharma (Room 506) has a pending balance of ₹4,200.",   time: "1 hr ago",   read: false },
  { id: "n4",  icon: "🍽️", category: "POS",           title: "KOT overdue — T-07",            body: "Table T-07 order has been in kitchen for 22 minutes.",     time: "1 hr ago",   read: true  },
  { id: "n5",  icon: "🏨", category: "Housekeeping",  title: "6 rooms still dirty",           body: "Floors 3 & 4 have pending cleaning — checkout at 11 AM.",  time: "2 hrs ago",  read: true  },
  { id: "n6",  icon: "📦", category: "Inventory",     title: "Low stock alert",               body: "Towels (Bath) stock at 12 units — reorder threshold is 20.", time: "3 hrs ago", read: true  },
  { id: "n7",  icon: "👤", category: "CRM",           title: "VIP arrival tomorrow",          body: "Mr. Kapoor (Platinum) arriving 2026-06-18. Preferences: King bed, high floor.", time: "5 hrs ago", read: true },
  { id: "n8",  icon: "📋", category: "Night Audit",   title: "Audit report ready",            body: "Night audit for 2026-06-16 has been completed and signed off.", time: "8 hrs ago", read: true },
];

type NavLeaf = { to: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; icon: typeof LayoutDashboard; children: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;

const nav: NavEntry[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Front Office",
    icon: Briefcase,
    children: [
      { to: "/reservations", label: "Reservations", icon: CalendarCheck },
      { to: "/front-desk", label: "Front Desk", icon: Hotel },
      { to: "/crm", label: "CRM & Loyalty", icon: Users },
    ],
  },
  {
    label: "Restaurant",
    icon: UtensilsCrossed,
    children: [
      { to: "/pos", label: "POS System", icon: UtensilsCrossed },
      { to: "/restaurant", label: "Restaurant Mgmt", icon: ConciergeBell },
      { to: "/menu-management", label: "Menu Management", icon: BookOpen },
    ],
  },
  {
    label: "Operations",
    icon: ClipboardList,
    children: [
      { to: "/housekeeping", label: "Housekeeping", icon: Sparkles },
      { to: "/maintenance", label: "Maintenance", icon: Wrench },
      { to: "/inventory", label: "Inventory", icon: Boxes },
      { to: "/procurement", label: "Procurement", icon: ShoppingCart },
    ],
  },
  {
    label: "Distribution",
    icon: Share2,
    children: [
      { to: "/booking-engine", label: "Booking Engine", icon: Calendar },
      { to: "/channel-manager", label: "Channel Manager", icon: Globe2 },
      { to: "/revenue", label: "Revenue Mgmt", icon: TrendingUp },
    ],
  },
  {
    label: "Finance",
    icon: Landmark,
    children: [
      { to: "/billing", label: "Billing & Finance", icon: Receipt },
      { to: "/night-audit", label: "Night Audit", icon: Moon },
      { to: "/reports", label: "Reports & Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Administration",
    icon: Cog,
    children: [
      { to: "/properties", label: "Properties", icon: Building2 },
      { to: "/users", label: "Users & Roles", icon: ShieldCheck },
      { to: "/admin", label: "System Admin", icon: Settings },
    ],
  },
];

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
  const [notifOpen, setNotifOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS);
  const unreadCount = notifs.filter((n) => !n.read).length;
  const markAllRead = () => setNotifs((p) => p.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifs((p) => p.map((n) => n.id === id ? { ...n, read: true } : n));
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
        <nav className="sidebar-scroll flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {nav.map((n) => {
            // Grouped (collapsible) section, e.g. Restaurant → POS / Mgmt / Menu.
            if ("children" in n) {
              const Icon = n.icon;
              const childActive = n.children.some((c) => path.startsWith(c.to));
              const expanded = openGroups[n.label] ?? childActive;
              return (
                <div key={n.label}>
                  <button
                    onClick={() => setOpenGroups((p) => ({ ...p, [n.label]: !(p[n.label] ?? childActive) }))}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      childActive
                        ? "text-sidebar-foreground font-medium"
                        : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/85"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate flex-1 text-left">{n.label}</span>
                    <ChevronDown className={`size-3.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
                      {n.children.map((c) => {
                        const CIcon = c.icon;
                        const active = path.startsWith(c.to);
                        return (
                          <Link
                            key={c.to}
                            to={c.to}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                              active
                                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/85"
                            }`}
                          >
                            <CIcon className="size-4 shrink-0" />
                            <span className="truncate">{c.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            // Leaf link.
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
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-card" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  Notifications
                  {unreadCount > 0 && <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifs.filter((n) => !n.read).slice(0, 3).map((n) => (
                  <DropdownMenuItem key={n.id} className="flex items-start gap-2.5 py-2.5" onClick={() => markRead(n.id)}>
                    <span className="text-base mt-px shrink-0">{n.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug">{n.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                    <span className="size-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  </DropdownMenuItem>
                ))}
                {unreadCount === 0 && (
                  <div className="py-6 text-center text-xs text-muted-foreground">All caught up!</div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="justify-center text-xs font-medium text-primary hover:text-primary focus:text-primary"
                  onClick={(e) => { e.preventDefault(); setNotifOpen(true); }}
                >
                  View all notifications →
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

      {/* All Notifications Sheet */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">All Notifications</SheetTitle>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7 text-primary" onClick={markAllRead}>
                  Mark all as read
                </Button>
              )}
            </div>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">{unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}</p>
            )}
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="divide-y">
              {notifs.map((n) => (
                <button
                  key={n.id}
                  className={`w-full flex items-start gap-3 px-6 py-4 text-left transition-colors hover:bg-accent/50 ${n.read ? "opacity-70" : "bg-primary/[0.03]"}`}
                  onClick={() => markRead(n.id)}
                >
                  <span className="text-xl shrink-0 mt-0.5">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${n.read ? "font-normal" : "font-semibold"}`}>{n.title}</p>
                      {!n.read && <span className="size-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.body}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{n.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{n.time}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          <div className="px-6 py-3 border-t shrink-0">
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setNotifs([]); setNotifOpen(false); }}>
              Clear all notifications
            </Button>
          </div>
        </SheetContent>
      </Sheet>
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
