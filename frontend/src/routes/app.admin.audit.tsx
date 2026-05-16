import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { useAuditLogs } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/app/admin/audit")({
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const me = useAuthStore((s) => s.profile);
  const isAdmin = me?.role === "admin";
  const { data: logs, isLoading } = useAuditLogs(isAdmin);

  if (!me) return null;
  if (!isAdmin) return <Navigate to="/app" />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">View system activity and modifications.</p>
      </header>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription>Latest 100 changes to goals and goal sheets.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action By</TableHead>
                  <TableHead>Goal Affected</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(log.changed_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{log.changed_by_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium line-clamp-1">{log.goal_title}</span>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">ID: {log.goal_id.slice(0, 4)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-normal uppercase">
                        {log.field_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="line-through text-muted-foreground italic truncate max-w-[80px]">
                          {log.old_value || "None"}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-primary truncate max-w-[120px]">
                          {log.new_value || "None"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!logs?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No audit logs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
