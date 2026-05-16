import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUsers, useShareGoal, useAllGoalsAdmin } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_LIMITS } from "@/constants/rbac";

export const Route = createFileRoute("/app/admin/shared-goals")({
  component: SharedGoalsPage,
});

function SharedGoalsPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "admin") return <Navigate to="/app" />;
  const { data: users, isLoading } = useUsers();
  const { data: allGoals, isLoading: goalsLoading } = useAllGoalsAdmin();
  const share = useShareGoal();
  const [sourceGoalId, setSourceGoalId] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [weightage, setWeightage] = useState<number>(10);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Shared goals</h1>
        <p className="text-sm text-muted-foreground">Push a department KPI to multiple employees.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribute goal</CardTitle>
          <CardDescription>POST /goals/shared</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setSelectedPhase(""); setSourceGoalId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(allGoals?.map(g => g.year))).sort((a,b) => b-a).map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Phase / Quarter</Label>
              <Select value={selectedPhase} onValueChange={(v) => { setSelectedPhase(v); setSourceGoalId(""); }} disabled={!selectedYear}>
                <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(allGoals?.filter(g => String(g.year) === selectedYear).map(g => g.phase))).map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Goal Name</Label>
              <Select value={sourceGoalId} onValueChange={setSourceGoalId} disabled={!selectedPhase}>
                <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
                <SelectContent>
                  {allGoals?.filter(g => String(g.year) === selectedYear && g.phase === selectedPhase).map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1 max-w-[200px]">
            <Label>Weightage (%)</Label>
            <Input
              type="number"
              min={GOAL_LIMITS.MIN_WEIGHTAGE}
              max={GOAL_LIMITS.MAX_WEIGHTAGE}
              value={weightage}
              onChange={(e) => setWeightage(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Recipients</Label>
            {isLoading ? <Skeleton className="mt-2 h-24" /> : (
              <div className="mt-2 max-h-64 overflow-auto rounded-md border border-border/60 p-2">
                {(users ?? []).filter((u) => u.role === "employee").map((u) => (
                  <label key={u.id} className="flex items-center gap-2 py-1 text-sm">
                    <Checkbox
                      checked={!!selected[u.id]}
                      onCheckedChange={(v) => setSelected((s) => ({ ...s, [u.id]: !!v }))}
                    />
                    <span>{u.full_name}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <Button
            disabled={!sourceGoalId || ids.length === 0 || share.isPending}
            onClick={() => share.mutate({ source_goal_id: sourceGoalId, employee_ids: ids, weightage })}
          >
            Push to {ids.length} employees
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
