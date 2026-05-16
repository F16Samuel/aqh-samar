import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { useEscalations, useUsers, useResolveEscalation } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/admin/escalations")({
  component: EscalationsPage,
});

function EscalationsPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "admin") return <Navigate to="/app" />;
  const { data, isLoading } = useEscalations(true);
  const { data: users } = useUsers(true);
  const resolve = useResolveEscalation();

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
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Submitted On</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((e: any) => {
                  const emp = users?.find(u => u.id === e.employee_id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {emp ? emp.full_name : "Unknown"}
                        <div className="text-xs text-muted-foreground">#{e.sheet_id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.type === "automatic" ? "outline" : "default"}>
                          {e.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{e.reason}</TableCell>
                      <TableCell>{e.submitted_at ? new Date(e.submitted_at).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/app/goal-sheets/${e.sheet_id}`}>Review</Link>
                          </Button>
                          {e.type === "formal" && (
                            <Button 
                              size="sm" 
                              onClick={() => resolve.mutate(e.id)}
                              disabled={resolve.isPending}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
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
