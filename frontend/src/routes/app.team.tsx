import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { useTeam, useCompletionReport, useActiveCycle } from "@/hooks/api";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/team")({
  component: TeamPage,
});

function TeamPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "manager" && me.role !== "admin") return <Navigate to="/app" />;
  const { data, isLoading } = useTeam(me.id);
  const { data: cycle } = useActiveCycle();
  const { data: completion, isLoading: isCompletionLoading } = useCompletionReport({ cycle_id: cycle?.id }, true);
  
  const pendingApprovals = completion?.filter((c: any) => c.sheet_status === "submitted" && c.manager_name === me.full_name) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">Direct reports and their goal status.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Direct reports</CardTitle>
          <CardDescription>From /users/{me.id}/team</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : !data?.length ? (
            <EmptyState title="No direct reports" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-amber-600">Pending Approvals</CardTitle>
          <CardDescription>Goal sheets awaiting your review.</CardDescription>
        </CardHeader>
        <CardContent>
          {isCompletionLoading ? <Skeleton className="h-32" /> : !pendingApprovals.length ? (
            <EmptyState title="All caught up" description="No goal sheets are currently awaiting your approval." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Submitted On</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.map((p: any) => (
                  <TableRow key={p.employee_id}>
                    <TableCell className="font-medium">{p.employee_name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.last_checkin_at ? new Date(p.last_checkin_at).toLocaleDateString() : "Recently"}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/app/goal-sheets">Go to Sheets</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
