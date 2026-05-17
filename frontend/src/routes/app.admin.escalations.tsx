import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { useEscalations, useUsers } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { differenceInDays } from "date-fns";

export const Route = createFileRoute("/app/admin/escalations")({
  component: EscalationsPage,
});

function EscalationsPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "admin") return <Navigate to="/app" />;
  const { data, isLoading } = useEscalations(true);
  const { data: users } = useUsers(true);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Escalations</h1>
        <p className="text-sm text-muted-foreground">Stalled sheets and overdue actions.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All escalations</CardTitle>
          <CardDescription>From /admin/escalations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : !data?.length ? (
            <EmptyState title="Nothing escalated" description="No stalled sheets at the moment." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Submitted On</TableHead>
                  <TableHead>Days Escalated</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((e: any) => {
                  const emp = users?.find(u => u.id === e.employee_id);
                  const mgr = users?.find(u => u.id === emp?.manager_id);
                  const days = differenceInDays(new Date(), new Date(e.submitted_at));
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{emp ? emp.full_name : e.employee_id}</TableCell>
                      <TableCell>{mgr ? mgr.full_name : "None"}</TableCell>
                      <TableCell>{new Date(e.submitted_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-destructive font-medium">{days} days</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/app/goal-sheets/${e.id}`}>Review Sheet</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
