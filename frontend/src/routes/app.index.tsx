import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import {
  useActiveCycle,
  useMyGoalSheets,
  useTeam,
  useEscalations,
  useCompletionReport,
} from "@/hooks/api";
import { KpiCard } from "@/components/charts/KpiCard";
import { RadialProgress } from "@/components/charts/RadialProgress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  CheckCircle2,
  Users,
  AlertTriangle,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { format } from "date-fns";
import { SheetStatusBadge } from "@/components/goals/SheetStatusBadge";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="text-2xl font-semibold tracking-tight">{me.full_name}</h1>
      </header>
      {me.role === "employee" && <EmployeeDashboard />}
      {me.role === "manager" && <ManagerDashboard />}
      {me.role === "admin" && <AdminDashboard />}
    </div>
  );
}

function CycleCard() {
  const { data, isLoading } = useActiveCycle();
  if (isLoading) return <Skeleton className="h-24" />;
  if (!data)
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">No active cycle configured yet.</p>
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Active cycle</CardTitle>
        <CardDescription>
          {data.year} · {data.phase}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Calendar className="h-8 w-8 text-primary" />
        <div className="text-sm">
          <p>
            <span className="text-muted-foreground">Window open:</span>{" "}
            {safeDate(data.window_open)}
          </p>
          <p>
            <span className="text-muted-foreground">Window close:</span>{" "}
            {safeDate(data.window_close)}
          </p>
        </div>
        <Badge variant={data.is_active ? "default" : "secondary"} className="ml-auto">
          {data.is_active ? "Open" : "Closed"}
        </Badge>
      </CardContent>
    </Card>
  );
}

function safeDate(d?: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd MMM yyyy");
  } catch {
    return d;
  }
}

function EmployeeDashboard() {
  const { data: sheets, isLoading } = useMyGoalSheets();
  const sheetCount = sheets?.length ?? 0;
  const approved = sheets?.filter((s) => String(s.status).toLowerCase() === "approved").length ?? 0;
  const draft = sheets?.filter((s) => String(s.status).toLowerCase() === "draft").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Goal sheets" value={isLoading ? "—" : sheetCount} icon={Target} tone="primary" />
        <KpiCard label="Approved" value={isLoading ? "—" : approved} icon={CheckCircle2} tone="success" />
        <KpiCard label="In draft" value={isLoading ? "—" : draft} icon={Target} />
        <KpiCard label="Role" value="Employee" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <CycleCard />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent goal sheets</CardTitle>
              <CardDescription>Your latest draft, submitted and approved sheets.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-20" />
              ) : sheetCount === 0 ? (
                <EmptyState
                  title="No goal sheets yet"
                  description="Start by creating a draft sheet for the active cycle."
                />
              ) : (
                <ul className="divide-y divide-border/60">
                  {sheets!.slice(0, 5).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">Sheet · {s.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          Cycle {String(s.cycle_id).slice(0, 8)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <SheetStatusBadge status={s.status} />
                        <Link
                          to="/app/goal-sheets/$sheetId"
                          params={{ sheetId: s.id }}
                          className="text-sm text-primary inline-flex items-center gap-1"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval rate</CardTitle>
            <CardDescription>Approved sheets / total sheets</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <RadialProgress value={sheetCount ? approved / sheetCount : 0} label="approved" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ManagerDashboard() {
  const me = useAuthStore((s) => s.profile);
  const { data: team, isLoading } = useTeam(me?.id);
  const size = team?.length ?? 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Team size" value={isLoading ? "—" : size} icon={Users} tone="primary" />
        <KpiCard label="Pending reviews" value="—" icon={Target} hint="Open team to view" />
        <KpiCard label="Check-ins this Q" value="—" icon={CheckCircle2} tone="success" />
        <KpiCard label="Role" value="Manager" />
      </div>
      <CycleCard />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your team</CardTitle>
          <CardDescription>Direct reports from /users/{me?.id}/team</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20" />
          ) : size === 0 ? (
            <EmptyState title="No direct reports" />
          ) : (
            <ul className="divide-y divide-border/60">
              {team!.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant="outline">{u.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDashboard() {
  const { data: esc, isLoading: escLoading } = useEscalations();
  const { data: report, isLoading: repLoading } = useCompletionReport({});
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Escalations"
          value={escLoading ? "—" : (esc?.length ?? 0)}
          icon={AlertTriangle}
          tone="warning"
        />
        <KpiCard label="Active cycle" value="See top bar" icon={Calendar} />
        <KpiCard label="Reports" value="Live" icon={CheckCircle2} tone="success" />
        <KpiCard label="Role" value="Admin" />
      </div>
      <CycleCard />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escalations</CardTitle>
            <CardDescription>Stalled goal sheets from /admin/escalations</CardDescription>
          </CardHeader>
          <CardContent>
            {escLoading ? (
              <Skeleton className="h-24" />
            ) : !esc || esc.length === 0 ? (
              <EmptyState title="No escalations" description="Everyone is on track." />
            ) : (
              <ul className="space-y-2">
                {esc.slice(0, 6).map((e, i) => (
                  <li key={i} className="rounded-md border border-border/60 p-3 text-sm">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
                      {JSON.stringify(e, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completion snapshot</CardTitle>
            <CardDescription>From /reports/completion</CardDescription>
          </CardHeader>
          <CardContent>
            {repLoading ? (
              <Skeleton className="h-24" />
            ) : !report ? (
              <EmptyState title="No data yet" />
            ) : (
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(report, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
