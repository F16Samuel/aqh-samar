import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { useCompletionReport, useActiveCycle } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Target, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";

export const Route = createFileRoute("/app/admin/progress")({
  component: ProgressTrackerPage,
});

function ProgressTrackerPage() {
  const me = useAuthStore((s) => s.profile);
  const isAdmin = me?.role === "admin";

  const { data: cycle } = useActiveCycle();
  const { data: completion, isLoading } = useCompletionReport(
    { cycle_id: cycle?.id },
    isAdmin
  );

  if (!me) return null;
  if (!isAdmin) return <Navigate to="/app" />;

  // Group completion data by manager
  const managerStats = (completion || []).reduce((acc: any, row: any) => {
    const managerId = row.manager_id;
    if (!managerId) return acc; // Skip users without a manager

    if (!acc[managerId]) {
      acc[managerId] = {
        manager_id: managerId,
        manager_name: row.manager_name || "Unknown Manager",
        team_size: 0,
        pending_checkins: 0,
        pending_reviews: 0,
        completed_checkins: 0,
      };
    }

    acc[managerId].team_size += 1;
    acc[managerId].pending_checkins += (row.checkins_pending || 0);
    acc[managerId].completed_checkins += (row.checkins_completed || 0);
    if (row.sheet_status === "submitted") {
      acc[managerId].pending_reviews += 1;
    }

    return acc;
  }, {});

  const statsList = Object.values(managerStats).sort((a: any, b: any) => {
    // Sort by most pending items first
    return (b.pending_checkins + b.pending_reviews) - (a.pending_checkins + a.pending_reviews);
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Progress Tracker</h1>
        <p className="text-sm text-muted-foreground">Monitor manager performance and team progress.</p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : statsList.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState title="No manager data available" description="Ensure teams are set up and assigned to managers." />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {statsList.map((stat: any) => (
            <Card key={stat.manager_id} className="overflow-hidden border-border/50 transition-all hover:border-border">
              <div className="flex flex-col sm:flex-row">
                <div className="flex w-full flex-col justify-center border-b border-border/50 bg-muted/20 p-5 sm:w-1/3 sm:border-b-0 sm:border-r">
                  <h3 className="font-semibold text-lg">{stat.manager_name}</h3>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{stat.team_size} Direct Reports</span>
                  </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-4 p-5 sm:w-2/3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-primary" />
                      Pending Reviews
                    </p>
                    <p className="text-2xl font-bold">
                      {stat.pending_reviews > 0 ? (
                        <span className="text-amber-500">{stat.pending_reviews}</span>
                      ) : (
                        <span className="text-emerald-500 flex items-center gap-2">0 <CheckCircle2 className="h-4 w-4" /></span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      Team Pending Check-ins
                    </p>
                    <p className="text-2xl font-bold">
                      {stat.pending_checkins > 0 ? (
                        <span className="text-destructive">{stat.pending_checkins}</span>
                      ) : (
                        <span className="text-emerald-500 flex items-center gap-2">0 <CheckCircle2 className="h-4 w-4" /></span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Team Completed
                    </p>
                    <p className="text-2xl font-bold">{stat.completed_checkins}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
