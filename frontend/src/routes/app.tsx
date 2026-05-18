import { createFileRoute, Outlet, Navigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { useMe } from "@/hooks/api";
import { useActiveCycle } from "@/hooks/api";
import {
  LayoutDashboard,
  Target,
  CheckSquare,
  Users,
  Settings,
  FileBarChart,
  LogOut,
  Calendar,
  AlertTriangle,
  Share2,
  Unlock,
  ListChecks,
  Cpu,
  Mail,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/constants/rbac";
import type { Role } from "@/types/api";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const session = useAuthStore((s) => s.session);
  const { data: me, isLoading, error } = useMe();
  const setProfile = useAuthStore((s) => s.setProfile);

  useEffect(() => {
    if (me) setProfile(me);
  }, [me, setProfile]);

  if (!bootstrapped) {
    return <FullScreenLoader />;
  }
  if (!session) return <Navigate to="/login" />;
  if (isLoading) return <FullScreenLoader />;
  if (error || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-lg font-semibold">Couldn't load your profile</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The backend may be unreachable. Check that <code>VITE_API_BASE_URL</code> is correct
            and CORS allows this origin.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar role={me.role} fullName={me.full_name} email={me.email} jobTitle={me.job_title} />
        <div className="flex flex-1 flex-col">
          <Topbar />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="mx-auto h-4 w-64" />
      </div>
    </div>
  );
}

function Topbar() {
  const { data: cycle } = useActiveCycle();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur md:px-6">
      <SidebarTrigger />
      <div className="hidden text-sm font-medium md:block">AQH-SAMAR</div>
      <div className="ml-auto flex items-center gap-2">
        {cycle ? (
          <Badge variant={cycle.is_active ? "default" : "secondary"} className="gap-1">
            <Calendar className="h-3 w-3" /> {cycle.year} · {cycle.phase}
          </Badge>
        ) : (
          <Badge variant="outline">No active cycle</Badge>
        )}
      </div>
    </header>
  );
}

interface NavItem {
  title: string;
  url: string;
  icon: typeof Target;
  roles?: Role[];
}

function navFor(role: Role): { label: string; items: NavItem[] }[] {
  const groups: { label: string; items: NavItem[] }[] = [];

  if (role === "employee") {
    groups.push({
      label: "My Performance",
      items: [
        { title: "Dashboard", url: "/app/", icon: LayoutDashboard },
        { title: "Goal Sheets", url: "/app/goal-sheets/", icon: Target },
        { title: "Achievements", url: "/app/achievements", icon: CheckSquare },
      ],
    });
  } else if (role === "manager") {
    groups.push({
      label: "My Performance",
      items: [
        { title: "Dashboard", url: "/app/", icon: LayoutDashboard },
        { title: "Goal Sheets", url: "/app/goal-sheets/", icon: Target },
        { title: "Achievements", url: "/app/achievements", icon: CheckSquare },
      ],
    });
    groups.push({
      label: "Team Management",
      items: [
        { title: "Team Dashboard", url: "/app/team", icon: Users },
        { title: "Review Goal Sheets", url: "/app/team-sheets", icon: ListChecks },
      ],
    });
  } else if (role === "admin") {
    groups.push({
      label: "Executive Overview",
      items: [
        { title: "Main Dashboard", url: "/app/", icon: LayoutDashboard },
        { title: "Progress Tracker", url: "/app/admin/progress", icon: FileBarChart },
      ],
    });
    groups.push({
      label: "Core Administration",
      items: [
        { title: "Cycles & Timelines", url: "/app/admin/cycles", icon: Calendar },
        { title: "User Directory", url: "/app/admin/users", icon: Users },
        { title: "Shared KPIs", url: "/app/admin/shared-goals", icon: Share2 },
        { title: "All Goal Sheets", url: "/app/team-sheets", icon: ListChecks },
      ],
    });
    groups.push({
      label: "Compliance & Ops",
      items: [
        { title: "SLA Automations", url: "/app/admin/automation", icon: Cpu },
        { title: "Active Escalations", url: "/app/admin/escalations", icon: AlertTriangle },
        { title: "Goal Unlocks", url: "/app/admin/unlock", icon: Unlock },
        { title: "System Audit Logs", url: "/app/admin/audit", icon: Settings },
      ],
    });
  }

  // Common Sections
  if (role !== "admin") {
    groups.push({
      label: "Insights",
      items: [{ title: "Analytics & Reports", url: "/app/reports", icon: FileBarChart }],
    });
  } else {
    groups.push({
      label: "Data & Exports",
      items: [{ title: "Standard Reports", url: "/app/reports", icon: FileBarChart }],
    });
  }

  groups.push({
    label: "Messaging",
    items: [{ title: "Notification Hub", url: "/app/notifications", icon: Mail }],
  });

  return groups;
}

function AppSidebar({ role, fullName, email, jobTitle }: { role: Role; fullName: string; email: string; jobTitle?: string | null }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const groups = navFor(role);
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ListChecks className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">AQH-SAMAR</p>
            <p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => {
                  const active = it.url === "/app" ? path === "/app" : path.startsWith(it.url);
                  return (
                    <SidebarMenuItem key={it.url}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={it.url} className="flex items-center gap-2">
                          <it.icon className="h-4 w-4" />
                          <span>{it.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="space-y-2 px-2 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{fullName}</p>
            {jobTitle && (
              <p className="truncate text-xs font-semibold text-primary">{jobTitle}</p>
            )}
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
