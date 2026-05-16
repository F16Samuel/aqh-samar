import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useCycles, useUsers, useCompletionReport } from "@/hooks/api";
import { reportsService } from "@/services/reports.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { downloadBlob } from "@/utils/download";
import { toast } from "sonner";
import { errorMessage } from "@/utils/errors";
import { QUARTERS } from "@/constants/rbac";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/EmptyState";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const me = useAuthStore((s) => s.profile);
  const isPrivileged = me?.role === "admin" || me?.role === "manager";
  const isAdmin = me?.role === "admin";
  const { data: cycles } = useCycles(isAdmin);
  const { data: users } = useUsers(isPrivileged);
  const [cycleId, setCycleId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [quarter, setQuarter] = useState<string>("");

  const { data: completion, isLoading } = useCompletionReport(
    { cycle_id: cycleId || undefined, quarter: quarter || undefined },
    isPrivileged,
  );

  const depts = Array.from(
    new Set((users ?? []).map((u) => u.department_id).filter((d): d is string => !!d)),
  );

  const exportFile = async (format: "csv" | "xlsx") => {
    try {
      const res = await reportsService.achievementDownload({
        format,
        cycle_id: cycleId || undefined,
        department_id: departmentId || undefined,
      });
      await downloadBlob(res, `achievement-report.${format}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Completion analytics and exportable achievement reports.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters & export</CardTitle>
          <CardDescription>GET /reports/achievement · GET /reports/completion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Cycle</Label>
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger><SelectValue placeholder="All cycles" /></SelectTrigger>
                <SelectContent>
                  {(cycles ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.year} · {c.phase}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  {depts.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quarter</Label>
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger><SelectValue placeholder="All quarters" /></SelectTrigger>
                <SelectContent>
                  {QUARTERS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportFile("csv")}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" onClick={() => exportFile("xlsx")}>
              <Download className="mr-2 h-4 w-4" /> XLSX
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completion dashboard</CardTitle>
          <CardDescription>Live data from /reports/completion</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : !completion?.length ? <EmptyState title="No data available" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Sheet Status</TableHead>
                  <TableHead>Check-ins Completed</TableHead>
                  <TableHead>Check-ins Pending</TableHead>
                  <TableHead>Last Check-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completion.map((row: any) => (
                  <TableRow key={row.employee_id}>
                    <TableCell className="font-medium">{row.employee_name}</TableCell>
                    <TableCell>{row.manager_name || "-"}</TableCell>
                    <TableCell><Badge variant="outline">{row.sheet_status}</Badge></TableCell>
                    <TableCell>{row.checkins_completed}</TableCell>
                    <TableCell>{row.checkins_pending > 0 ? <span className="text-amber-600 font-medium">{row.checkins_pending}</span> : 0}</TableCell>
                    <TableCell className="text-muted-foreground">{row.last_checkin_at ? new Date(row.last_checkin_at).toLocaleDateString() : "Never"}</TableCell>
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
