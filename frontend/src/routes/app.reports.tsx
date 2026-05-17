import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useCycles, useUsers, useCompletionReport, useDepartments } from "@/hooks/api";
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
  const { data: cycles } = useCycles(isPrivileged);
  const { data: users } = useUsers(isPrivileged);
  const { data: departments } = useDepartments(isPrivileged);
  
  const [cycleId, setCycleId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [quarter, setQuarter] = useState<string>("");
  const [targetRole, setTargetRole] = useState<string>(""); // target_role for report download

  const { data: completion, isLoading } = useCompletionReport(
    { cycle_id: cycleId || undefined, quarter: quarter || undefined },
    isPrivileged,
  );

  // Filter departments to only show those represented in the users list
  const userDeptIds = new Set((users ?? []).map((u) => u.department_id).filter(Boolean));
  const filteredDepts = (departments ?? []).filter((d) => userDeptIds.has(d.id));

  const exportFile = async (format: "csv" | "xlsx") => {
    try {
      const res = await reportsService.achievementDownload({
        format,
        cycle_id: cycleId || undefined,
        department_id: (departmentId === "all" ? "" : departmentId) || undefined,
        target_role: (targetRole === "all" ? "" : targetRole) || undefined,
      });
      await downloadBlob(res, `achievement-report-${targetRole || "overall"}.${format}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // Filter the completion dashboard table based on the selected department in UI
  const filteredCompletion = completion?.filter((row: any) => {
    if (!departmentId || departmentId === "all") return true;
    return row.department_id === departmentId;
  }) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reports & Downloads</h1>
        <p className="text-sm text-muted-foreground">Completion analytics and exportable achievement reports.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters & Export Settings</CardTitle>
          <CardDescription>Export performance and metrics summaries across the organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
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
                  <SelectItem value="all">All departments</SelectItem>
                  {filteredDepts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Quarter Filter (Dashboard only)</Label>
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger><SelectValue placeholder="All quarters" /></SelectTrigger>
                <SelectContent>
                  {QUARTERS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="space-y-1">
                <Label>Export Target Role</Label>
                <Select value={targetRole} onValueChange={setTargetRole}>
                  <SelectTrigger><SelectValue placeholder="All Roles" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="manager">Managers Only</SelectItem>
                    <SelectItem value="employee">Employees Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => exportFile("csv")}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => exportFile("xlsx")}>
              <Download className="mr-2 h-4 w-4" /> Export XLSX
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completion Dashboard</CardTitle>
          <CardDescription>Live progress tracking and review status.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : !filteredCompletion.length ? <EmptyState title="No data available" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Sheet Status</TableHead>
                  <TableHead>Goal Completion</TableHead>
                  <TableHead>Check-ins Completed</TableHead>
                  <TableHead>Check-ins Pending</TableHead>
                  <TableHead>Last Check-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompletion.map((row: any) => {
                  const empUser = users?.find(u => u.id === row.employee_id);
                  const jobTitle = empUser?.job_title;
                  
                  return (
                    <TableRow key={row.employee_id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold">{row.employee_name}</span>
                          {jobTitle && (
                            <span className="text-xs text-muted-foreground">{jobTitle}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{row.department_name || "-"}</TableCell>
                      <TableCell>{row.manager_name || "-"}</TableCell>
                      <TableCell><Badge variant="outline">{row.sheet_status}</Badge></TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                           <span className="w-10 text-xs font-bold tabular-nums">
                             {row.progress_score}%
                           </span>
                           <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden shrink-0">
                             <div 
                               className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                               style={{ width: `${Math.min(row.progress_score ?? 0, 100)}%` }}
                             />
                           </div>
                         </div>
                      </TableCell>
                      <TableCell>{row.checkins_completed}</TableCell>
                      <TableCell>{row.checkins_pending > 0 ? <span className="text-amber-600 font-medium">{row.checkins_pending}</span> : 0}</TableCell>
                      <TableCell className="text-muted-foreground">{row.last_checkin_at ? new Date(row.last_checkin_at).toLocaleDateString() : "Never"}</TableCell>
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
