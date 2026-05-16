import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useTeamAnalytics, useActiveCycle, useCycles } from "@/hooks/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, Legend, Cell,
} from "recharts";
import {
  Users, TrendingUp, AlertTriangle, CheckCircle2, Activity,
  Award, Clock, Target,
} from "lucide-react";
import { mean, median, stdDev } from "@/utils/math";

export const Route = createFileRoute("/app/team")({
  component: TeamPage,
});

const QUARTER_COLORS: Record<string, string> = {
  Q1: "#6366f1", Q2: "#f59e0b", Q3: "#10b981", Q4: "#ef4444",
};

function scoreColor(s: number) {
  return s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    submitted: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    draft: "bg-muted/40 text-muted-foreground border-border/60",
    rework: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    none: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${map[status] ?? map.none}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-4 flex items-center gap-3">
      <div className={`rounded-md p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "manager" && me.role !== "admin") return <Navigate to="/app" />;

  const { data: activeCycle } = useActiveCycle();
  const { data: cycles } = useCycles(true);
  const [selectedCycleId, setSelectedCycleId] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);

  // Default to active cycle once loaded
  useEffect(() => {
    if (activeCycle?.id && !selectedCycleId) {
      setSelectedCycleId(activeCycle.id);
    }
  }, [activeCycle?.id]);

  const currentCycle = (cycles ?? []).find((c: any) => c.id === selectedCycleId) ?? activeCycle;
  const { data: raw, isLoading } = useTeamAnalytics(
    { cycle_id: selectedCycleId },
    !!selectedCycleId,
  );

  const summary = raw?.team_summary;
  const employees: any[] = raw?.employees ?? [];
  const selectedEmp = employees.find((e: any) => e.employee_id === selected);

  // Team-level quarterly chart
  const quarterlyTeamData = ["Q1", "Q2", "Q3", "Q4"].map((q) => ({
    quarter: q,
    avg: employees.length
      ? Math.round(employees.reduce((a: number, e: any) => a + (e.quarterly_scores?.[q] ?? 0), 0) / employees.length)
      : 0,
  }));

  // Thrust area radar (aggregate)
  const thrustMap: Record<string, number[]> = {};
  employees.forEach((e: any) => {
    Object.entries(e.thrust_area_balance ?? {}).forEach(([k, v]) => {
      thrustMap[k] = thrustMap[k] ?? [];
      thrustMap[k].push(v as number);
    });
  });
  const radarData = Object.entries(thrustMap).map(([k, vals]) => ({
    area: k.length > 16 ? k.slice(0, 16) + "…" : k,
    score: Math.round(mean(vals)),
  }));

  // Score distribution for bar chart
  const scoreDistData = employees.map((e: any) => ({
    name: e.employee_name.split(" ")[0],
    score: e.total_score,
    fill: scoreColor(e.total_score),
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {currentCycle ? `${currentCycle.year} · ${currentCycle.phase}` : "Loading cycle…"} · Analytics
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Cycle selector */}
          <Select value={selectedCycleId ?? ""} onValueChange={(v) => { setSelectedCycleId(v); setSelected(null); }}>
            <SelectTrigger className="w-52 text-sm">
              <SelectValue placeholder="Select cycle…" />
            </SelectTrigger>
            <SelectContent>
              {(cycles ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.year} · {c.phase} {c.is_active ? "(Active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {summary && (
            <div className="flex gap-2 flex-wrap">
              <Badge className="bg-emerald-600 text-white">{summary.on_track_count} On Track</Badge>
            {summary.at_risk_count > 0 && (
              <Badge variant="destructive">{summary.at_risk_count} At Risk</Badge>
            )}
            </div>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : !employees.length ? (
        <Card><CardContent className="pt-6"><EmptyState title="No team data" description="No direct reports found for the active cycle." /></CardContent></Card>
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Team Mean Score" value={`${summary?.mean_score ?? 0}%`} icon={Activity} color="bg-indigo-500/10 text-indigo-600" />
            <StatCard label="Median Score" value={`${summary?.median_score ?? 0}%`} icon={TrendingUp} color="bg-amber-500/10 text-amber-600" />
            <StatCard label="Std Deviation" value={`±${summary?.std_dev ?? 0}`} icon={Target} color="bg-blue-500/10 text-blue-600" />
            <StatCard label="Total Employees" value={summary?.total_employees ?? 0} icon={Users} color="bg-emerald-500/10 text-emerald-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Score Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" /> Score Distribution
                </CardTitle>
                <CardDescription>Achievement score per employee</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreDistData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {scoreDistData.map((d: any, i: number) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quarterly Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Quarterly Completion Trend
                </CardTitle>
                <CardDescription>Average team score across quarters</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={quarterlyTeamData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Line type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Avg Score" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Thrust Area Radar */}
          {radarData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" /> Thrust Area Balance
                </CardTitle>
                <CardDescription>Average achievement score by organizational priority area</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="area" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Employee List with Drill-Down */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Employee Pulse
              </CardTitle>
              <CardDescription>Click any row to drill into goal-level detail</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {employees
                .sort((a: any, b: any) => b.total_score - a.total_score)
                .map((emp: any) => {
                  const isOpen = selected === emp.employee_id;
                  return (
                    <div
                      key={emp.employee_id}
                      className="rounded-lg border border-border/50 bg-card overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={() => setSelected(isOpen ? null : emp.employee_id)}
                    >
                      {/* Summary row */}
                      <div className="flex flex-wrap items-center gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{emp.employee_name}</p>
                            <StatusBadge status={emp.sheet_status} />
                            {emp.on_track && <Badge className="text-[10px] bg-emerald-600 py-0">On Track</Badge>}
                            {emp.at_risk && <Badge variant="destructive" className="text-[10px] py-0">At Risk</Badge>}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <Progress value={emp.total_score} className="h-1.5 flex-1" />
                            <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color: scoreColor(emp.total_score) }}>
                              {emp.total_score}%
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 text-xs text-muted-foreground shrink-0">
                          <span className="flex items-center gap-1"><Target className="h-3 w-3" />{emp.goal_count} goals</span>
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{emp.checkins_completed} check-ins</span>
                          {emp.last_checkin_at && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />{new Date(emp.last_checkin_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Drill-down */}
                      {isOpen && (
                        <div className="border-t border-border/50 bg-muted/5 p-3 space-y-3">
                          {/* Quarterly scores */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Quarterly Scores</p>
                            <div className="grid grid-cols-4 gap-2">
                              {["Q1", "Q2", "Q3", "Q4"].map((q) => {
                                const s = emp.quarterly_scores?.[q] ?? 0;
                                return (
                                  <div key={q} className="rounded-md border border-border/50 bg-background p-2 text-center">
                                    <div className="text-xs text-muted-foreground">{q}</div>
                                    <div className="text-sm font-bold" style={{ color: s > 0 ? scoreColor(s) : undefined }}>{s > 0 ? `${s}%` : "–"}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Goal Variance Table */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Goal Breakdown & Variance</p>
                            <div className="space-y-1.5">
                              {(emp.goals ?? []).map((g: any) => (
                                <div key={g.goal_id} className="rounded-md border border-border/50 bg-background p-2 text-xs">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <div>
                                      <span className="font-medium">{g.title}</span>
                                      <span className="ml-2 text-muted-foreground">{g.thrust_area}</span>
                                      {g.is_shared && <Badge variant="outline" className="ml-1 text-[10px] h-4">Shared</Badge>}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-muted-foreground">{g.weightage}%</span>
                                      <span className="font-bold" style={{ color: scoreColor(g.score) }}>{g.score}%</span>
                                    </div>
                                  </div>
                                  <div className="mt-1 flex items-center gap-3 text-muted-foreground">
                                    <span>Target: <strong className="text-foreground">{g.target}</strong></span>
                                    <span>Actual: <strong className="text-foreground">{g.actual ?? "–"}</strong></span>
                                    {g.variance !== null && (
                                      <span className={g.variance >= 0 ? "text-emerald-600" : "text-destructive"}>
                                        Δ {g.variance > 0 ? "+" : ""}{g.variance}
                                      </span>
                                    )}
                                    <span>{g.ach_count} entries</span>
                                  </div>
                                  <Progress value={g.score} className="h-1 mt-1.5" />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Check-in frequency */}
                          {Object.keys(emp.checkin_frequency ?? {}).length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1.5">Check-in Frequency</p>
                              <div className="flex gap-2 flex-wrap">
                                {Object.entries(emp.checkin_frequency).map(([q, count]: any) => (
                                  <div key={q} className="rounded-md border px-2 py-1 text-xs flex items-center gap-1.5">
                                    <span className="font-medium">{q}</span>
                                    <span className="text-muted-foreground">× {count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="pt-1">
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/app/goal-sheets`}>View Sheets</Link>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </CardContent>
          </Card>

          {/* Pending Actions Hub */}
          {employees.filter((e: any) => e.sheet_status === "submitted").length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Pending Actions Hub
                </CardTitle>
                <CardDescription>Sheets awaiting your review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {employees
                    .filter((e: any) => e.sheet_status === "submitted")
                    .map((e: any) => (
                      <div key={e.employee_id} className="flex items-center justify-between rounded-md border border-amber-500/20 bg-background px-3 py-2 text-sm">
                        <span className="font-medium">{e.employee_name}</span>
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/app/goal-sheets">Review</Link>
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
