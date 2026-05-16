import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useManagerAnalytics, useActiveCycle } from "@/hooks/api";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, Legend, Cell, PieChart, Pie,
} from "recharts";
import {
  Users, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Activity, Award, BarChart2,
} from "lucide-react";
import { mean, median, stdDev } from "@/utils/math";

export const Route = createFileRoute("/app/admin/progress")({
  component: ProgressTrackerPage,
});

const SCORE_COLORS = {
  good: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "#6b7280",
};

function scoreColor(score: number) {
  if (score >= 75) return SCORE_COLORS.good;
  if (score >= 50) return SCORE_COLORS.warning;
  return SCORE_COLORS.danger;
}

function biasColor(label: string) {
  if (label === "Lenient") return "text-amber-500";
  if (label === "Strict") return "text-blue-500";
  return "text-emerald-500";
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-center">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ProgressTrackerPage() {
  const me = useAuthStore((s) => s.profile);
  const isAdmin = me?.role === "admin";
  const { data: cycle } = useActiveCycle();
  const { data: raw, isLoading } = useManagerAnalytics(
    { cycle_id: cycle?.id },
    isAdmin,
  );

  const [expandedManager, setExpandedManager] = useState<string | null>(null);

  if (!me) return null;
  if (!isAdmin) return <Navigate to="/app" />;

  const company = raw?.company;
  const managers: any[] = raw?.managers ?? [];

  // Prep chart data
  const managerBarData = managers.map((m: any) => ({
    name: m.manager_name.split(" ")[0],
    mean: m.stats.mean,
    median: m.stats.median,
    std_dev: m.stats.std_dev,
    team_size: m.team_size,
  }));

  const funnelTotals = managers.reduce(
    (acc: any, m: any) => {
      for (const [k, v] of Object.entries(m.funnel)) acc[k] = (acc[k] || 0) + (v as number);
      return acc;
    },
    {} as Record<string, number>,
  );
  const funnelData = Object.entries(funnelTotals)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v as number }));
  const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

  const quarterlyData = ["Q1", "Q2", "Q3", "Q4"].map((q) => {
    const entry: any = { quarter: q };
    managers.forEach((m: any) => {
      entry[m.manager_name.split(" ")[0]] = m.quarterly_avg_scores?.[q] ?? 0;
    });
    return entry;
  });

  const managerColors = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Progress Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Hierarchical analytics · {company?.cycle_label ?? "Active Cycle"}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {company?.total_managers ?? 0} Managers · Live
        </Badge>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !managers.length ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              title="No manager data"
              description="Ensure teams are set up and assigned to managers."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Company KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Company Mean" value={`${company?.mean ?? 0}%`} sub="Achievement Score" />
            <StatBox label="Company Median" value={`${company?.median ?? 0}%`} />
            <StatBox label="Std Deviation" value={`±${company?.std_dev ?? 0}`} sub="Score spread" />
            <StatBox label="Total Managers" value={company?.total_managers ?? 0} />
          </div>

          {/* ── Goal Lifecycle Funnel ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" /> Goal Sheet Funnel
              </CardTitle>
              <CardDescription>Distribution of goal sheets across all lifecycle stages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={funnelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {funnelData.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 min-w-[120px]">
                  {funnelData.map((d: any, i: number) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="font-medium">{d.name}</span>
                      <span className="ml-auto text-muted-foreground">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Mean vs Median per Manager ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Manager Score Distribution
              </CardTitle>
              <CardDescription>Mean vs Median achievement scores per manager's team</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={managerBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Legend />
                  <Bar dataKey="mean" name="Mean" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="median" name="Median" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="std_dev" name="Std Dev" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Quarterly Trend ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Quarterly Score Trends
              </CardTitle>
              <CardDescription>Average team achievement score by quarter per manager</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={quarterlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Legend />
                  {managers.map((m: any, i: number) => (
                    <Line
                      key={m.manager_id}
                      type="monotone"
                      dataKey={m.manager_name.split(" ")[0]}
                      stroke={managerColors[i % managerColors.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Per-Manager Expandable Cards ── */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Per-Manager Deep Dive</h2>
            {managers
              .sort((a: any, b: any) => (b.stats.mean - a.stats.mean))
              .map((m: any, i: number) => {
                const isExpanded = expandedManager === m.manager_id;
                const thrustData = Object.entries(m.thrust_area_distribution ?? {}).map(([k, v]) => ({
                  area: k.length > 14 ? k.slice(0, 14) + "…" : k,
                  count: v as number,
                }));

                return (
                  <Card
                    key={m.manager_id}
                    className="overflow-hidden border-border/50 transition-all cursor-pointer hover:border-primary/40"
                    onClick={() => setExpandedManager(isExpanded ? null : m.manager_id)}
                  >
                    {/* Header row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{m.manager_name}</h3>
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />{m.team_size} reports
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium ${biasColor(m.bias_label)}`}
                          >
                            {m.bias_label === "Lenient" ? <TrendingUp className="h-3 w-3 mr-1" /> : m.bias_label === "Strict" ? <TrendingDown className="h-3 w-3 mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {m.bias_label} Grader
                          </Badge>
                          {m.at_risk?.length > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />{m.at_risk.length} At Risk
                            </Badge>
                          )}
                          {m.top_performers?.length > 0 && (
                            <Badge className="text-xs bg-emerald-600">
                              <Award className="h-3 w-3 mr-1" />{m.top_performers.length} Stars
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={m.stats.mean} className="h-2 flex-1" />
                          <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor(m.stats.mean) }}>
                            {m.stats.mean}%
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs shrink-0">
                        {[
                          { l: "Mean", v: m.stats.mean },
                          { l: "Median", v: m.stats.median },
                          { l: "±σ", v: m.stats.std_dev },
                          { l: "Approve%", v: `${m.approval_rate}%` },
                        ].map(({ l, v }) => (
                          <div key={l} className="rounded-md bg-muted/20 px-2 py-1.5">
                            <div className="font-semibold">{v}</div>
                            <div className="text-muted-foreground">{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-border/50 p-4 space-y-4 bg-muted/5">
                        {/* Employee Scores Bar Chart */}
                        {m.employee_scores?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Employee Score Ranking</p>
                            <ResponsiveContainer width="100%" height={160}>
                              <BarChart data={m.employee_scores} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                                <Tooltip formatter={(v: any) => `${v}%`} />
                                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                  {m.employee_scores.map((_: any, idx: number) => (
                                    <Cell key={idx} fill={scoreColor(m.employee_scores[idx]?.score)} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Stat grid */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Distribution Stats</p>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { l: "P25", v: `${m.stats.p25}%` },
                                { l: "P75", v: `${m.stats.p75}%` },
                                { l: "Mode", v: `${m.stats.mode}%` },
                                { l: "Min", v: `${m.stats.min}%` },
                                { l: "Max", v: `${m.stats.max}%` },
                                { l: "Bias Δ", v: m.bias_index },
                              ].map(({ l, v }) => (
                                <div key={l} className="rounded-md bg-background border border-border/60 px-2 py-1.5 text-center text-xs">
                                  <div className="font-semibold">{v}</div>
                                  <div className="text-muted-foreground">{l}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-md bg-background border border-border/60 px-2 py-1.5">
                                <span className="text-muted-foreground">Avg Goals/emp: </span>
                                <span className="font-medium">{m.avg_goals_per_employee}</span>
                              </div>
                              <div className="rounded-md bg-background border border-border/60 px-2 py-1.5">
                                <span className="text-muted-foreground">Avg Achievements/emp: </span>
                                <span className="font-medium">{m.avg_achievements_per_employee}</span>
                              </div>
                            </div>
                          </div>

                          {/* Thrust Area Bar */}
                          {thrustData.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Thrust Area Distribution</p>
                              <ResponsiveContainer width="100%" height={130}>
                                <BarChart data={thrustData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                  <XAxis dataKey="area" tick={{ fontSize: 10 }} />
                                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                  <Tooltip />
                                  <Bar dataKey="count" fill={managerColors[i % managerColors.length]} radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>

                        {/* Top performers & at risk */}
                        {(m.top_performers?.length > 0 || m.at_risk?.length > 0) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {m.top_performers?.length > 0 && (
                              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                                <p className="text-xs font-semibold text-emerald-600 mb-1.5 flex items-center gap-1">
                                  <Award className="h-3 w-3" /> Top Performers (≥90%)
                                </p>
                                <ul className="space-y-1">
                                  {m.top_performers.map((p: any) => (
                                    <li key={p.employee_id} className="text-xs flex justify-between">
                                      <span>{p.employee_name}</span>
                                      <span className="font-semibold text-emerald-600">{p.score}%</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {m.at_risk?.length > 0 && (
                              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                                <p className="text-xs font-semibold text-destructive mb-1.5 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> At Risk (&lt;50%)
                                </p>
                                <ul className="space-y-1">
                                  {m.at_risk.map((p: any) => (
                                    <li key={p.employee_id} className="text-xs flex justify-between">
                                      <span>{p.employee_name}</span>
                                      <span className="font-semibold text-destructive">{p.score}%</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
