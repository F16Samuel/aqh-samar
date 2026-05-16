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
                    <SelectItem key={d} value={d}>{d.slice(0, 8)}</SelectItem>
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
          {isLoading ? <Skeleton className="h-32" /> : (
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(completion ?? {}, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
