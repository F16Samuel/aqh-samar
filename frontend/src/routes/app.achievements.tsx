import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { useMyGoalSheets, useGoalsBySheet, useAchievementsByGoal, useCreateAchievement, useUpdateAchievement, useActiveCycle } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACHIEVEMENT_STATUSES, QUARTERS } from "@/constants/rbac";
import { useState, useEffect } from "react";
import type { AchievementStatus, GoalOut } from "@/types/api";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/app/achievements")({
  component: AchievementsPage,
});

function AchievementsPage() {
  const me = useAuthStore((s) => s.profile);
  const { data: sheets, isLoading } = useMyGoalSheets();
  const approvedSheets = (sheets || []).filter(
    (s) => String(s.status).toLowerCase() === "approved" || String(s.status).toLowerCase() === "locked"
  );
  
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);

  // Auto-select the first approved sheet, but do it in an effect not during render
  useEffect(() => {
    if (!selectedSheetId && approvedSheets.length > 0) {
      setSelectedSheetId(approvedSheets[0].id);
    }
  }, [approvedSheets.length, selectedSheetId]);

  const activeSheet = approvedSheets.find((s) => s.id === selectedSheetId);
  const { data: goals, isLoading: gLoad } = useGoalsBySheet(activeSheet?.id);

  const { data: activeCycle } = useActiveCycle();
  const today = new Date().toISOString().split('T')[0];
  const windowIsOpen = activeCycle?.is_active && activeCycle.window_open && activeCycle.window_close
    ? today >= activeCycle.window_open && today <= activeCycle.window_close
    : false;

  if (!me) return null;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Achievements</h1>
        <p className="text-sm text-muted-foreground">Log quarterly progress against your approved goals.</p>
      </header>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : approvedSheets.length === 0 ? (
        <EmptyState 
          title="No approved goals found" 
          description="None approved, please contact your manager." 
          action={<Link to="/app/goal-sheets" className="text-primary text-sm font-medium underline underline-offset-4">Go to goal sheets</Link>} 
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="w-full max-w-sm">
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Goal Sheet</Label>
              <Select value={selectedSheetId || ""} onValueChange={setSelectedSheetId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose an approved workflow..." />
                </SelectTrigger>
                <SelectContent>
                  {approvedSheets.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Sheet · {s.cycle_label || s.id.slice(0, 8)} ({s.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {activeSheet?.cycle_label || "Active Goals"}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    Status: <Badge variant="outline" className="capitalize text-[10px] h-5">{activeSheet?.status}</Badge>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
            {!windowIsOpen && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/20">
                <strong>Window closed.</strong> Achievement tracking is currently closed.
              </div>
            )}
            {activeSheet?.status.toLowerCase() === "locked" && (
              <div className="rounded-md bg-amber-500/15 p-3 text-sm text-amber-700 border border-amber-500/30">
                <strong>Sheet Locked.</strong> This goal sheet has been finalized and achievements are now read-only.
              </div>
            )}
            {gLoad ? <Skeleton className="h-24" /> : !goals?.length ? <EmptyState title="No goals" /> : (
              <ul className="space-y-3">
                {goals.map((g) => <GoalAchievementRow key={g.id} goal={g} windowIsOpen={windowIsOpen} activeSheetStatus={activeSheet?.status || ""} />)}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    )}
  </div>
);
}

function GoalAchievementRow({ goal, windowIsOpen, activeSheetStatus }: { goal: GoalOut; windowIsOpen: boolean; activeSheetStatus: string }) {
  const { data: achs } = useAchievementsByGoal(goal.id);
  const create = useCreateAchievement(goal.id);
  const update = useUpdateAchievement(goal.id);
  const [quarter, setQuarter] = useState<string>(QUARTERS[0]);
  const [actual, setActual] = useState("");
  const [status, setStatus] = useState<AchievementStatus>("Not Started");

  const existing = achs?.find((a) => a.quarter === quarter);
  const isShared = !!goal.shared_from;
  const isLocked = String(activeSheetStatus).toLowerCase() === "locked";
  const isDisabled = !windowIsOpen || isShared || isLocked;

  const handleAction = () => {
    if (isLocked) {
      toast.warning("This goal sheet is locked. Achievements cannot be modified.");
      return;
    }
    if (!windowIsOpen) {
      toast.warning("The performance window is currently closed.");
      return;
    }
    
    const body = { actual: actual || null, status, quarter, goal_id: goal.id };
    if (existing) update.mutate({ id: existing.id, body: { actual: body.actual, status, quarter } });
    else create.mutate(body);
    setActual("");
  };

  return (
    <li className="rounded-md border border-border/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium flex items-center gap-2">
            {goal.title}
            {isShared && (
              <Badge variant="secondary" className="text-[10px] font-normal uppercase tracking-tight">
                Shared KPI (Sync Only)
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{goal.thrust_area} · target {goal.target} · {goal.uom_type}</p>
        </div>
        <Badge variant="outline">Weight {goal.weightage}%</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_180px_auto]">
        <Select value={quarter} onValueChange={setQuarter} disabled={!windowIsOpen}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{QUARTERS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
        </Select>
        <Input 
          placeholder={isShared ? "Master sync only" : (!windowIsOpen ? "Window closed" : (existing?.actual ?? "Actual value"))} 
          value={actual} 
          onChange={(e) => setActual(e.target.value)} 
          disabled={isDisabled} 
        />
        <Select value={status} onValueChange={(v) => setStatus(v as AchievementStatus)} disabled={isDisabled}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ACHIEVEMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Button
          disabled={create.isPending || update.isPending || isDisabled}
          onClick={handleAction}
        >
          {existing ? "Update" : "Log"}
        </Button>
      </div>
      {achs && achs.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {achs.map((a) => (
            <li key={a.id}>
              <Badge variant="secondary">
                {a.quarter}: {a.status}
                {a.actual ? ` · ${a.actual}` : ""}
                {a.progress_score !== undefined && a.progress_score !== null ? ` · ${Number(a.progress_score).toFixed(0)}%` : ""}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
