import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { useMyGoalSheets, useGoalsBySheet, useAchievementsByGoal, useCreateAchievement, useUpdateAchievement } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACHIEVEMENT_STATUSES, QUARTERS } from "@/constants/rbac";
import { useState } from "react";
import type { AchievementStatus, GoalOut } from "@/types/api";

export const Route = createFileRoute("/app/achievements")({
  component: AchievementsPage,
});

function AchievementsPage() {
  const me = useAuthStore((s) => s.profile);
  const { data: sheets, isLoading } = useMyGoalSheets();
  const activeSheet = sheets?.find((s) => String(s.status).toLowerCase() === "approved" || String(s.status).toLowerCase() === "locked") ?? sheets?.[0];
  const { data: goals, isLoading: gLoad } = useGoalsBySheet(activeSheet?.id);

  if (!me) return null;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Achievements</h1>
        <p className="text-sm text-muted-foreground">Log quarterly progress against your approved goals.</p>
      </header>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !activeSheet ? (
        <EmptyState title="No goal sheet to log against" description="Create and submit a goal sheet first." action={<Link to="/app/goal-sheets" className="text-primary text-sm">Go to goal sheets</Link>} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sheet · {activeSheet.id.slice(0, 8)}</CardTitle>
            <CardDescription>Status: {String(activeSheet.status)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gLoad ? <Skeleton className="h-24" /> : !goals?.length ? <EmptyState title="No goals" /> : (
              <ul className="space-y-3">
                {goals.map((g) => <GoalAchievementRow key={g.id} goal={g} />)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GoalAchievementRow({ goal }: { goal: GoalOut }) {
  const { data: achs } = useAchievementsByGoal(goal.id);
  const create = useCreateAchievement(goal.id);
  const update = useUpdateAchievement(goal.id);
  const [quarter, setQuarter] = useState<string>(QUARTERS[0]);
  const [actual, setActual] = useState("");
  const [status, setStatus] = useState<AchievementStatus>("Not Started");

  const existing = achs?.find((a) => a.quarter === quarter);

  return (
    <li className="rounded-md border border-border/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{goal.title}</p>
          <p className="text-xs text-muted-foreground">{goal.thrust_area} · target {goal.target} · {goal.uom_type}</p>
        </div>
        <Badge variant="outline">Weight {goal.weightage}%</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_180px_auto]">
        <Select value={quarter} onValueChange={setQuarter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{QUARTERS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder={existing?.actual ?? "Actual value"} value={actual} onChange={(e) => setActual(e.target.value)} />
        <Select value={status} onValueChange={(v) => setStatus(v as AchievementStatus)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ACHIEVEMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Button
          disabled={create.isPending || update.isPending}
          onClick={() => {
            const body = { actual: actual || null, status, quarter, goal_id: goal.id };
            if (existing) update.mutate({ id: existing.id, body: { actual: body.actual, status, quarter } });
            else create.mutate(body);
            setActual("");
          }}
        >
          {existing ? "Update" : "Log"}
        </Button>
      </div>
      {achs && achs.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {achs.map((a) => (
            <li key={a.id}>
              <Badge variant="secondary">{a.quarter}: {a.status}{a.actual ? ` · ${a.actual}` : ""}</Badge>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
