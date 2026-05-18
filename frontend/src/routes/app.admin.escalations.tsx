import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useAutomationAnalytics, useAutomationHistory } from "@/hooks/automation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Clock,
  UserCheck,
  Search,
  Sparkles,
  BarChart4,
  Flame,
  UserX,
  History,
  TrendingDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export const Route = createFileRoute("/app/admin/escalations")({
  component: SlaCommandCenterPage,
});

const OKLCH_PALETTE = [
  "oklch(0.627 0.265 25.567)",  // Vibrant Red
  "oklch(0.707 0.207 45.122)",  // Amber Orange
  "oklch(0.612 0.171 142.495)", // Emerald Green
  "oklch(0.551 0.191 254.67)",  // Royal Blue
  "oklch(0.627 0.228 305.12)",  // Violet Purple
  "oklch(0.72 0.14 80.0)",      // Soft Yellow
];

function SlaCommandCenterPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "admin") return <Navigate to="/app" />;

  const { data: analytics, isLoading: analyticsLoading } = useAutomationAnalytics();
  const { data: history, isLoading: historyLoading } = useAutomationHistory();
  const [searchTerm, setSearchTerm] = useState("");

  const riskMatrix = analytics?.risk_matrix || [];
  const responsivenessRankings = analytics?.responsiveness_rankings || [];
  const heatmapData = analytics?.heatmap || [];
  const summary = analytics?.summary || { total_escalations: 0, sla_breach_rate: 0.0, avg_compliance: 0.0 };

  // Filter risk matrix by employee name or department
  const filteredRiskMatrix = riskMatrix.filter(
    (emp: any) =>
      emp.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <header className="flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Flame className="h-6 w-6 text-rose-500 animate-bounce" /> Enterprise SLA Command Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor real-time compliance metrics, risk score aggregates, and manager responsiveness indexes.
          </p>
        </div>
      </header>

      {/* SLA Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden border-l-4 border-l-rose-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active SLA Breaches
                </span>
                <h3 className="text-3xl font-extrabold text-foreground tracking-tight">
                  {analyticsLoading ? <Skeleton className="h-9 w-12" /> : summary.total_escalations}
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-[10px] text-muted-foreground font-medium">
              <span className="text-rose-500 font-bold mr-1.5 flex items-center gap-0.5">
                <TrendingDown className="h-3 w-3" /> Critical
              </span>{" "}
              Overdue goal sheets or stalled reviews.
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  SLA Breach Rate
                </span>
                <h3 className="text-3xl font-extrabold text-foreground tracking-tight">
                  {analyticsLoading ? <Skeleton className="h-9 w-16" /> : `${summary.sla_breach_rate}%`}
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Clock className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-[10px] text-muted-foreground font-medium">
              Of active employees currently in SLA violation.
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mean Compliance Index
                </span>
                <h3 className="text-3xl font-extrabold text-foreground tracking-tight">
                  {analyticsLoading ? <Skeleton className="h-9 w-16" /> : `${summary.avg_compliance}%`}
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <UserCheck className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-[10px] text-muted-foreground font-medium">
              Average aggregate submission and check-in rates.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recharts Heatmap & Manager Rankings Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Department SLA breach Heatmap */}
        <Card className="lg:col-span-2 text-left">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BarChart4 className="h-4 w-4 text-primary" /> Compliance Hotspots — SLA Breach Heatmap
            </CardTitle>
            <CardDescription>Visualizes active escalation counts grouped by corporate department.</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={heatmapData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="department" tick={{ fill: "gray", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "gray", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e0e0e0",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="escalations" radius={[4, 4, 0, 0]}>
                      {heatmapData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={OKLCH_PALETTE[index % OKLCH_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manager Turnaround / Responsiveness Rankings */}
        <Card className="text-left">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-emerald-500" /> Manager Responsiveness Scores
            </CardTitle>
            <CardDescription>Rankings based on average goal review SLA cycle turnaround time.</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : responsivenessRankings.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No review activities recorded in active cycle.
              </div>
            ) : (
              <div className="space-y-4 max-h-[16.5rem] overflow-y-auto pr-1">
                {responsivenessRankings
                  .sort((a: any, b: any) => b.responsiveness_score - a.responsiveness_score)
                  .map((mgr: any, idx: number) => {
                    const score = mgr.responsiveness_score;
                    const badgeClass =
                      score >= 90
                        ? "bg-emerald-500/10 text-emerald-500"
                        : score >= 60
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-rose-500/10 text-rose-500";
                    return (
                      <div key={idx} className="flex items-center justify-between border-b pb-2.5 last:border-0 last:pb-0">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-foreground block">{mgr.manager_name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Turnaround: {mgr.avg_hours}h ({mgr.total_reviews} reviews)
                          </span>
                        </div>
                        <Badge className={`${badgeClass} border-none font-bold text-xs`}>
                          {score} pts
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Employee Risk Index & Compliance Matrix */}
      <Card className="text-left">
        <CardHeader className="flex flex-col justify-between gap-4 border-b sm:flex-row sm:items-center">
          <div>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> Corporate Risk Index & Compliance Matrix
            </CardTitle>
            <CardDescription>Dynamic composite risk scoring mapping employee performance compliance.</CardDescription>
          </div>

          {/* Search box */}
          <div className="relative w-64">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search employee or dept..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {analyticsLoading ? (
            <div className="p-6">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : filteredRiskMatrix.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No matching employee records found.
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/30 uppercase text-[10px] font-semibold text-muted-foreground">
                  <th className="px-6 py-3.5">Employee Details</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Direct Manager</th>
                  <th className="px-6 py-3.5 text-center">Compliance Index</th>
                  <th className="px-6 py-3.5 text-center">Active SLA Breaches</th>
                  <th className="px-6 py-3.5 text-center">Composite Risk Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRiskMatrix.map((emp: any, idx: number) => {
                  const risk = emp.risk_score;
                  const riskLevel = emp.risk_level;
                  const riskBadge =
                    riskLevel === "High"
                      ? "bg-rose-500/10 text-rose-500 border-none"
                      : riskLevel === "Medium"
                      ? "bg-amber-500/10 text-amber-500 border-none"
                      : "bg-emerald-500/10 text-emerald-500 border-none";
                  return (
                    <tr key={idx} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-foreground block">{emp.employee_name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{emp.employee_email}</span>
                      </td>
                      <td className="px-6 py-4 font-medium">{emp.department}</td>
                      <td className="px-6 py-4 font-medium">{emp.manager_name}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5"
                              style={{ width: `${emp.compliance_score}%` }}
                            />
                          </div>
                          <span className="font-semibold text-foreground">{emp.compliance_score}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold">
                        {emp.active_breaches > 0 ? (
                          <span className="text-rose-500 flex items-center justify-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 fill-rose-500/10" /> {emp.active_breaches}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-medium">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge className={`${riskBadge} font-bold px-2 py-0.5`}>
                          {riskLevel} ({risk}%)
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Historical Audit trail list */}
      <Card className="text-left">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <History className="h-4 w-4 text-primary" /> Chronological SLA Escalation Audit Trail
          </CardTitle>
          <CardDescription>Historical trace logs of warning emails, Teams adaptive card releases, and reassignment logs.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 max-h-72 overflow-y-auto pr-1">
          {historyLoading ? (
            <div className="p-6">
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !history?.length ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Zero historical actions recorded.
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/20 uppercase text-[9px] font-semibold text-muted-foreground">
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Escalated Rule</th>
                  <th className="px-6 py-3 text-center">Action Type</th>
                  <th className="px-6 py-3">Recipient Partner</th>
                  <th className="px-6 py-3">Audit Details</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {history.map((log: any) => {
                  const isSuccess = log.status === "success";
                  return (
                    <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-muted-foreground text-[10px]">
                        {new Date(log.executed_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 font-bold text-foreground">{log.rule_name}</td>
                      <td className="px-6 py-3.5 text-center">
                        <Badge variant="outline" className="text-[9px] uppercase font-mono">
                          {log.action_type}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold block">{log.recipient_name}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">{log.recipient_email}</span>
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground max-w-sm truncate italic">
                        {log.details}
                      </td>
                      <td className="px-6 py-3.5 text-center font-bold">
                        <span className={isSuccess ? "text-emerald-500" : "text-rose-500"}>
                          {isSuccess ? "SUCCESS" : "FAILED"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
